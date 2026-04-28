import { NextResponse } from "next/server";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getFeesWorkerSecret,
  getFeeTreasuryPrivateKey,
  getPumpPortalApiKey,
  getSolanaRpcUrl,
} from "@/lib/env";
import { listFeeConfiguredLaunches, recordFeeDistributionRun } from "@/lib/drop-launches-db";

export const dynamic = "force-dynamic";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MIN_PAYOUT_LAMPORTS = 5000;
const TX_BATCH_SIZE = 12;

async function claimCreatorFeesViaPumpPortal(mint: string): Promise<{ ok: boolean; signature: string | null; error?: string }> {
  const apiKey = getPumpPortalApiKey();
  if (!apiKey) return { ok: false, signature: null, error: "missing_pumpportal_api_key" };
  const url = `https://pumpportal.fun/api/trade?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "collectCreatorFee",
      mint,
      priorityFee: 0.000001,
      pool: "pump",
    }),
  });
  const text = await res.text();
  let j: Record<string, unknown> | null = null;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* no-op */
  }
  if (!res.ok) {
    return {
      ok: false,
      signature: null,
      error: (j?.error as string | undefined) || (j?.message as string | undefined) || text || "claim_failed",
    };
  }
  const signature =
    (j?.signature as string | undefined) ||
    (j?.tx as string | undefined) ||
    (j?.transaction as string | undefined) ||
    null;
  return { ok: true, signature };
}

function loadTreasuryKeypair(): Keypair {
  const raw = getFeeTreasuryPrivateKey();
  if (!raw) throw new Error("Missing FEE_TREASURY_PRIVATE_KEY");
  try {
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new Error("Invalid FEE_TREASURY_PRIVATE_KEY format");
  }
}

function readU64LE(buf: Uint8Array, offset: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getBigUint64(offset, true);
}

async function getTopHoldersByOwner(connection: Connection, mint: string, limit: number): Promise<Array<{ owner: string; amount: bigint }>> {
  const mintKey = new PublicKey(mint);
  const tokenAccounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mintKey.toBase58() } },
    ],
  });

  const byOwner = new Map<string, bigint>();
  for (const account of tokenAccounts) {
    const data = account.account.data;
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amount = readU64LE(data, 64);
    if (amount <= 0n) continue;
    byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amount);
  }

  return Array.from(byOwner.entries())
    .map(([owner, amount]) => ({ owner, amount }))
    .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))
    .slice(0, limit);
}

function splitLamportsBySqrtWeight(
  totalLamports: number,
  holders: Array<{ owner: string; amount: bigint }>,
): Array<{ to: string; lamports: number }> {
  if (totalLamports <= 0 || holders.length === 0) return [];
  if (holders.length === 1) return [{ to: holders[0].owner, lamports: totalLamports }];

  const weighted = holders.map((h) => ({ to: h.owner, w: Math.sqrt(Number(h.amount)) }));
  const sumW = weighted.reduce((a, b) => a + (Number.isFinite(b.w) ? b.w : 0), 0);
  if (!Number.isFinite(sumW) || sumW <= 0) {
    const each = Math.floor(totalLamports / holders.length);
    return holders.map((h) => ({ to: h.owner, lamports: each }));
  }

  const out = weighted.map((h) => ({ to: h.to, lamports: Math.floor((totalLamports * h.w) / sumW) }));
  const used = out.reduce((a, b) => a + b.lamports, 0);
  const remainder = totalLamports - used;
  if (remainder > 0 && out.length > 0) out[0].lamports += remainder;
  return out;
}

async function sendLamportTransfers(
  connection: Connection,
  signer: Keypair,
  transfers: Array<{ to: string; lamports: number }>,
): Promise<{ sent: number; signatures: string[]; lamportsSent: number }> {
  const valid = transfers.filter((t) => Number.isFinite(t.lamports) && t.lamports >= MIN_PAYOUT_LAMPORTS);
  let sent = 0;
  let lamportsSent = 0;
  const signatures: string[] = [];
  for (let i = 0; i < valid.length; i += TX_BATCH_SIZE) {
    const batch = valid.slice(i, i + TX_BATCH_SIZE);
    const tx = new Transaction();
    for (const t of batch) {
      const lamports = Math.floor(t.lamports);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: signer.publicKey,
          toPubkey: new PublicKey(t.to),
          lamports,
        }),
      );
      lamportsSent += lamports;
    }
    const sig = await connection.sendTransaction(tx, [signer], { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");
    signatures.push(sig);
    sent += batch.length;
  }
  return { sent, signatures, lamportsSent };
}

async function handleDistribution(request: Request) {
  const workerSecret = getFeesWorkerSecret();
  if (!workerSecret) return NextResponse.json({ error: "Missing FEES_WORKER_SECRET." }, { status: 500 });
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${workerSecret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const treasurySigner = loadTreasuryKeypair();
  const launches = await listFeeConfiguredLaunches();
  const results: Array<Record<string, unknown>> = [];
  for (const launch of launches) {
    if (launch.feeTreasuryWallet !== treasurySigner.publicKey.toBase58()) {
      results.push({
        mint: launch.mint,
        symbol: launch.symbol,
        claimOk: false,
        claimError: "configured fee treasury wallet does not match signer wallet",
      });
      continue;
    }
    const beforeLamports = await connection.getBalance(treasurySigner.publicKey, "confirmed");
    const claim = await claimCreatorFeesViaPumpPortal(launch.mint);
    const afterLamports = await connection.getBalance(treasurySigner.publicKey, "confirmed");
    const claimedLamports = Math.max(0, afterLamports - beforeLamports);
    const whitelistSplitLamports = Math.floor((claimedLamports * launch.whitelistFeeBps) / 10000);
    const holdersSplitLamports = Math.max(0, claimedLamports - whitelistSplitLamports);

    const uniqueWhitelist = Array.from(new Set(launch.whitelistWallets.filter((w) => {
      try {
        new PublicKey(w);
        return true;
      } catch {
        return false;
      }
    })));
    const eachWhitelistLamports =
      uniqueWhitelist.length > 0 ? Math.floor(whitelistSplitLamports / uniqueWhitelist.length) : 0;
    const whitelistTransfers = uniqueWhitelist.map((w) => ({ to: w, lamports: eachWhitelistLamports }));

    const topHoldersRaw = await getTopHoldersByOwner(connection, launch.mint, launch.holderLimit || 100);
    const topHolders = topHoldersRaw.filter((h) => h.owner !== launch.creatorWallet && h.owner !== treasurySigner.publicKey.toBase58());
    const holderTransfers = splitLamportsBySqrtWeight(holdersSplitLamports, topHolders);

    const whitelistSend = await sendLamportTransfers(connection, treasurySigner, whitelistTransfers);
    const holderSend = await sendLamportTransfers(connection, treasurySigner, holderTransfers);
    const totalSentLamports = whitelistSend.lamportsSent + holderSend.lamportsSent;

    await recordFeeDistributionRun({
      mint: launch.mint,
      claimSignature: claim.signature,
      claimOk: claim.ok,
      claimError: claim.ok ? null : claim.error ?? "claim_failed",
      claimedLamports,
      whitelistLamportsSent: whitelistSend.lamportsSent,
      holdersLamportsSent: holderSend.lamportsSent,
      totalSentLamports,
      whitelistTransfersSent: whitelistSend.sent,
      holderTransfersSent: holderSend.sent,
    });

    results.push({
      mint: launch.mint,
      symbol: launch.symbol,
      claimedLamports,
      claimSignature: claim.signature,
      claimOk: claim.ok,
      claimError: claim.ok ? null : claim.error ?? "claim_failed",
      whitelistWallets: uniqueWhitelist.length,
      whitelistFeePercent: launch.whitelistFeeBps / 100,
      holdersFeePercent: launch.holdersFeeBps / 100,
      holderLimit: launch.holderLimit,
      whitelistTransfersSent: whitelistSend.sent,
      holderTransfersSent: holderSend.sent,
      totalSentLamports,
      payoutSignatures: [...whitelistSend.signatures, ...holderSend.signatures],
      status: "claim_and_distribution_executed",
    });
  }

  return NextResponse.json({
    ok: true,
    runs: results.length,
    results,
    note: "Claims and SOL distributions executed. Holder distribution uses top holder accounts (excluding creator) with sqrt-weighted spread.",
  });
}

export async function POST(request: Request) {
  return handleDistribution(request);
}

export async function GET(request: Request) {
  return handleDistribution(request);
}

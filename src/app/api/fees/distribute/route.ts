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
import { listFeeConfiguredLaunches } from "@/lib/drop-launches-db";

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

async function sendLamportTransfers(
  connection: Connection,
  signer: Keypair,
  transfers: Array<{ to: string; lamports: number }>,
): Promise<{ sent: number; signatures: string[] }> {
  const valid = transfers.filter((t) => Number.isFinite(t.lamports) && t.lamports >= MIN_PAYOUT_LAMPORTS);
  let sent = 0;
  const signatures: string[] = [];
  for (let i = 0; i < valid.length; i += TX_BATCH_SIZE) {
    const batch = valid.slice(i, i + TX_BATCH_SIZE);
    const tx = new Transaction();
    for (const t of batch) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: signer.publicKey,
          toPubkey: new PublicKey(t.to),
          lamports: Math.floor(t.lamports),
        }),
      );
    }
    const sig = await connection.sendTransaction(tx, [signer], { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");
    signatures.push(sig);
    sent += batch.length;
  }
  return { sent, signatures };
}

export async function POST(request: Request) {
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

    const topHolders = await getTopHoldersByOwner(connection, launch.mint, launch.holderLimit || 100);
    const totalTopHolderAmount = topHolders.reduce((acc, h) => acc + h.amount, 0n);
    const holderTransfers = totalTopHolderAmount > 0n
      ? topHolders.map((h) => ({
          to: h.owner,
          lamports: Number((BigInt(holdersSplitLamports) * h.amount) / totalTopHolderAmount),
        }))
      : [];

    const whitelistSend = await sendLamportTransfers(connection, treasurySigner, whitelistTransfers);
    const holderSend = await sendLamportTransfers(connection, treasurySigner, holderTransfers);

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
      payoutSignatures: [...whitelistSend.signatures, ...holderSend.signatures],
      status: "claim_and_distribution_executed",
    });
  }

  return NextResponse.json({
    ok: true,
    runs: results.length,
    results,
    note: "Claims and SOL distributions executed. Holder distribution uses top holder token accounts weighted by balance.",
  });
}

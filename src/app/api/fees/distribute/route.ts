import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import bs58 from "bs58";
import {
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
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
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const JUP_SWAP = "https://lite-api.jup.ag/swap/v1/swap";

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
    if (amount <= BigInt(0)) continue;
    byOwner.set(owner, (byOwner.get(owner) ?? BigInt(0)) + amount);
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

async function buyTokenWithSolViaJupiter(
  connection: Connection,
  signer: Keypair,
  mint: string,
  lamportsIn: number,
): Promise<{ ok: boolean; signature: string | null; boughtRaw: bigint; decimals: number; error?: string }> {
  if (!Number.isFinite(lamportsIn) || lamportsIn <= 0) {
    return { ok: false, signature: null, boughtRaw: BigInt(0), decimals: 0, error: "invalid_buy_amount" };
  }
  try {
    const mintPk = new PublicKey(mint);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, signer.publicKey);
    const beforeBal = await connection.getTokenAccountBalance(treasuryAta, "confirmed").catch(() => null);
    const beforeRaw = BigInt(beforeBal?.value?.amount ?? "0");

    const quoteUrl = `${JUP_QUOTE}?inputMint=${encodeURIComponent(SOL_MINT)}&outputMint=${encodeURIComponent(
      mint,
    )}&amount=${encodeURIComponent(String(Math.floor(lamportsIn)))}&slippageBps=1000&restrictIntermediateTokens=true`;
    const quoteRes = await fetch(quoteUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!quoteRes.ok) {
      const txt = await quoteRes.text().catch(() => "quote_failed");
      return { ok: false, signature: null, boughtRaw: BigInt(0), decimals: 0, error: txt || "quote_failed" };
    }
    const quote = (await quoteRes.json()) as Record<string, unknown>;

    const swapRes = await fetch(JUP_SWAP, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: signer.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    if (!swapRes.ok) {
      const txt = await swapRes.text().catch(() => "swap_build_failed");
      return { ok: false, signature: null, boughtRaw: BigInt(0), decimals: 0, error: txt || "swap_build_failed" };
    }
    const swapJson = (await swapRes.json()) as { swapTransaction?: string };
    if (!swapJson.swapTransaction) {
      return { ok: false, signature: null, boughtRaw: BigInt(0), decimals: 0, error: "missing_swap_transaction" };
    }

    const tx = VersionedTransaction.deserialize(Buffer.from(swapJson.swapTransaction, "base64"));
    tx.sign([signer]);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction(sig, "confirmed");

    const mintInfo = await getMint(connection, mintPk, "confirmed", SPL_TOKEN_PROGRAM_ID);
    const afterBal = await connection.getTokenAccountBalance(treasuryAta, "confirmed").catch(() => null);
    const afterRaw = BigInt(afterBal?.value?.amount ?? "0");
    const boughtRaw = afterRaw > beforeRaw ? afterRaw - beforeRaw : BigInt(0);
    return { ok: true, signature: sig, boughtRaw, decimals: mintInfo.decimals };
  } catch (e) {
    return {
      ok: false,
      signature: null,
      boughtRaw: BigInt(0),
      decimals: 0,
      error: e instanceof Error ? e.message : "buyback_failed",
    };
  }
}

function splitRawByBps(totalRaw: bigint, bps: number[]): bigint[] {
  if (totalRaw <= BigInt(0) || bps.length === 0) return [];
  const clean = bps.map((v) => Math.max(0, Math.floor(Number(v) || 0)));
  const sum = clean.reduce((a, b) => a + b, 0);
  if (sum <= 0) return clean.map(() => BigInt(0));
  const out = clean.map((v) => (totalRaw * BigInt(v)) / BigInt(sum));
  const used = out.reduce((a, b) => a + b, BigInt(0));
  const remainder = totalRaw - used;
  if (remainder > BigInt(0) && out.length > 0) out[0] += remainder;
  return out;
}

async function sendTokenAirdrops(
  connection: Connection,
  signer: Keypair,
  mint: string,
  decimals: number,
  transfers: Array<{ to: string; rawAmount: bigint }>,
): Promise<{ sent: number; signatures: string[]; rawSent: bigint }> {
  const mintPk = new PublicKey(mint);
  const sourceAta = await getOrCreateAssociatedTokenAccount(connection, signer, mintPk, signer.publicKey);
  let sent = 0;
  let rawSent = BigInt(0);
  const signatures: string[] = [];
  for (const t of transfers) {
    if (t.rawAmount <= BigInt(0)) continue;
    const toPk = new PublicKey(t.to);
    const destAta = await getOrCreateAssociatedTokenAccount(connection, signer, mintPk, toPk);
    const tx = new Transaction().add(
      createTransferCheckedInstruction(
        sourceAta.address,
        mintPk,
        destAta.address,
        signer.publicKey,
        t.rawAmount,
        decimals,
      ),
    );
    const sig = await connection.sendTransaction(tx, [signer], { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");
    signatures.push(sig);
    sent += 1;
    rawSent += t.rawAmount;
  }
  return { sent, signatures, rawSent };
}

async function handleDistribution(request: Request) {
  const workerSecret = getFeesWorkerSecret();
  if (!workerSecret) return NextResponse.json({ error: "Missing FEES_WORKER_SECRET." }, { status: 500 });
  const auth = request.headers.get("authorization") ?? "";
  const reqUrl = new URL(request.url);
  const secretQuery = reqUrl.searchParams.get("secret")?.trim() ?? "";
  if (auth !== `Bearer ${workerSecret}` && secretQuery !== workerSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
    const buybackLamports =
      launch.devBuyAirdropEnabled && launch.devBuyAirdropBps > 0
        ? Math.floor((claimedLamports * launch.devBuyAirdropBps) / 10000)
        : 0;
    const distributableLamports = Math.max(0, claimedLamports - buybackLamports);
    const whitelistSplitLamports = Math.floor((distributableLamports * launch.whitelistFeeBps) / 10000);
    const holdersSplitLamports = Math.max(0, distributableLamports - whitelistSplitLamports);

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
    let buybackSignature: string | null = null;
    let buybackError: string | null = null;
    let tokenAirdropRaw = BigInt(0);
    let tokenAirdropTransfersSent = 0;
    const tokenAirdropSignatures: string[] = [];
    if (buybackLamports >= Math.floor(0.002 * LAMPORTS_PER_SOL) && uniqueWhitelist.length > 0) {
      const buy = await buyTokenWithSolViaJupiter(connection, treasurySigner, launch.mint, buybackLamports);
      if (buy.ok) {
        buybackSignature = buy.signature;
        const splitBps =
          Array.isArray(launch.devBuyAirdropWalletBps) && launch.devBuyAirdropWalletBps.length === uniqueWhitelist.length
            ? launch.devBuyAirdropWalletBps
            : uniqueWhitelist.map(() => Math.floor(10000 / uniqueWhitelist.length));
        const amounts = splitRawByBps(buy.boughtRaw, splitBps);
        const tokenTransfers = uniqueWhitelist.map((w, i) => ({ to: w, rawAmount: amounts[i] ?? BigInt(0) }));
        const airdropRes = await sendTokenAirdrops(connection, treasurySigner, launch.mint, buy.decimals, tokenTransfers);
        tokenAirdropRaw = airdropRes.rawSent;
        tokenAirdropTransfersSent = airdropRes.sent;
        tokenAirdropSignatures.push(...airdropRes.signatures);
      } else {
        buybackError = buy.error ?? "buyback_failed";
      }
    }
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
      buybackLamports,
      distributableLamports,
      claimSignature: claim.signature,
      claimOk: claim.ok,
      claimError: claim.ok ? null : claim.error ?? "claim_failed",
      buybackSignature,
      buybackError,
      whitelistWallets: uniqueWhitelist.length,
      whitelistFeePercent: launch.whitelistFeeBps / 100,
      holdersFeePercent: launch.holdersFeeBps / 100,
      holderLimit: launch.holderLimit,
      whitelistTransfersSent: whitelistSend.sent,
      holderTransfersSent: holderSend.sent,
      tokenAirdropTransfersSent,
      tokenAirdropRaw: tokenAirdropRaw.toString(),
      totalSentLamports,
      payoutSignatures: [...whitelistSend.signatures, ...holderSend.signatures, ...tokenAirdropSignatures],
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

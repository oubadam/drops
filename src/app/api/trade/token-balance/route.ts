import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

function rpcUrl() {
  return process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
}

function isWalletAddress(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get("wallet") ?? "").trim();
  const mint = (searchParams.get("mint") ?? "").trim();
  if (!isWalletAddress(wallet) || !isWalletAddress(mint)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  try {
    const conn = new Connection(rpcUrl(), "confirmed");
    const owner = new PublicKey(wallet);
    const mintPk = new PublicKey(mint);
    const resp = await conn.getParsedTokenAccountsByOwner(owner, { mint: mintPk }, "confirmed");
    let amountRaw = "0";
    let decimals = 0;
    let uiAmount = 0;
    for (const it of resp.value) {
      const info = it.account.data.parsed.info.tokenAmount as
        | { amount?: string; decimals?: number; uiAmount?: number | null }
        | undefined;
      const amt = Number(info?.amount ?? "0");
      if (!Number.isFinite(amt) || amt <= 0) continue;
      amountRaw = info?.amount ?? "0";
      decimals = Number(info?.decimals ?? 0);
      uiAmount = Number(info?.uiAmount ?? 0);
      break;
    }
    return NextResponse.json({ wallet, mint, amountRaw, decimals, uiAmount }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "token_balance_failed" }, { status: 500 });
  }
}


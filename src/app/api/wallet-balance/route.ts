import { NextResponse } from "next/server";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

const COINGECKO_SOL_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

function isWalletAddress(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function rpcUrl() {
  return process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get("wallet") ?? "").trim();
  if (!wallet || !isWalletAddress(wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  try {
    const conn = new Connection(rpcUrl(), "confirmed");
    const lamports = await conn.getBalance(new PublicKey(wallet));
    const sol = lamports / LAMPORTS_PER_SOL;

    let usdPrice = 0;
    try {
      const priceRes = await fetch(COINGECKO_SOL_URL, { next: { revalidate: 30 } });
      if (priceRes.ok) {
        const price = (await priceRes.json()) as { solana?: { usd?: number } };
        usdPrice = Number(price.solana?.usd ?? 0);
      }
    } catch {
      usdPrice = 0;
    }

    return NextResponse.json({
      wallet,
      sol,
      usd: sol * usdPrice,
      usdPrice,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "wallet_balance_failed" }, { status: 500 });
  }
}

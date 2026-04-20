import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

import { getSolanaRpcUrl } from "@/lib/env";
import { decodePumpBondingCurveAccount } from "@/lib/pump-bonding-curve-decode";

const PUMP_FRONT = "https://frontend-api-v3.pump.fun";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

async function fetchBondingCurveAccountData(rpcUrl: string, pubkey: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [pubkey, { encoding: "base64", commitment: "confirmed" }],
      }),
    });
    const j = (await res.json()) as {
      result?: { value?: { data?: [string, string] | null } | null };
    };
    const b64 = j.result?.value?.data?.[0];
    if (!b64) return null;
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  const empty = {
    indexed: false,
    complete: false,
    usdMarketCap: null,
    athMarketCap: null,
    bondingProgress: null as number | null,
    realSolLamports: null as number | null,
  };
  if (!mint || mint.length < 20) {
    return NextResponse.json(empty, { status: 400 });
  }

  try {
    const upstream = await fetch(`${PUMP_FRONT}/coins/${encodeURIComponent(mint)}`, {
      headers: { Accept: "application/json" },
    });

    if (upstream.status === 404) {
      return NextResponse.json(empty);
    }
    if (!upstream.ok) {
      return NextResponse.json(empty);
    }

    const data = (await upstream.json()) as Record<string, unknown>;
    const usd = num(data.usd_market_cap);
    const ath = num(data.ath_market_cap);
    const completeApi = Boolean(data.complete);
    const bondingCurve = typeof data.bonding_curve === "string" ? data.bonding_curve : null;

    let bondingProgress: number | null = null;
    let realSolLamports: number | null = null;
    let completeChain = false;

    if (!completeApi && bondingCurve) {
      const raw = await fetchBondingCurveAccountData(getSolanaRpcUrl(), bondingCurve);
      if (raw) {
        const dec = decodePumpBondingCurveAccount(raw);
        if (dec) {
          bondingProgress = dec.bondingProgress;
          completeChain = dec.complete;
          const rs = dec.realSolLamports;
          realSolLamports = rs <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rs) : null;
        }
      }
    } else if (completeApi) {
      bondingProgress = 1;
    }

    const complete = completeApi || completeChain;

    return NextResponse.json({
      indexed: true,
      complete,
      usdMarketCap: usd != null && usd >= 0 ? usd : null,
      athMarketCap: ath != null && ath > 0 ? ath : null,
      bondingProgress,
      realSolLamports,
    });
  } catch {
    return NextResponse.json(empty);
  }
}

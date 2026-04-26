import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const JUP_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      side?: "buy" | "sell";
      mint?: string;
      amount?: string;
      slippageBps?: number;
    };
    const side = body.side === "sell" ? "sell" : "buy";
    const mint = String(body.mint ?? "").trim();
    const amount = String(body.amount ?? "").trim();
    const slippageBps = Number.isFinite(body.slippageBps) ? Number(body.slippageBps) : 100;
    if (!mint || mint.length < 20) return NextResponse.json({ error: "Invalid mint" }, { status: 400 });
    if (!amount || !/^\d+$/.test(amount) || amount === "0") {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const inputMint = side === "buy" ? SOL_MINT : mint;
    const outputMint = side === "buy" ? mint : SOL_MINT;
    const url = `${JUP_QUOTE}?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(
      outputMint,
    )}&amount=${encodeURIComponent(amount)}&slippageBps=${Math.max(10, Math.min(10000, slippageBps))}&restrictIntermediateTokens=true`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ error: txt || "Quote unavailable" }, { status: 502 });
    }
    const quote = (await res.json()) as Record<string, unknown>;
    return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
  }
}


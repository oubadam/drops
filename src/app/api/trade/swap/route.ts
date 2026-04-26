import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const JUP_SWAP = "https://lite-api.jup.ag/swap/v1/swap";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      quoteResponse?: Record<string, unknown>;
      userPublicKey?: string;
    };
    const quoteResponse = body.quoteResponse;
    const userPublicKey = String(body.userPublicKey ?? "").trim();
    if (!quoteResponse || typeof quoteResponse !== "object") {
      return NextResponse.json({ error: "Missing quote response" }, { status: 400 });
    }
    if (!userPublicKey || userPublicKey.length < 20) {
      return NextResponse.json({ error: "Invalid user public key" }, { status: 400 });
    }

    const res = await fetch(JUP_SWAP, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ error: txt || "Swap transaction unavailable" }, { status: 502 });
    }
    const json = (await res.json()) as { swapTransaction?: string };
    if (!json.swapTransaction) return NextResponse.json({ error: "Missing swap transaction" }, { status: 502 });
    return NextResponse.json({ swapTransaction: json.swapTransaction }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to build swap transaction" }, { status: 500 });
  }
}


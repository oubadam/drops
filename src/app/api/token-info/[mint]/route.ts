import { NextResponse } from "next/server";

const PUMP_FRONT = "https://frontend-api-v3.pump.fun";

export const dynamic = "force-dynamic";

function fallbackTokenInfo(mint: string) {
  return {
    mint,
    name: mint.slice(0, 8),
    symbol: "TOKEN",
    description: "",
    imageUrl: "",
    creatorWallet: "",
    createdAt: new Date().toISOString(),
    twitter: "",
    telegram: "",
    website: "",
    partial: true,
  };
}

export async function GET(_request: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!mint || mint.length < 20) {
    return NextResponse.json({ error: "invalid_mint" }, { status: 400 });
  }

  try {
    const signal = AbortSignal.timeout(2800);
    const res = await fetch(`${PUMP_FRONT}/coins/${encodeURIComponent(mint)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!res.ok) return NextResponse.json(fallbackTokenInfo(mint));
    const data = (await res.json()) as Record<string, unknown>;
    const imageRaw =
      data.image_uri ?? data.imageUri ?? data.image ?? data.image_url ?? data.imageUrl ?? "";
    return NextResponse.json({
      mint,
      name: String(data.name ?? ""),
      symbol: String(data.symbol ?? ""),
      description: String(data.description ?? ""),
      imageUrl: String(imageRaw ?? ""),
      creatorWallet: String(data.creator ?? ""),
      createdAt: String(data.created_timestamp ?? data.createdTimestamp ?? ""),
      twitter: String(data.twitter ?? ""),
      telegram: String(data.telegram ?? ""),
      website: String(data.website ?? ""),
    });
  } catch {
    return NextResponse.json(fallbackTokenInfo(mint));
  }
}

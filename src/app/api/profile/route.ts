import { NextResponse } from "next/server";
import { getDropProfileByWallet, upsertDropProfile } from "@/lib/drop-profiles-db";

export const dynamic = "force-dynamic";

function isWalletAddress(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function defaultUsername(wallet: string) {
  return `@${wallet.slice(0, 6)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get("wallet") ?? "").trim();
  if (!wallet || !isWalletAddress(wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const existing = await getDropProfileByWallet(wallet);
  if (!existing) {
    return NextResponse.json({
      profile: {
        walletAddress: wallet,
        username: defaultUsername(wallet),
        bio: "",
        avatarUrl: "",
      },
    });
  }
  return NextResponse.json({ profile: existing });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    walletAddress?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
  };
  const walletAddress = (body.walletAddress ?? "").trim();
  if (!walletAddress || !isWalletAddress(walletAddress)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const username = (body.username ?? "").trim().slice(0, 24);
  const bio = (body.bio ?? "").trim().slice(0, 280);
  const avatarUrl = (body.avatarUrl ?? "").trim();
  if (!username) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  const saved = await upsertDropProfile({
    walletAddress,
    username,
    bio,
    avatarUrl,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 500 });
  }
  return NextResponse.json({ profile: saved.profile });
}

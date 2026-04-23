import { NextResponse } from "next/server";
import { getDropProfileByUsername, getDropProfileByWallet, upsertDropProfile } from "@/lib/drop-profiles-db";

export const dynamic = "force-dynamic";

function isWalletAddress(v: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function defaultUsername(wallet: string) {
  return `@${wallet.slice(0, 6)}`;
}

const USERNAME_RULES_ERROR =
  "Username must start and end with a letter or number, can contain periods, underscores and hyphens (but not consecutively), and no special characters at the beginning or end";
const USERNAME_COOLDOWN_ERROR = "Username can only be changed once every 24 hours.";
const USERNAME_TAKEN_ERROR = "That username is already taken.";
const PROFILES_TABLE_MISSING_ERROR =
  "Profiles table is missing in Supabase. Run migration: web/supabase/migrations/20260420000000_drop_profiles.sql";
const USERNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isValidUsername(username: string): boolean {
  return /^(?=.{1,15}$)(?!.*[._-]{2})[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(username);
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, "");
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
  const username = normalizeUsername((body.username ?? "").slice(0, 15));
  const bio = (body.bio ?? "").trim().slice(0, 280);
  const avatarUrl = (body.avatarUrl ?? "").trim();
  if (!username || !isValidUsername(username)) {
    return NextResponse.json({ error: "invalid_username", message: USERNAME_RULES_ERROR }, { status: 400 });
  }
  const existing = await getDropProfileByWallet(walletAddress);
  if (existing) {
    const oldUsername = normalizeUsername(existing.username);
    const usernameChanged = oldUsername !== username;
    if (usernameChanged) {
      const lastUpdatedAt = new Date(existing.updatedAt).getTime();
      if (Number.isFinite(lastUpdatedAt) && Date.now() - lastUpdatedAt < USERNAME_COOLDOWN_MS) {
        return NextResponse.json({ error: "username_cooldown", message: USERNAME_COOLDOWN_ERROR }, { status: 429 });
      }
    }
  }
  const usernameOwner = await getDropProfileByUsername(username);
  if (usernameOwner && usernameOwner.walletAddress !== walletAddress) {
    return NextResponse.json({ error: "username_taken", message: USERNAME_TAKEN_ERROR }, { status: 409 });
  }
  const saved = await upsertDropProfile({
    walletAddress,
    username,
    bio,
    avatarUrl,
  });
  if (!saved.ok) {
    if (saved.error.includes("drop_profiles") || saved.error.toLowerCase().includes("schema cache")) {
      return NextResponse.json({ error: "profiles_table_missing", message: PROFILES_TABLE_MISSING_ERROR }, { status: 500 });
    }
    return NextResponse.json({ error: saved.error }, { status: 500 });
  }
  return NextResponse.json({ profile: saved.profile });
}

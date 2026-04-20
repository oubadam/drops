"use client";

export type PersistedProfile = {
  walletAddress: string;
  username: string;
  bio: string;
  avatarUrl: string;
};

export type WalletBalance = {
  wallet: string;
  sol: number;
  usd: number;
  usdPrice: number;
};

export function defaultUsernameFromWallet(wallet: string) {
  return `@${wallet.slice(0, 6)}`;
}

export async function fetchProfile(wallet: string): Promise<PersistedProfile> {
  const res = await fetch(`/api/profile?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("profile_fetch_failed");
  const json = (await res.json()) as { profile: PersistedProfile };
  return json.profile;
}

export async function saveProfile(input: PersistedProfile): Promise<PersistedProfile> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("profile_save_failed");
  const json = (await res.json()) as { profile: PersistedProfile };
  return json.profile;
}

export async function fetchWalletBalance(wallet: string): Promise<WalletBalance> {
  const res = await fetch(`/api/wallet-balance?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("wallet_balance_fetch_failed");
  return (await res.json()) as WalletBalance;
}

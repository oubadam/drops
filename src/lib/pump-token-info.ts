import type { CreatedCoinRecord } from "@/lib/created-coins-storage";

/** Normalize pump `created_timestamp` (seconds or ms) to ISO string. */
export function pumpCreatedAtToIso(raw: unknown): string {
  if (raw == null || raw === "") return new Date().toISOString();
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    const d = new Date(String(raw));
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  }
  const ms = n < 1_000_000_000_000 ? n * 1000 : n;
  return new Date(ms).toISOString();
}

export type PumpTokenInfoPayload = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  creatorWallet: string;
  createdAt: string;
  twitter?: string;
  telegram?: string;
  website?: string;
};

export function pumpTokenInfoToCreatedRecord(p: PumpTokenInfoPayload): CreatedCoinRecord {
  return {
    mint: p.mint,
    name: p.name || p.mint.slice(0, 8),
    symbol: p.symbol || "TOKEN",
    description: p.description || undefined,
    imageUrl: p.imageUrl || undefined,
    creatorWallet: p.creatorWallet || undefined,
    createdAt: pumpCreatedAtToIso(p.createdAt),
  };
}

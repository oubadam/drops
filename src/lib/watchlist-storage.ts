import { getHiddenMints } from "@/lib/drop-coins";

export const WATCHLIST_MINTS_KEY = "drop_watchlist_mints_v1";
export const WATCHLIST_UPDATED_EVENT = "drop-watchlist-updated";

export function loadWatchlistMints(): string[] {
  if (typeof window === "undefined") return [];
  const hidden = getHiddenMints();
  try {
    const raw = window.localStorage.getItem(WATCHLIST_MINTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter((x): x is string => typeof x === "string" && x.length > 0 && !hidden.has(x));
    if (filtered.length !== parsed.length) {
      window.localStorage.setItem(WATCHLIST_MINTS_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

export function isMintWatchlisted(mint: string): boolean {
  return loadWatchlistMints().includes(mint);
}

/** Returns true if mint is watchlisted after toggle. */
export function toggleWatchlistMint(mint: string): boolean {
  if (typeof window === "undefined") return false;
  const prev = loadWatchlistMints();
  const has = prev.includes(mint);
  const next = has ? prev.filter((m) => m !== mint) : [mint, ...prev].slice(0, 200);
  window.localStorage.setItem(WATCHLIST_MINTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(WATCHLIST_UPDATED_EVENT));
  return !has;
}

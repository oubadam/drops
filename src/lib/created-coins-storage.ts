import { getHiddenMints } from "@/lib/drop-coins";

export const CREATED_COINS_KEY = "drop_created_coins_v1";
export const PROFILE_USERNAME_KEY = "drop_profile_username_v1";

export type CreatedCoinRecord = {
  mint: string;
  name: string;
  symbol: string;
  creatorWallet?: string;
  signature?: string;
  createdAt: string;
  description?: string;
  imageUrl?: string;
};

export const DROP_COINS_UPDATED_EVENT = "drop-coins-updated";

export function loadCreatedCoins(): CreatedCoinRecord[] {
  if (typeof window === "undefined") return [];
  const hidden = getHiddenMints();
  try {
    const raw = window.localStorage.getItem(CREATED_COINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreatedCoinRecord[];
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter((c) => c?.mint && !hidden.has(c.mint));
    if (filtered.length !== parsed.length) {
      window.localStorage.setItem(CREATED_COINS_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

export function prependCreatedCoin(record: CreatedCoinRecord) {
  if (typeof window === "undefined") return;
  const prev = loadCreatedCoins();
  const next = [record, ...prev.filter((c) => c.mint !== record.mint)].slice(0, 50);
  window.localStorage.setItem(CREATED_COINS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(DROP_COINS_UPDATED_EVENT));
}

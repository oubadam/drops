import { loadCreatedCoins, type CreatedCoinRecord } from "@/lib/created-coins-storage";
import { getHiddenMints } from "@/lib/drop-coins";

function dedupeByMint(rows: CreatedCoinRecord[]): CreatedCoinRecord[] {
  const out: CreatedCoinRecord[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r?.mint || seen.has(r.mint)) continue;
    seen.add(r.mint);
    out.push(r);
  }
  return out;
}

/**
 * Canonical drops launches from Supabase via `/api/launches` when configured;
 * otherwise the same browser’s localStorage list (dev / no DB).
 */
export async function loadDropLaunchesForUi(): Promise<CreatedCoinRecord[]> {
  const hidden = getHiddenMints();
  const local = loadCreatedCoins();
  try {
    const c = new AbortController();
    const t = window.setTimeout(() => c.abort(), 2500);
    const res = await fetch("/api/launches", { cache: "no-store", signal: c.signal });
    window.clearTimeout(t);
    if (!res.ok) return dedupeByMint(local).filter((r) => !hidden.has(r.mint));
    const j = (await res.json()) as { configured?: boolean; items?: CreatedCoinRecord[] };
    if (j.configured && Array.isArray(j.items)) {
      // Show DB launches and immediately include newly-created local coins.
      return dedupeByMint([...local, ...j.items]).filter((r) => !hidden.has(r.mint));
    }
  } catch {
    /* network / SSR guard */
  }
  return dedupeByMint(local).filter((r) => !hidden.has(r.mint));
}

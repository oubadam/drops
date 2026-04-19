import { loadCreatedCoins, type CreatedCoinRecord } from "@/lib/created-coins-storage";
import { filterDropLaunches } from "@/lib/drop-coins";

/**
 * Canonical drops launches from Supabase via `/api/launches` when configured;
 * otherwise the same browser’s localStorage list (dev / no DB).
 */
export async function loadDropLaunchesForUi(): Promise<CreatedCoinRecord[]> {
  try {
    const res = await fetch("/api/launches", { cache: "no-store" });
    if (!res.ok) return filterDropLaunches(loadCreatedCoins());
    const j = (await res.json()) as { configured?: boolean; items?: CreatedCoinRecord[] };
    if (j.configured && Array.isArray(j.items)) return j.items;
  } catch {
    /* network / SSR guard */
  }
  return filterDropLaunches(loadCreatedCoins());
}

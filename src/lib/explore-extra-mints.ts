import { getHiddenMints } from "@/lib/drop-coins";

/** Optional comma-separated mints to show in Explore/Trending (for testing or featured coins). */
export function readExploreExtraMints(): string[] {
  const raw = process.env.NEXT_PUBLIC_EXPLORE_EXTRA_MINTS?.trim() ?? "";
  if (!raw) return [];
  const hidden = getHiddenMints();
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length >= 32 && !hidden.has(s)),
    ),
  );
}

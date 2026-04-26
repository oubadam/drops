/** Optional comma-separated mints to show in Explore/Trending (for testing or featured coins). */
export function readExploreExtraMints(): string[] {
  const raw = process.env.NEXT_PUBLIC_EXPLORE_EXTRA_MINTS?.trim() ?? "";
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length >= 32),
    ),
  );
}

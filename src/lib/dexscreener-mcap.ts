type DexTxnBucket = { buys?: number; sells?: number } | undefined;
type DexPair = {
  chainId?: string;
  dexId?: string;
  marketCap?: number;
  fdv?: number;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: { m5?: DexTxnBucket; h1?: DexTxnBucket; h6?: DexTxnBucket; h24?: DexTxnBucket };
};

type DexResponse = { pairs?: DexPair[] | null };

export type DexTokenStats = {
  mcapUsd: number | null;
  volumeUsd24h: number | null;
};

export type SolanaPairExploreStats = DexTokenStats & {
  dexId: string | null;
  fdvUsd: number | null;
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  txnsH24: number | null;
};

function sumTxnBucket(bucket: DexTxnBucket): number | null {
  if (!bucket || typeof bucket !== "object") return null;
  const b = typeof bucket.buys === "number" && Number.isFinite(bucket.buys) ? bucket.buys : 0;
  const s = typeof bucket.sells === "number" && Number.isFinite(bucket.sells) ? bucket.sells : 0;
  if (b <= 0 && s <= 0) return null;
  return b + s;
}

function pairExploreFromBest(bestPair: DexPair | null): Omit<SolanaPairExploreStats, keyof DexTokenStats> {
  if (!bestPair) {
    return {
      dexId: null,
      fdvUsd: null,
      priceChange: { m5: null, h1: null, h6: null, h24: null },
      txnsH24: null,
    };
  }
  const pc = bestPair.priceChange;
  const pick = (k: keyof NonNullable<DexPair["priceChange"]>): number | null => {
    const v = pc?.[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const fdv =
    typeof bestPair.fdv === "number" && Number.isFinite(bestPair.fdv) && bestPair.fdv > 0 ? bestPair.fdv : null;
  return {
    dexId: typeof bestPair.dexId === "string" && bestPair.dexId ? bestPair.dexId : null,
    fdvUsd: fdv,
    priceChange: {
      m5: pick("m5"),
      h1: pick("h1"),
      h6: pick("h6"),
      h24: pick("h24"),
    },
    txnsH24: sumTxnBucket(bestPair.txns?.h24),
  };
}

/** Richest Solana pair by mcap for UI (explore table, bonding dex, etc.). */
export async function fetchSolanaTokenPairExploreStats(mint: string): Promise<SolanaPairExploreStats> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
  const empty: SolanaPairExploreStats = {
    mcapUsd: null,
    volumeUsd24h: null,
    dexId: null,
    fdvUsd: null,
    priceChange: { m5: null, h1: null, h6: null, h24: null },
    txnsH24: null,
  };
  try {
    const res = await fetch(url);
    if (!res.ok) return empty;
    const data = (await res.json()) as DexResponse;
    const pairs = data.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return empty;
    let best = 0;
    let bestPair: DexPair | null = null;
    for (const p of pairs) {
      if (p.chainId && p.chainId !== "solana") continue;
      const base = p.baseToken?.address;
      const quote = p.quoteToken?.address;
      if (base !== mint && quote !== mint) continue;
      const m = typeof p.marketCap === "number" ? p.marketCap : typeof p.fdv === "number" ? p.fdv : 0;
      if (m > best) {
        best = m;
        bestPair = p;
      }
    }
    const mcapUsd = best > 0 ? best : null;
    const v =
      bestPair && typeof bestPair.volume?.h24 === "number" && Number.isFinite(bestPair.volume.h24)
        ? bestPair.volume.h24
        : null;
    const volumeUsd24h = v != null && v > 0 ? v : null;
    const rest = pairExploreFromBest(bestPair);
    return { mcapUsd, volumeUsd24h, ...rest };
  } catch {
    return empty;
  }
}

/** Best USD mcap + 24h volume from the highest-mcap Solana pair (DexScreener public API). */
export async function fetchSolanaTokenDexStats(mint: string): Promise<DexTokenStats> {
  const s = await fetchSolanaTokenPairExploreStats(mint);
  return { mcapUsd: s.mcapUsd, volumeUsd24h: s.volumeUsd24h };
}

/** Best USD market cap for a Solana mint from DexScreener (public API). */
export async function fetchSolanaTokenBestMcapUsd(mint: string): Promise<number | null> {
  const { mcapUsd } = await fetchSolanaTokenDexStats(mint);
  return mcapUsd;
}

export function formatMcapUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export function formatVolumeUsd24h(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** Rounded shorthand for filter UI ($1.00K, $2.92M, $50.00M). */
export function formatUsdFilterCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "$0";
  if (n === 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${Math.round(n)}`;
}

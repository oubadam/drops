type DexTxnBucket = { buys?: number; sells?: number } | undefined;
type DexPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
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
  pairAddress: string | null;
  priceUsd: number | null;
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

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pairExploreFromBest(bestPair: DexPair | null): Omit<SolanaPairExploreStats, keyof DexTokenStats> {
  if (!bestPair) {
    return {
      dexId: null,
      pairAddress: null,
      priceUsd: null,
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
    pairAddress: typeof bestPair.pairAddress === "string" && bestPair.pairAddress ? bestPair.pairAddress : null,
    priceUsd:
      typeof bestPair.priceUsd === "string" && Number.isFinite(Number(bestPair.priceUsd))
        ? Number(bestPair.priceUsd)
        : null,
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
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const empty: SolanaPairExploreStats = {
    mcapUsd: null,
    volumeUsd24h: null,
    dexId: null,
    pairAddress: null,
    priceUsd: null,
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
    let bestSol = 0;
    let bestSolPair: DexPair | null = null;
    let bestVolume = 0;
    let bestVolumePair: DexPair | null = null;
    const relevantPairs: DexPair[] = [];
    for (const p of pairs) {
      if (p.chainId && p.chainId !== "solana") continue;
      const base = p.baseToken?.address;
      const quote = p.quoteToken?.address;
      if (base !== mint && quote !== mint) continue;
      relevantPairs.push(p);
      const m = typeof p.marketCap === "number" ? p.marketCap : typeof p.fdv === "number" ? p.fdv : 0;
      if (m > best) {
        best = m;
        bestPair = p;
      }
      const usesSolQuote = base === mint && quote === SOL_MINT;
      if (usesSolQuote && m > bestSol) {
        bestSol = m;
        bestSolPair = p;
      }
      const v24 = numOrNull(p.volume?.h24) ?? 0;
      if (v24 > bestVolume) {
        bestVolume = v24;
        bestVolumePair = p;
      }
    }
    if (relevantPairs.length === 0) return empty;
    if (bestSolPair) bestPair = bestSolPair;
    const chosenM =
      bestPair && typeof bestPair.marketCap === "number"
        ? bestPair.marketCap
        : bestPair && typeof bestPair.fdv === "number"
          ? bestPair.fdv
          : best;
    const mcapUsd = chosenM > 0 ? chosenM : null;
    const v = numOrNull(bestVolumePair?.volume?.h24) ?? numOrNull(bestPair?.volume?.h24);
    const volumeUsd24h = v != null && v > 0 ? v : null;
    const statSource = bestVolumePair ?? bestPair;
    const baseRest = pairExploreFromBest(statSource);
    const fallbackChange = {
      m5: baseRest.priceChange.m5,
      h1: baseRest.priceChange.h1,
      h6: baseRest.priceChange.h6,
      h24: baseRest.priceChange.h24,
    };
    for (const p of relevantPairs) {
      if (fallbackChange.m5 == null) fallbackChange.m5 = numOrNull(p.priceChange?.m5);
      if (fallbackChange.h1 == null) fallbackChange.h1 = numOrNull(p.priceChange?.h1);
      if (fallbackChange.h6 == null) fallbackChange.h6 = numOrNull(p.priceChange?.h6);
      if (fallbackChange.h24 == null) fallbackChange.h24 = numOrNull(p.priceChange?.h24);
      if (fallbackChange.m5 != null && fallbackChange.h1 != null && fallbackChange.h6 != null && fallbackChange.h24 != null) {
        break;
      }
    }
    const rest = {
      ...baseRest,
      priceChange: fallbackChange,
    };
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

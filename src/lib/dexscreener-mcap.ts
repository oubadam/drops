type DexPair = {
  chainId?: string;
  marketCap?: number;
  fdv?: number;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
};

type DexResponse = { pairs?: DexPair[] | null };

/** Best USD market cap for a Solana mint from DexScreener (public API). */
export async function fetchSolanaTokenBestMcapUsd(mint: string): Promise<number | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as DexResponse;
    const pairs = data.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    let best = 0;
    for (const p of pairs) {
      if (p.chainId && p.chainId !== "solana") continue;
      const base = p.baseToken?.address;
      const quote = p.quoteToken?.address;
      if (base !== mint && quote !== mint) continue;
      const m = typeof p.marketCap === "number" ? p.marketCap : typeof p.fdv === "number" ? p.fdv : 0;
      if (m > best) best = m;
    }
    return best > 0 ? best : null;
  } catch {
    return null;
  }
}

export function formatMcapUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

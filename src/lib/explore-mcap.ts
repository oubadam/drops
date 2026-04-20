import { formatMcapUsd } from "@/lib/dexscreener-mcap";
import type { ExploreEnrichedCoin } from "@/lib/explore-coin-types";

/**
 * USD market cap for explore UI + filters: uses pump.fun `usd_market_cap` when the mint is
 * indexed there (matches pump UI), otherwise DexScreener best pair mcap.
 */
export function exploreMcapUsd(coin: ExploreEnrichedCoin): number {
  if (
    coin.pump.indexed &&
    coin.pump.usdMarketCap != null &&
    Number.isFinite(coin.pump.usdMarketCap) &&
    coin.pump.usdMarketCap > 0
  ) {
    return coin.pump.usdMarketCap;
  }
  return coin.mcap ?? 0;
}

export function formatExploreMcap(coin: ExploreEnrichedCoin): string {
  return formatMcapUsd(exploreMcapUsd(coin));
}

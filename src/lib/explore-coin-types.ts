import type { CreatedCoinRecord } from "@/lib/created-coins-storage";
import type { PumpFrontCoinState } from "@/lib/pump-front-api";

export type ExploreEnrichedCoin = CreatedCoinRecord & {
  mcap: number | null;
  vol24h: number | null;
  dexId: string | null;
  pairAddress?: string | null;
  priceUsd?: number | null;
  fdvUsd: number | null;
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  txnsH24: number | null;
  /** pump.fun `frontend-api-v3` coin snapshot (bonding / ATH, etc.). */
  pump: PumpFrontCoinState;
};

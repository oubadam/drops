/**
 * pump.fun public HTTP API (same source as pump.fun UI), plus on-chain bonding curve
 * fields resolved in `/api/pump-coin/...` (RPC read of `BondingCurve` account).
 */
export type PumpFrontCoinState = {
  indexed: boolean;
  /** `true` when the bonding curve has finished / coin has graduated on pump. */
  complete: boolean;
  usdMarketCap: number | null;
  athMarketCap: number | null;
  /**
   * 0–1: fraction of initial `real_token_reserves` sold (from on-chain curve), or `1` when `complete`.
   * `null` if the curve account could not be read (RPC miss / wrong layout / not a launchpad coin).
   */
  bondingProgress: number | null;
  /** SOL in the curve (`real_sol_reserves`, lamports). */
  realSolLamports: number | null;
};

export const EMPTY_PUMP_FRONT_STATE: PumpFrontCoinState = {
  indexed: false,
  complete: false,
  usdMarketCap: null,
  athMarketCap: null,
  bondingProgress: null,
  realSolLamports: null,
};

export async function fetchPumpFrontCoinState(mint: string): Promise<PumpFrontCoinState> {
  try {
    const res = await fetch(`/api/pump-coin/${encodeURIComponent(mint)}`);
    if (!res.ok) return { ...EMPTY_PUMP_FRONT_STATE };
    const data = (await res.json()) as Partial<PumpFrontCoinState>;
    return {
      indexed: Boolean(data.indexed),
      complete: Boolean(data.complete),
      usdMarketCap:
        typeof data.usdMarketCap === "number" && Number.isFinite(data.usdMarketCap) && data.usdMarketCap >= 0
          ? data.usdMarketCap
          : null,
      athMarketCap:
        typeof data.athMarketCap === "number" && Number.isFinite(data.athMarketCap) && data.athMarketCap > 0
          ? data.athMarketCap
          : null,
      bondingProgress:
        typeof data.bondingProgress === "number" && Number.isFinite(data.bondingProgress)
          ? Math.min(1, Math.max(0, data.bondingProgress))
          : null,
      realSolLamports:
        typeof data.realSolLamports === "number" && Number.isFinite(data.realSolLamports) && data.realSolLamports >= 0
          ? data.realSolLamports
          : null,
    };
  } catch {
    return { ...EMPTY_PUMP_FRONT_STATE };
  }
}

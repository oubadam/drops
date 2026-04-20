import type { PumpFrontCoinState } from "@/lib/pump-front-api";

function dexLooksPostPump(dexId: string | null): boolean {
  if (!dexId) return false;
  const d = dexId.toLowerCase();
  return !d.includes("pump");
}

/**
 * Bonding UI prefers **on-chain** `bondingProgress` from the pump `BondingCurve` account (token sold
 * from the curve vs initial real token reserves — SOL price only affects USD labels, not this %).
 * Falls back to Dex venue heuristics only when pump data / RPC decode is unavailable.
 */
export function bondingVisualState(
  pump: PumpFrontCoinState,
  dexMcapUsd: number | null,
  dexId: string | null,
): { mode: "bonding" | "bonded"; progress: number } {
  if (pump.indexed && pump.complete) {
    return { mode: "bonded", progress: 1 };
  }

  if (pump.indexed && pump.bondingProgress != null) {
    const p = pump.bondingProgress;
    return { mode: "bonding", progress: Math.max(0.04, Math.min(1, p)) };
  }

  if (dexLooksPostPump(dexId)) {
    return { mode: "bonded", progress: 1 };
  }

  if (pump.indexed && !pump.complete) {
    return { mode: "bonding", progress: 0.08 };
  }

  const m = dexMcapUsd ?? 0;
  if (m <= 0) {
    return { mode: "bonding", progress: 0.08 };
  }
  return { mode: "bonding", progress: 0.12 };
}

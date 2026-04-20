/**
 * On-chain layout for pump program `BondingCurve` (Anchor), matching pump-public-docs IDL.
 * @see https://github.com/pump-fun/pump-public-docs
 *
 * Bonding completion is defined on-chain as `real_token_reserves == 0` (then `complete` is set).
 * Progress is the fraction of **initial real token reserves** already sold from the curve.
 * Initial real reserves for a standard curve are `token_total_supply * 7931 / 10000` (same ratio
 * as `Global.initial_real_token_reserves` / `Global.token_total_supply` on mainnet).
 */

export const PUMP_BONDING_CURVE_DISCRIMINATOR = Uint8Array.from([0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0xac, 0x60]);

/** `Global.initial_real_token_reserves` / `Global.token_total_supply` on mainnet (basis points). */
export const PUMP_INITIAL_REAL_TOKEN_BPS = BigInt(7931);

function readU64LE(data: Uint8Array, offset: number): bigint {
  let x = BigInt(0);
  for (let i = 0; i < 8; i++) x |= BigInt(data[offset + i]!) << (BigInt(8) * BigInt(i));
  return x;
}

export type DecodedPumpBondingCurve = {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolLamports: bigint;
  tokenTotalSupply: bigint;
  /** From account `complete` flag (or inferred when `real_token_reserves` is 0). */
  complete: boolean;
  /** 0–1 = share of initial real token reserves sold from the curve. */
  bondingProgress: number;
};

export function decodePumpBondingCurveAccount(data: Uint8Array): DecodedPumpBondingCurve | null {
  if (data.byteLength < 49) return null;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PUMP_BONDING_CURVE_DISCRIMINATOR[i]) return null;
  }

  const virtualTokenReserves = readU64LE(data, 8);
  const virtualSolReserves = readU64LE(data, 16);
  const realTokenReserves = readU64LE(data, 24);
  const realSolLamports = readU64LE(data, 32);
  const tokenTotalSupply = readU64LE(data, 40);
  const flagByte = data[48] ?? 0;
  const complete = flagByte !== 0 || realTokenReserves === BigInt(0);

  if (tokenTotalSupply <= BigInt(0)) return null;

  const initialRealTokenReserves = (tokenTotalSupply * PUMP_INITIAL_REAL_TOKEN_BPS) / BigInt(10000);
  if (initialRealTokenReserves <= BigInt(0)) return null;

  let bondingProgress: number;
  if (complete) {
    bondingProgress = 1;
  } else {
    const sold =
      initialRealTokenReserves > realTokenReserves ? initialRealTokenReserves - realTokenReserves : BigInt(0);
    bondingProgress = Number(sold) / Number(initialRealTokenReserves);
    if (!Number.isFinite(bondingProgress)) return null;
    bondingProgress = Math.min(1, Math.max(0, bondingProgress));
  }

  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolLamports,
    tokenTotalSupply,
    complete,
    bondingProgress,
  };
}

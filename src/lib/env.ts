export function getPumpPortalApiKey() {
  return process.env.PUMPPORTAL_API_KEY ?? "";
}

export function getPinataJwt() {
  return process.env.PINATA_JWT ?? "";
}

/** Mainnet JSON-RPC for reading pump `BondingCurve` accounts (optional; defaults to public mainnet). */
export function getSolanaRpcUrl() {
  return process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
}

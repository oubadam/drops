export function getPumpPortalApiKey() {
  return process.env.PUMPPORTAL_API_KEY ?? "";
}

export function getPinataJwt() {
  return process.env.PINATA_JWT ?? "";
}

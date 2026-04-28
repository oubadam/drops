import type { CreatedCoinRecord } from "@/lib/created-coins-storage";

export const DROP_MINT_SUFFIX = "drop";
const HARD_BLOCKED_MINTS = new Set<string>([
  "2ra5idczuCQhDe1U5D52G8Rms6hzHuHeTqP51fdHpump",
]);

export function mintEndsWithDrop(mint: string): boolean {
  return mint.endsWith(DROP_MINT_SUFFIX);
}

export function getOfficialDropsMint(): string | null {
  const v = process.env.NEXT_PUBLIC_OFFICIAL_DROPS_MINT?.trim();
  return v && v.length > 0 ? v : null;
}

export function getHiddenMints(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_HIDDEN_MINTS ?? "";
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return new Set([...HARD_BLOCKED_MINTS, ...list]);
}

/** Coins created in this app that qualify for drops home (…drop mint), excluding official token. */
export function filterDropLaunches(coins: CreatedCoinRecord[]): CreatedCoinRecord[] {
  const hidden = getHiddenMints();
  return coins.filter((c) => mintEndsWithDrop(c.mint) && !hidden.has(c.mint));
}

/** Placeholder until wallet connect supplies creator; shows first 6 of mint for layout parity. */
export function devPreviewFromMint(mint: string): string {
  return mint.slice(0, 6);
}

export function truncateMintMiddle(mint: string, head = 6, tail = 4): string {
  if (mint.length <= head + tail + 2) return mint;
  return `${mint.slice(0, head)}…${mint.slice(-tail)}`;
}

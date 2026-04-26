import type { CreatedCoinRecord } from "@/lib/created-coins-storage";
import { getOfficialDropsMint, mintEndsWithDrop } from "@/lib/drop-coins";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type DbRow = {
  mint: string;
  name: string;
  symbol: string;
  creator_wallet: string | null;
  whitelist_wallets: string[] | null;
  whitelist_fee_bps: number | null;
  holders_fee_bps: number | null;
  holder_limit: number | null;
  fee_treasury_wallet: string | null;
  fee_recipient_locked: boolean | null;
  description: string | null;
  image_url: string | null;
  metadata_uri: string | null;
  signature: string | null;
  created_at: string;
};

function mapRow(r: DbRow): CreatedCoinRecord {
  return {
    mint: r.mint,
    name: r.name,
    symbol: r.symbol,
    creatorWallet: r.creator_wallet ?? undefined,
    description: r.description ?? undefined,
    imageUrl: r.image_url ?? undefined,
    signature: r.signature ?? undefined,
    createdAt: r.created_at,
  };
}

function applyListingRules(rows: CreatedCoinRecord[]): CreatedCoinRecord[] {
  const official = getOfficialDropsMint();
  return rows.filter((r) => mintEndsWithDrop(r.mint) && (!official || r.mint !== official));
}

/** Persist a launch after PumpPortal create succeeds (server only). */
export async function recordDropLaunch(input: {
  mint: string;
  name: string;
  symbol: string;
  creatorWallet: string | null;
  whitelistWallets: string[];
  whitelistFeeBps: number;
  holdersFeeBps: number;
  holderLimit: number;
  feeTreasuryWallet: string;
  feeRecipientLocked: boolean;
  description: string | null;
  imageUrl: string | null;
  metadataUri: string | null;
  signature: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "supabase_not_configured" };
  if (!mintEndsWithDrop(input.mint)) return { ok: false, error: "mint_must_end_with_drop" };

  const { error } = await admin.from("drop_launches").insert({
    mint: input.mint,
    name: input.name,
    symbol: input.symbol,
    creator_wallet: input.creatorWallet,
    whitelist_wallets: input.whitelistWallets,
    whitelist_fee_bps: input.whitelistFeeBps,
    holders_fee_bps: input.holdersFeeBps,
    holder_limit: input.holderLimit,
    fee_treasury_wallet: input.feeTreasuryWallet,
    fee_recipient_locked: input.feeRecipientLocked,
    description: input.description,
    image_url: input.imageUrl,
    metadata_uri: input.metadataUri,
    signature: input.signature,
  });

  if (error?.code === "23505") return { ok: true };
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** All launches from DB, newest first (server only). */
export async function listDropLaunchesFromDb(creatorWallet?: string): Promise<CreatedCoinRecord[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const signal = AbortSignal.timeout(3500);
  let query = admin
    .from("drop_launches")
    .select("mint,name,symbol,creator_wallet,whitelist_wallets,whitelist_fee_bps,holders_fee_bps,holder_limit,fee_treasury_wallet,fee_recipient_locked,description,image_url,metadata_uri,signature,created_at")
    .order("created_at", { ascending: false })
    .limit(750)
    .abortSignal(signal);
  if (creatorWallet) query = query.eq("creator_wallet", creatorWallet);
  const { data, error } = await query;

  if (error || !Array.isArray(data)) return [];
  const rows = (data as DbRow[]).map(mapRow);
  return applyListingRules(rows);
}

export type FeeConfiguredLaunch = {
  mint: string;
  symbol: string;
  whitelistWallets: string[];
  whitelistFeeBps: number;
  holdersFeeBps: number;
  holderLimit: number;
  feeTreasuryWallet: string;
};

export async function listFeeConfiguredLaunches(): Promise<FeeConfiguredLaunch[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("drop_launches")
    .select("mint,symbol,whitelist_wallets,whitelist_fee_bps,holders_fee_bps,holder_limit,fee_treasury_wallet,fee_recipient_locked");
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .filter((r) => Boolean(r.fee_recipient_locked))
    .map((r) => ({
      mint: String(r.mint ?? ""),
      symbol: String(r.symbol ?? ""),
      whitelistWallets: Array.isArray(r.whitelist_wallets) ? (r.whitelist_wallets as string[]) : [],
      whitelistFeeBps: Number(r.whitelist_fee_bps ?? 0),
      holdersFeeBps: Number(r.holders_fee_bps ?? 10000),
      holderLimit: Number(r.holder_limit ?? 100),
      feeTreasuryWallet: String(r.fee_treasury_wallet ?? ""),
    }))
    .filter((r) => r.mint.length > 0 && r.feeTreasuryWallet.length > 0);
}

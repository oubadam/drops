import type { CreatedCoinRecord } from "@/lib/created-coins-storage";
import { getHiddenMints } from "@/lib/drop-coins";
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
  dev_buy_airdrop_enabled: boolean | null;
  dev_buy_airdrop_bps: number | null;
  dev_buy_airdrop_supply_bps: number | null;
  dev_buy_airdrop_wallet_bps: number[] | null;
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
  const hidden = getHiddenMints();
  return rows.filter((r) => !hidden.has(r.mint));
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
  devBuyAirdropEnabled: boolean;
  devBuyAirdropBps: number;
  devBuyAirdropSupplyBps: number;
  devBuyAirdropWalletBps: number[];
  feeTreasuryWallet: string;
  feeRecipientLocked: boolean;
  description: string | null;
  imageUrl: string | null;
  metadataUri: string | null;
  signature: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "supabase_not_configured" };
  const { error } = await admin.from("drop_launches").insert({
    mint: input.mint,
    name: input.name,
    symbol: input.symbol,
    creator_wallet: input.creatorWallet,
    whitelist_wallets: input.whitelistWallets,
    whitelist_fee_bps: input.whitelistFeeBps,
    holders_fee_bps: input.holdersFeeBps,
    holder_limit: input.holderLimit,
    dev_buy_airdrop_enabled: input.devBuyAirdropEnabled,
    dev_buy_airdrop_bps: input.devBuyAirdropBps,
    dev_buy_airdrop_supply_bps: input.devBuyAirdropSupplyBps,
    dev_buy_airdrop_wallet_bps: input.devBuyAirdropWalletBps,
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
  creatorWallet: string | null;
  whitelistWallets: string[];
  whitelistFeeBps: number;
  holdersFeeBps: number;
  holderLimit: number;
  feeTreasuryWallet: string;
  devBuyAirdropEnabled: boolean;
  devBuyAirdropBps: number;
  devBuyAirdropWalletBps: number[];
};

export async function listFeeConfiguredLaunches(): Promise<FeeConfiguredLaunch[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("drop_launches")
    .select("mint,symbol,creator_wallet,whitelist_wallets,whitelist_fee_bps,holders_fee_bps,holder_limit,fee_treasury_wallet,fee_recipient_locked,dev_buy_airdrop_enabled,dev_buy_airdrop_bps,dev_buy_airdrop_wallet_bps");
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .filter((r) => Boolean(r.fee_recipient_locked))
    .map((r) => ({
      mint: String(r.mint ?? ""),
      symbol: String(r.symbol ?? ""),
      creatorWallet: typeof r.creator_wallet === "string" ? r.creator_wallet : null,
      whitelistWallets: Array.isArray(r.whitelist_wallets) ? (r.whitelist_wallets as string[]) : [],
      whitelistFeeBps: Number(r.whitelist_fee_bps ?? 0),
      holdersFeeBps: Number(r.holders_fee_bps ?? 10000),
      holderLimit: Number(r.holder_limit ?? 100),
      feeTreasuryWallet: String(r.fee_treasury_wallet ?? ""),
      devBuyAirdropEnabled: Boolean(r.dev_buy_airdrop_enabled),
      devBuyAirdropBps: Math.max(0, Math.min(10000, Number(r.dev_buy_airdrop_bps ?? 0) || 0)),
      devBuyAirdropWalletBps: Array.isArray(r.dev_buy_airdrop_wallet_bps)
        ? (r.dev_buy_airdrop_wallet_bps as number[]).map((v) => Math.max(0, Number(v) || 0))
        : [],
    }))
    .filter((r) => r.mint.length > 0 && r.feeTreasuryWallet.length > 0);
}

export async function recordFeeDistributionRun(input: {
  mint: string;
  claimSignature: string | null;
  claimOk: boolean;
  claimError: string | null;
  claimedLamports: number;
  whitelistLamportsSent: number;
  holdersLamportsSent: number;
  totalSentLamports: number;
  whitelistTransfersSent: number;
  holderTransfersSent: number;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("drop_fee_distribution_runs").insert({
    mint: input.mint,
    claim_signature: input.claimSignature,
    claim_ok: input.claimOk,
    claim_error: input.claimError,
    claimed_lamports: Math.max(0, Math.floor(input.claimedLamports || 0)),
    whitelist_lamports_sent: Math.max(0, Math.floor(input.whitelistLamportsSent || 0)),
    holders_lamports_sent: Math.max(0, Math.floor(input.holdersLamportsSent || 0)),
    total_sent_lamports: Math.max(0, Math.floor(input.totalSentLamports || 0)),
    whitelist_transfers_sent: Math.max(0, Math.floor(input.whitelistTransfersSent || 0)),
    holder_transfers_sent: Math.max(0, Math.floor(input.holderTransfersSent || 0)),
  });
}

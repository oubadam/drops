import type { CreatedCoinRecord } from "@/lib/created-coins-storage";
import { getOfficialDropsMint, mintEndsWithDrop } from "@/lib/drop-coins";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type DbRow = {
  mint: string;
  name: string;
  symbol: string;
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
export async function listDropLaunchesFromDb(): Promise<CreatedCoinRecord[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const { data, error } = await admin
    .from("drop_launches")
    .select("mint,name,symbol,description,image_url,metadata_uri,signature,created_at")
    .order("created_at", { ascending: false })
    .limit(750);

  if (error || !Array.isArray(data)) return [];
  const rows = (data as DbRow[]).map(mapRow);
  return applyListingRules(rows);
}

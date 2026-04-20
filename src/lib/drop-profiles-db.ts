import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type DropProfile = {
  walletAddress: string;
  username: string;
  bio: string;
  avatarUrl: string;
  updatedAt: string;
};

type DbProfileRow = {
  wallet_address: string;
  username: string;
  bio: string;
  avatar_url: string;
  updated_at: string;
};

function mapProfile(r: DbProfileRow): DropProfile {
  return {
    walletAddress: r.wallet_address,
    username: r.username,
    bio: r.bio ?? "",
    avatarUrl: r.avatar_url ?? "",
    updatedAt: r.updated_at,
  };
}

export async function getDropProfileByWallet(walletAddress: string): Promise<DropProfile | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("drop_profiles")
    .select("wallet_address,username,bio,avatar_url,updated_at")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data as DbProfileRow);
}

export async function upsertDropProfile(input: {
  walletAddress: string;
  username: string;
  bio: string;
  avatarUrl: string;
}): Promise<{ ok: true; profile: DropProfile } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await admin
    .from("drop_profiles")
    .upsert(
      {
        wallet_address: input.walletAddress,
        username: input.username,
        bio: input.bio,
        avatar_url: input.avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" },
    )
    .select("wallet_address,username,bio,avatar_url,updated_at")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "profile_upsert_failed" };
  return { ok: true, profile: mapProfile(data as DbProfileRow) };
}

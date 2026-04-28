import { NextResponse } from "next/server";
import { listFeeConfiguredLaunches } from "@/lib/drop-launches-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const launches = await listFeeConfiguredLaunches();
  const tokensLaunched = launches.length;
  let tokenPayoutsMillions = 0;
  let solAirdroppedSol = 0;

  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("drop_fee_distribution_runs")
      .select("total_sent_lamports,token_airdrop_raw")
      .limit(10000);
    if (!error && Array.isArray(data)) {
      const sums = data.reduce(
        (acc, row) => {
          const n = Number((row as { total_sent_lamports?: unknown }).total_sent_lamports ?? 0);
          if (Number.isFinite(n) && n > 0) acc.lamports += n;
          try {
            const raw = BigInt(String((row as { token_airdrop_raw?: unknown }).token_airdrop_raw ?? "0"));
            if (raw > BigInt(0)) acc.tokenRaw += raw;
          } catch {
            // ignore bad data rows
          }
          return acc;
        },
        { lamports: 0, tokenRaw: BigInt(0) },
      );
      solAirdroppedSol = sums.lamports / 1_000_000_000;
      // Pump tokens are 6 decimals; millions of tokens = raw / 1e12.
      tokenPayoutsMillions = Number(sums.tokenRaw) / 1_000_000_000_000;
    } else {
      // Backward-compatible fallback: table exists but token_airdrop_raw column may not yet be migrated.
      const { data: legacyRows, error: legacyError } = await admin
        .from("drop_fee_distribution_runs")
        .select("total_sent_lamports")
        .limit(10000);
      if (!legacyError && Array.isArray(legacyRows)) {
        const lamports = legacyRows.reduce((acc, row) => {
          const n = Number((row as { total_sent_lamports?: unknown }).total_sent_lamports ?? 0);
          return Number.isFinite(n) && n > 0 ? acc + n : acc;
        }, 0);
        solAirdroppedSol = lamports / 1_000_000_000;
      }
      tokenPayoutsMillions = 0;
    }
  }

  return NextResponse.json(
    {
      tokensLaunched,
      tokenPayoutsMillions,
      solAirdroppedSol,
      source: "launchpad_exact_db",
      notes: {
        tokenPayouts: "Exact executed token airdrops from worker runs (0 until buyback/airdrop actually executes).",
        solAirdropped: "Exact sum of sent lamports recorded during launchpad payout runs.",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}


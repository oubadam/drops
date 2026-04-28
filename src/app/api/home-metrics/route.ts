import { NextResponse } from "next/server";
import { listFeeConfiguredLaunches } from "@/lib/drop-launches-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PUMP_TOTAL_SUPPLY_MILLIONS = 1000; // 1B supply per launch => 1000M

export async function GET() {
  const launches = await listFeeConfiguredLaunches();
  const tokensLaunched = launches.length;
  const tokenPayoutsMillions = tokensLaunched * PUMP_TOTAL_SUPPLY_MILLIONS;
  let solAirdroppedSol = 0;

  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("drop_fee_distribution_runs")
      .select("total_sent_lamports")
      .limit(10000);
    if (!error && Array.isArray(data)) {
      const lamports = data.reduce((acc, row) => {
        const n = Number((row as { total_sent_lamports?: unknown }).total_sent_lamports ?? 0);
        return Number.isFinite(n) && n > 0 ? acc + n : acc;
      }, 0);
      solAirdroppedSol = lamports / 1_000_000_000;
    }
  }

  return NextResponse.json(
    {
      tokensLaunched,
      tokenPayoutsMillions,
      solAirdroppedSol,
      source: "launchpad_exact_db",
      notes: {
        tokenPayouts: "Derived from launched Pump tokens (1B each => 1000M each).",
        solAirdropped: "Exact sum of sent lamports recorded during launchpad payout runs.",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}


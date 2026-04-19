import { NextResponse } from "next/server";
import { listDropLaunchesFromDb } from "@/lib/drop-launches-db";
import { isSupabaseLaunchesConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQ = (searchParams.get("q") ?? "").trim();
  const q = rawQ.toLowerCase();

  if (!isSupabaseLaunchesConfigured()) {
    return NextResponse.json({ configured: false, items: [] satisfies unknown[] });
  }

  let items = await listDropLaunchesFromDb();
  if (rawQ) {
    items = items.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        r.mint.toLowerCase().includes(q) ||
        r.mint === rawQ,
    );
  }

  return NextResponse.json({ configured: true, items });
}

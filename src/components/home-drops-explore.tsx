"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { DROP_COINS_UPDATED_EVENT, type CreatedCoinRecord } from "@/lib/created-coins-storage";
import { devPreviewFromMint } from "@/lib/drop-coins";
import { loadDropLaunchesForUi } from "@/lib/load-drop-launches";
import { fetchSolanaTokenBestMcapUsd, formatMcapUsd } from "@/lib/dexscreener-mcap";
import { formatLaunchAgo } from "@/lib/launch-time";
import { mintGradient } from "@/lib/mint-visual";

type Enriched = CreatedCoinRecord & { mcap: number | null };

export function HomeDropsExplore() {
  const [tab, setTab] = useState<"explore" | "watchlist">("explore");
  const [rows, setRows] = useState<Enriched[]>([]);

  const loadRows = useCallback(async () => {
    const base = await loadDropLaunchesForUi();
    const next: Enriched[] = base.map((c) => ({ ...c, mcap: null }));
    setRows(next);
    for (const c of next) {
      const m = await fetchSolanaTokenBestMcapUsd(c.mint);
      setRows((prev) =>
        prev.map((r) => (r.mint === c.mint ? { ...r, mcap: m } : r)),
      );
    }
  }, []);

  useEffect(() => {
    const run = () => startTransition(() => void loadRows());
    run();
    window.addEventListener(DROP_COINS_UPDATED_EVENT, run);
    return () => window.removeEventListener(DROP_COINS_UPDATED_EVENT, run);
  }, [loadRows]);

  const trending = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
    return sorted.slice(0, 12);
  }, [rows]);

  const explore = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rows]);

  return (
    <section className="mt-16 w-full max-w-6xl border-t border-[var(--pump-border)] pt-12 text-left">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Now trending</h2>
          <p className="mt-1 text-sm text-[var(--pump-muted)]">
            Highest mcap on drops (mint ends in <span className="font-mono text-[var(--pump-text)]">drop</span>). Excludes
            official $drops.
          </p>
        </div>
        <Link href="/create" className="btn-primary shrink-0 text-sm">
          Create coin
        </Link>
      </div>

      {trending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--pump-border)] bg-[var(--pump-elevated)] px-4 py-8 text-center text-sm text-[var(--pump-muted)]">
          No qualifying coins yet. Create one: new mints are generated until the address ends in{" "}
          <span className="font-mono text-[var(--pump-text)]">drop</span>.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {trending.map((c) => (
            <TrendingCard key={c.mint} coin={c} />
          ))}
        </div>
      )}

      <div className="mt-14 border-b border-[var(--pump-border)]">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setTab("explore")}
            className={`border-b-2 pb-3 text-sm font-bold transition ${
              tab === "explore"
                ? "border-[var(--pump-green)] text-[var(--pump-green)]"
                : "border-transparent text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
            }`}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => setTab("watchlist")}
            className={`border-b-2 pb-3 text-sm font-bold transition ${
              tab === "watchlist"
                ? "border-[var(--pump-green)] text-[var(--pump-green)]"
                : "border-transparent text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
            }`}
          >
            Watchlist
          </button>
        </div>
      </div>

      {tab === "watchlist" ? (
        <p className="mt-8 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-4 py-10 text-center text-sm text-[var(--pump-muted)]">
          Watchlist coming soon (connect wallet).
        </p>
      ) : explore.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--pump-muted)]">Nothing in explore yet.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {explore.map((c) => (
            <ExploreCard key={c.mint} coin={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrendingCard({ coin }: { coin: Enriched }) {
  return (
    <Link
      href={`https://dexscreener.com/solana/${coin.mint}`}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-[200px] shrink-0 gap-3 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3 transition hover:border-[var(--pump-green)]/40"
    >
      <CoinThumb coin={coin} className="h-14 w-14 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{coin.name}</p>
        <p className="mt-0.5 text-xs font-semibold text-[var(--pump-green)]">{formatMcapUsd(coin.mcap)}</p>
        <p className="mt-1 truncate text-[10px] text-[var(--pump-muted)]">drops · {coin.symbol}</p>
      </div>
    </Link>
  );
}

function ExploreCard({ coin }: { coin: Enriched }) {
  const desc = (coin.description ?? "").trim() || "No description available.";
  const mcap = coin.mcap ?? 0;
  const bar = Math.min(100, mcap > 0 ? Math.max(8, (mcap / 80_000) * 100) : 6);

  return (
    <div className="flex flex-col rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3">
      <div className="flex gap-3">
        <CoinThumb coin={coin} className="h-14 w-14 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-white">{coin.name}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--pump-muted)]">{coin.symbol}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--pump-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="text-[var(--pump-text)]">👤</span>
              <span className="font-mono text-[var(--pump-text)]">{devPreviewFromMint(coin.mint)}</span>
            </span>
            <span>·</span>
            <span>{formatLaunchAgo(coin.createdAt)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--pump-green)]">{formatMcapUsd(coin.mcap)}</span>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--pump-border)]">
              <div className="h-full rounded-full bg-[var(--pump-green)]" style={{ width: `${bar}%` }} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-[var(--pump-muted)]">{desc}</p>
      <a
        href={`https://solscan.io/token/${coin.mint}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 text-[10px] font-medium text-[var(--pump-green)] hover:underline"
      >
        View on Solscan
      </a>
    </div>
  );
}

function CoinThumb({ coin, className }: { coin: CreatedCoinRecord; className?: string }) {
  const g = mintGradient(coin.mint);
  if (coin.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- IPFS / remote URLs
      <img src={coin.imageUrl} alt="" className={`object-cover ${className ?? ""}`} />
    );
  }
  return (
    <div
      className={`grid shrink-0 place-items-center text-xs font-black text-white/90 ${className ?? ""}`}
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      {coin.symbol.slice(0, 2)}
    </div>
  );
}

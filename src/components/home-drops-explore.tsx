"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useReducer, useState } from "react";

import brokendrop from "@/components/brokendrop.png";
import { ExploreCoinsTable, ExploreCoinThumb, ExploreGridCard } from "@/components/explore-coin-views";
import {
  ExploreFiltersPopover,
  type ExploreAppliedFilters,
  passesExploreFilters,
} from "@/components/explore-filters-popover";
import { ExploreViewSettings, readExploreViewMode, type ExploreViewMode } from "@/components/explore-view-settings";
import { DROP_COINS_UPDATED_EVENT } from "@/lib/created-coins-storage";
import type { ExploreEnrichedCoin } from "@/lib/explore-coin-types";
import { fetchSolanaTokenPairExploreStats } from "@/lib/dexscreener-mcap";
import { exploreMcapUsd, formatExploreMcap } from "@/lib/explore-mcap";
import { EMPTY_PUMP_FRONT_STATE, fetchPumpFrontCoinState } from "@/lib/pump-front-api";
import { loadDropLaunchesForUi } from "@/lib/load-drop-launches";
import { loadWatchlistMints, WATCHLIST_UPDATED_EVENT } from "@/lib/watchlist-storage";

const emptyDexFields = {
  mcap: null as number | null,
  vol24h: null as number | null,
  dexId: null as string | null,
  fdvUsd: null as number | null,
  priceChange: { m5: null as number | null, h1: null as number | null, h6: null as number | null, h24: null as number | null },
  txnsH24: null as number | null,
  pump: { ...EMPTY_PUMP_FRONT_STATE },
};

export function HomeDropsExplore() {
  const [tab, setTab] = useState<"explore" | "watchlist">("explore");
  const [rows, setRows] = useState<ExploreEnrichedCoin[]>([]);
  const [exploreFilters, setExploreFilters] = useState<ExploreAppliedFilters | null>(null);
  const [viewMode, setViewMode] = useState<ExploreViewMode>(() => readExploreViewMode());
  const [watchBump, bumpWatch] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const fn = () => bumpWatch();
    window.addEventListener(WATCHLIST_UPDATED_EVENT, fn);
    return () => window.removeEventListener(WATCHLIST_UPDATED_EVENT, fn);
  }, []);

  const loadRows = useCallback(async () => {
    const base = await loadDropLaunchesForUi();
    const next: ExploreEnrichedCoin[] = base.map((c) => ({ ...c, ...emptyDexFields }));
    setRows(next);
    for (const c of next) {
      const [stats, pump] = await Promise.all([
        fetchSolanaTokenPairExploreStats(c.mint),
        fetchPumpFrontCoinState(c.mint),
      ]);
      setRows((prev) =>
        prev.map((r) =>
          r.mint === c.mint
            ? {
                ...r,
                mcap: stats.mcapUsd,
                vol24h: stats.volumeUsd24h,
                dexId: stats.dexId,
                fdvUsd: stats.fdvUsd,
                priceChange: stats.priceChange,
                txnsH24: stats.txnsH24,
                pump,
              }
            : r,
        ),
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
    const sorted = [...rows].sort((a, b) => exploreMcapUsd(b) - exploreMcapUsd(a));
    return sorted.slice(0, 12);
  }, [rows]);

  const exploreSorted = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rows]);

  const exploreFiltered = useMemo(() => {
    return exploreSorted.filter((c) => passesExploreFilters(c, exploreFilters));
  }, [exploreSorted, exploreFilters]);

  const watchlistRows = useMemo(() => {
    void watchBump;
    const s = new Set(loadWatchlistMints());
    return exploreSorted.filter((c) => s.has(c.mint));
  }, [exploreSorted, watchBump]);

  const watchlistFiltered = useMemo(() => {
    return watchlistRows.filter((c) => passesExploreFilters(c, exploreFilters));
  }, [watchlistRows, exploreFilters]);

  const listSection = (coins: ExploreEnrichedCoin[], emptyLabel: string) => {
    if (coins.length === 0) {
      return (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--pump-border)] bg-[var(--pump-elevated)] px-4 py-8 text-center text-sm text-[var(--pump-muted)]">
          {emptyLabel}
        </p>
      );
    }
    if (viewMode === "table") {
      return <ExploreCoinsTable coins={coins} />;
    }
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {coins.map((c) => (
          <ExploreGridCard key={c.mint} coin={c} />
        ))}
      </div>
    );
  };

  return (
    <section className="w-full text-left">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Trending now</h2>
        </div>
      </div>

      {trending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--pump-border)] bg-[var(--pump-elevated)] px-4 py-8 text-center text-sm text-[var(--pump-muted)]">
          No coins have been created yet.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {trending.map((c) => (
            <TrendingCard key={c.mint} coin={c} />
          ))}
        </div>
      )}

      <div className="mt-14">
        <div className="flex gap-8 border-b border-[var(--pump-border)]">
          <button
            type="button"
            onClick={() => setTab("explore")}
            className={`cursor-pointer border-b-2 pb-3 text-base font-bold tracking-tight transition sm:text-lg ${
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
            className={`cursor-pointer border-b-2 pb-3 text-base font-bold tracking-tight transition sm:text-lg ${
              tab === "watchlist"
                ? "border-[var(--pump-green)] text-[var(--pump-green)]"
                : "border-transparent text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
            }`}
          >
            Watchlist
          </button>
        </div>
        <div className="relative flex justify-end gap-2 pt-2.5">
          <ExploreFiltersPopover applied={exploreFilters} onApply={setExploreFilters} />
          <ExploreViewSettings value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {tab === "watchlist" ? (
        watchlistRows.length === 0 ? (
          <WatchlistEmpty onExplore={() => setTab("explore")} />
        ) : watchlistFiltered.length === 0 ? (
          listSection([], "No watchlist coins match these filters.")
        ) : (
          listSection(watchlistFiltered, "")
        )
      ) : exploreSorted.length === 0 ? (
        listSection([], "Nothing in explore yet.")
      ) : exploreFiltered.length === 0 ? (
        listSection([], "No coins match these filters.")
      ) : (
        listSection(exploreFiltered, "")
      )}
    </section>
  );
}

function WatchlistEmpty({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="mt-2 flex w-full flex-col items-center px-2 py-0 text-center sm:px-3">
      <Image
        src={brokendrop}
        alt="Empty watchlist"
        width={brokendrop.width}
        height={brokendrop.height}
        className="-mb-3 block h-auto w-full max-w-[240px] object-contain sm:-mb-4 sm:max-w-[260px]"
        sizes="(max-width:640px) 240px, 260px"
        priority={false}
      />
      <h2 className="mt-0 text-xl font-black tracking-tight text-white sm:whitespace-nowrap sm:text-2xl">
        Your watchlist is empty
      </h2>
      <p className="mt-2 max-w-full text-sm leading-normal text-white sm:text-base lg:whitespace-nowrap">
        {"Use the star on explore rows to save coins here, or add them from a coin detail screen."}
      </p>
      <button
        type="button"
        onClick={onExplore}
        className="mt-4 cursor-pointer rounded-full bg-[var(--pump-green)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
      >
        Explore coins
      </button>
    </div>
  );
}

function TrendingCard({ coin }: { coin: ExploreEnrichedCoin }) {
  return (
    <Link
      href={`https://pump.fun/coin/${coin.mint}`}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-[200px] shrink-0 gap-3 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3 transition hover:border-[var(--pump-green)]/40"
    >
      <ExploreCoinThumb coin={coin} className="h-14 w-14 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{coin.name}</p>
        <p className="mt-0.5 text-xs font-semibold text-[var(--pump-green)]">{formatExploreMcap(coin)}</p>
        <p className="mt-1 truncate text-[10px] text-[var(--pump-muted)]">drops · {coin.symbol}</p>
      </div>
    </Link>
  );
}

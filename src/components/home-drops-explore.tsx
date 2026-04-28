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
import { formatLaunchAgo } from "@/lib/launch-time";
import { EMPTY_PUMP_FRONT_STATE, fetchPumpFrontCoinState } from "@/lib/pump-front-api";
import { readExploreExtraMints } from "@/lib/explore-extra-mints";
import { loadDropLaunchesForUi } from "@/lib/load-drop-launches";
import { pumpTokenInfoToCreatedRecord, type PumpTokenInfoPayload } from "@/lib/pump-token-info";
import { loadWatchlistMints, WATCHLIST_UPDATED_EVENT } from "@/lib/watchlist-storage";

const emptyDexFields = {
  mcap: null as number | null,
  vol24h: null as number | null,
  dexId: null as string | null,
  priceUsd: null as number | null,
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
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [copyToastEntered, setCopyToastEntered] = useState(false);
  const [copyToastText, setCopyToastText] = useState("Contract address copied to clipboard");
  const [homeMetrics, setHomeMetrics] = useState<{
    tokensLaunched: number;
    solAirdroppedSol: number;
    tokenPayoutsMillions: number;
  } | null>(null);

  const LIVE_REFRESH_LIMIT = 18;

  useEffect(() => {
    const fn = () => bumpWatch();
    window.addEventListener(WATCHLIST_UPDATED_EVENT, fn);
    return () => window.removeEventListener(WATCHLIST_UPDATED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (!copyToastVisible) return;
    setCopyToastEntered(false);
    const inId = window.setTimeout(() => setCopyToastEntered(true), 10);
    const outId = window.setTimeout(() => setCopyToastEntered(false), 2200);
    const hideId = window.setTimeout(() => {
      setCopyToastVisible(false);
      setCopyToastEntered(false);
    }, 3000);
    return () => {
      window.clearTimeout(inId);
      window.clearTimeout(outId);
      window.clearTimeout(hideId);
    };
  }, [copyToastVisible]);

  async function copyText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }

  const enrichCoins = useCallback(async (coins: ExploreEnrichedCoin[]) => {
    const targets = coins.slice(0, LIVE_REFRESH_LIMIT);
    const updates = await Promise.all(
      targets.map(async (c) => {
        const [stats, pump] = await Promise.all([
          fetchSolanaTokenPairExploreStats(c.mint),
          fetchPumpFrontCoinState(c.mint),
        ]);
        return {
          mint: c.mint,
          mcap: stats.mcapUsd,
          vol24h: stats.volumeUsd24h,
          dexId: stats.dexId,
          priceUsd: stats.priceUsd,
          fdvUsd: stats.fdvUsd,
          priceChange: stats.priceChange,
          txnsH24: stats.txnsH24,
          pump,
        };
      }),
    );
    const byMint = new Map(updates.map((u) => [u.mint, u]));
    setRows((prev) =>
      prev.map((r) => {
        const next = byMint.get(r.mint);
        return next ? { ...r, ...next } : r;
      }),
    );
  }, []);

  const refreshPumpOnly = useCallback(async (coins: ExploreEnrichedCoin[]) => {
    const targets = coins.slice(0, LIVE_REFRESH_LIMIT);
    const updates = await Promise.all(
      targets.map(async (c) => ({
        mint: c.mint,
        pump: await fetchPumpFrontCoinState(c.mint),
      })),
    );
    const byMint = new Map(updates.map((u) => [u.mint, u]));
    setRows((prev) =>
      prev.map((r) => {
        const next = byMint.get(r.mint);
        return next ? { ...r, pump: next.pump } : r;
      }),
    );
  }, []);

  const loadRows = useCallback(async () => {
    const base = await loadDropLaunchesForUi();
    const seen = new Set(base.map((c) => c.mint));
    const extraMints = readExploreExtraMints().filter((m) => !seen.has(m));
    const extraRecords = await Promise.all(
      extraMints.map(async (m) => {
        try {
          const r = await fetch(`/api/token-info/${encodeURIComponent(m)}`, { cache: "no-store" });
          if (!r.ok) {
            return {
              mint: m,
              name: m.slice(0, 8),
              symbol: "TOKEN",
              description: "",
              imageUrl: undefined,
              creatorWallet: undefined,
              createdAt: new Date().toISOString(),
            };
          }
          const t = (await r.json()) as PumpTokenInfoPayload;
          if (!t?.mint || t.mint !== m) {
            return {
              mint: m,
              name: m.slice(0, 8),
              symbol: "TOKEN",
              description: "",
              imageUrl: undefined,
              creatorWallet: undefined,
              createdAt: new Date().toISOString(),
            };
          }
          return pumpTokenInfoToCreatedRecord(t);
        } catch {
          return {
            mint: m,
            name: m.slice(0, 8),
            symbol: "TOKEN",
            description: "",
            imageUrl: undefined,
            creatorWallet: undefined,
            createdAt: new Date().toISOString(),
          };
        }
      }),
    );
    const extras = extraRecords.filter((x): x is NonNullable<typeof x> => x != null);
    const merged = [...extras, ...base];
    const next: ExploreEnrichedCoin[] = merged.map((c) => ({ ...c, ...emptyDexFields }));
    setRows(next);
    await enrichCoins(next);
  }, [enrichCoins]);

  const refreshHomeMetrics = useCallback(async () => {
    try {
      const r = await fetch("/api/home-metrics", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as {
        tokensLaunched?: number;
        solAirdroppedSol?: number;
        tokenPayoutsMillions?: number;
      };
      setHomeMetrics({
        tokensLaunched: typeof j.tokensLaunched === "number" ? j.tokensLaunched : 0,
        solAirdroppedSol: typeof j.solAirdroppedSol === "number" ? j.solAirdroppedSol : 0,
        tokenPayoutsMillions: typeof j.tokenPayoutsMillions === "number" ? j.tokenPayoutsMillions : 0,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const run = () => startTransition(() => void loadRows());
    run();
    void refreshHomeMetrics();
    window.addEventListener(DROP_COINS_UPDATED_EVENT, run);
    return () => window.removeEventListener(DROP_COINS_UPDATED_EVENT, run);
  }, [loadRows, refreshHomeMetrics]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshHomeMetrics();
    }, 30000);
    return () => window.clearInterval(id);
  }, [refreshHomeMetrics]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (rows.length === 0) return;
      void refreshPumpOnly(rows);
    }, 2500);
    return () => window.clearInterval(id);
  }, [rows, refreshPumpOnly]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (rows.length === 0) return;
      void enrichCoins(rows);
    }, 12000);
    return () => window.clearInterval(id);
  }, [rows, enrichCoins]);

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

  const officialTokenCa = (
    process.env.NEXT_PUBLIC_OFFICIAL_TOKEN_CA ??
    process.env.NEXT_PUBLIC_OFFICIAL_DROPS_MINT ??
    ""
  ).trim();
  const configuredAirdropIntervalMinutes = Number(process.env.NEXT_PUBLIC_AIRDROP_INTERVAL_MINUTES ?? "5");
  const launchedCount = homeMetrics?.tokensLaunched ?? rows.length;
  const solAirdroppedText = `${(homeMetrics?.solAirdroppedSol ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`;
  const tokenPayoutsText = `${(homeMetrics?.tokenPayoutsMillions ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M tokens`;
  const airdropIntervalText = Number.isFinite(configuredAirdropIntervalMinutes) && configuredAirdropIntervalMinutes > 0
    ? `${configuredAirdropIntervalMinutes} minutes`
    : "5 minutes";

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
      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
        {coins.map((c) => (
          <ExploreGridCard key={c.mint} coin={c} />
        ))}
      </div>
    );
  };

  return (
    <section className="w-full text-left">
      {copyToastVisible ? (
        <div
          className={`pointer-events-none fixed left-1/2 top-4 z-[260] -translate-x-1/2 rounded-xl border border-[#3b82f6] bg-[#0b1018]/95 px-4 py-3 text-sm font-semibold text-white transition-all duration-700 ease-in-out ${
            copyToastEntered ? "translate-y-4 opacity-100" : "-translate-y-3 opacity-0"
          }`}
        >
          {copyToastText}
        </div>
      ) : null}
      <div>
        <div className="mb-4 rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-4 py-4 sm:px-5">
          <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">How drops works</h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--pump-muted)]">
            Drops is the first immutable airdrop protocol for Pump.fun launches. When a token is created, payout rules are locked
            at launch time and cannot be edited later. Every cycle (currently{" "}
            <span className="font-semibold text-[var(--pump-text)]">{airdropIntervalText}</span>), the system claims creator fees,
            splits SOL to your configured whitelist wallets, then distributes the remaining share to top holders weighted by
            balance. No manual claim loops, no custom scripts, just automatic recurring payouts.
          </p>
        </div>

        <div className="mb-7 overflow-hidden rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)]">
          <div className="border-b border-[var(--pump-border)] px-4 py-2.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--pump-muted)]">
              <span className="font-bold tracking-wide text-[var(--pump-text)]">OFFICIAL CA</span>
              <button
                type="button"
                disabled={!officialTokenCa}
                onClick={() => {
                  if (!officialTokenCa) {
                    setCopyToastText("Set NEXT_PUBLIC_OFFICIAL_TOKEN_CA in .env.local");
                    setCopyToastVisible(true);
                    return;
                  }
                  void copyText(officialTokenCa).then((ok) => {
                    setCopyToastText(ok ? "Contract address copied to clipboard" : "Could not copy contract address");
                    setCopyToastVisible(true);
                  });
                }}
                className="max-w-full cursor-pointer truncate rounded-md border border-[var(--pump-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--pump-text)] hover:border-[var(--pump-green)]/50 disabled:cursor-default disabled:opacity-70 sm:text-[11px]"
              >
                {officialTokenCa || "Set NEXT_PUBLIC_OFFICIAL_TOKEN_CA"}
              </button>
            </div>
          </div>
          <div className="grid gap-0.5 bg-[var(--pump-border)] sm:grid-cols-3">
            <div className="bg-[var(--pump-elevated)] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pump-muted)]">SOL Airdropped (all-time)</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-[var(--pump-text)]">{solAirdroppedText}</p>
            </div>
            <div className="bg-[var(--pump-elevated)] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pump-muted)]">Tokens Launched</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-[var(--pump-text)]">{launchedCount}</p>
            </div>
            <div className="bg-[var(--pump-elevated)] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pump-muted)]">Token Payouts</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-[var(--pump-text)]">{tokenPayoutsText}</p>
            </div>
          </div>
        </div>
      </div>

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
        <div className="flex w-full gap-3 overflow-x-auto pb-2 pr-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
  const dev = (coin.creatorWallet || coin.mint).slice(0, 6);
  const desc = (coin.description ?? "").trim() || "No description available.";
  return (
    <Link
      href={`/token/${coin.mint}`}
      className="flex min-w-[270px] shrink-0 gap-2.5 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-2.5 transition hover:border-[var(--pump-green)]/40"
    >
      <ExploreCoinThumb coin={coin} className="h-16 w-16 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg leading-tight font-bold text-white">{coin.name}</p>
        <p className="truncate text-base leading-tight text-[var(--pump-muted)]">{coin.symbol}</p>
        <div className="mt-1 flex items-end gap-1.5">
          <span className="text-xs leading-none text-[var(--pump-muted)]">MC</span>
          <span className="text-xl leading-none font-bold text-emerald-400">{formatExploreMcap(coin)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--pump-muted)]">
          <span className="text-emerald-400">◌</span>
          <span className="font-semibold text-zinc-200">{dev}</span>
          <span>·</span>
          <span>{formatLaunchAgo(coin.createdAt)}</span>
        </div>
        <p className="mt-1 line-clamp-1 break-words text-xs leading-snug text-[var(--pump-muted)]">{desc}</p>
      </div>
    </Link>
  );
}

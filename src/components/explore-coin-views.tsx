"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer } from "react";

import { formatLaunchAgo } from "@/lib/launch-time";
import { mintGradient } from "@/lib/mint-visual";
import type { ExploreEnrichedCoin } from "@/lib/explore-coin-types";
import { devPreviewFromMint } from "@/lib/drop-coins";
import { formatMcapUsd, formatVolumeUsd24h } from "@/lib/dexscreener-mcap";
import { exploreMcapUsd, formatExploreMcap } from "@/lib/explore-mcap";
import { isMintWatchlisted, toggleWatchlistMint, WATCHLIST_UPDATED_EVENT } from "@/lib/watchlist-storage";

function athRow(coin: ExploreEnrichedCoin): { display: string; fillRatio: number } {
  const { pump, fdvUsd } = coin;
  const m = exploreMcapUsd(coin);
  if (pump.indexed && pump.athMarketCap != null && pump.athMarketCap > 0) {
    const fillRatio = Math.min(1, m / pump.athMarketCap);
    return { display: formatMcapUsd(pump.athMarketCap), fillRatio };
  }
  const f = fdvUsd ?? 0;
  const ath = f > m ? f : m > 0 ? Math.max(m * 1.2, m + 1) : 0;
  if (ath <= 0) return { display: "—", fillRatio: 0 };
  const fillRatio = ath > 0 ? Math.min(1, m / ath) : 0;
  return { display: formatMcapUsd(ath), fillRatio };
}

function pctCell(v: number | null): { text: string; cls: string } {
  if (v == null || !Number.isFinite(v)) return { text: "—", cls: "text-[var(--pump-muted)]" };
  const sign = v > 0 ? "+" : "";
  const cls = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-[var(--pump-muted)]";
  return { text: `${sign}${v.toFixed(2)}%`, cls };
}

function MiniSparkline({ h24, seed }: { h24: number | null; seed: string }) {
  const { areaD, linePts, fill, stroke } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const ys: number[] = [];
    for (let i = 0; i < 10; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      ys.push(0.25 + (h % 100) / 133);
    }
    const pos = h24 != null && h24 >= 0;
    const w = 44;
    const hgt = 18;
    const step = w / (ys.length - 1);
    const linePts = ys.map((y, i) => `${(i * step).toFixed(1)},${(hgt - y * hgt).toFixed(1)}`).join(" ");
    const seg = ys.map((y, i) => `L ${(i * step).toFixed(1)} ${(hgt - y * hgt).toFixed(1)}`).join(" ");
    const areaD = `M 0 ${hgt} ${seg} L ${w} ${hgt} Z`;
    const fill = pos ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
    const stroke = pos ? "#22c55e" : "#f87171";
    return { areaD, linePts, fill, stroke };
  }, [h24, seed]);

  return (
    <svg width={44} height={20} viewBox="0 0 44 20" className="shrink-0 overflow-visible" aria-hidden>
      <path d={areaD} fill={fill} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={linePts}
      />
    </svg>
  );
}

export function ExploreCoinThumb({ coin, className }: { coin: ExploreEnrichedCoin; className?: string }) {
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

export function ExploreGridCard({ coin }: { coin: ExploreEnrichedCoin }) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const fn = () => bump();
    window.addEventListener(WATCHLIST_UPDATED_EVENT, fn);
    return () => window.removeEventListener(WATCHLIST_UPDATED_EVENT, fn);
  }, []);
  const desc = (coin.description ?? "").trim() || "No description available.";
  const dev = (coin.creatorWallet || devPreviewFromMint(coin.mint)).slice(0, 6);
  const starred = isMintWatchlisted(coin.mint);

  return (
    <div className="group relative">
      <Link href={`/token/${coin.mint}`} className="block">
        <div className="flex min-h-[126px] items-start gap-3.5 overflow-hidden rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3.5 pr-12 transition hover:border-[var(--pump-green)]/45">
        <ExploreCoinThumb coin={coin} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-white">{coin.name}</p>
          <p className="truncate text-base text-[var(--pump-muted)]">{coin.symbol}</p>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="text-sm text-[var(--pump-muted)]">MC</span>
            <span className="text-sm font-bold text-emerald-400">{formatExploreMcap(coin)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-[var(--pump-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-400">◌</span>
              <span className="font-semibold text-zinc-200">{dev}</span>
            </span>
            <span>·</span>
            <span>{formatLaunchAgo(coin.createdAt)}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 break-words text-sm leading-snug text-[var(--pump-muted)]">{desc}</p>
        </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
        className={`absolute top-2.5 right-2.5 cursor-pointer rounded-md border border-[var(--pump-border)] px-2 py-1 text-base leading-none transition ${
          starred
            ? "bg-amber-500/15 text-amber-300"
            : "bg-[var(--pump-surface)] text-[var(--pump-muted)] opacity-0 group-hover:opacity-100 hover:text-amber-300"
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWatchlistMint(coin.mint);
          bump();
        }}
      >
        {starred ? "★" : "☆"}
      </button>
    </div>
  );
}

export function ExploreCoinsTable({ coins }: { coins: ExploreEnrichedCoin[] }) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const fn = () => bump();
    window.addEventListener(WATCHLIST_UPDATED_EVENT, fn);
    return () => window.removeEventListener(WATCHLIST_UPDATED_EVENT, fn);
  }, []);

  return (
    <div className="mt-6 w-full overflow-x-auto rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[920px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--pump-border)] bg-[var(--pump-surface)] text-[10px] font-bold uppercase tracking-wide text-[var(--pump-muted)]">
            <th className="sticky left-0 z-[1] w-10 bg-[var(--pump-surface)] px-2 py-2.5 pl-3">#</th>
            <th className="min-w-[140px] px-2 py-2.5">Coin</th>
            <th className="px-2 py-2.5">Graph</th>
            <th className="px-2 py-2.5">Mcap (USD)</th>
            <th className="min-w-[120px] px-2 py-2.5">Ath</th>
            <th className="px-2 py-2.5">Age</th>
            <th className="px-2 py-2.5">Txns</th>
            <th className="px-2 py-2.5">24h Vol</th>
            <th className="px-2 py-2.5">Traders</th>
            <th className="px-2 py-2.5">5m</th>
            <th className="px-2 py-2.5">1h</th>
            <th className="px-2 py-2.5">6h</th>
            <th className="px-2 py-2.5">24h</th>
            <th className="sticky right-0 z-[1] w-10 bg-[var(--pump-surface)] px-2 py-2.5 pr-3 text-center" />
          </tr>
        </thead>
        <tbody>
          {coins.map((c, i) => (
            <ExploreTableRow key={c.mint} rank={i + 1} coin={c} bump={bump} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExploreTableRow({ rank, coin, bump }: { rank: number; coin: ExploreEnrichedCoin; bump: () => void }) {
  const ath = athRow(coin);
  const starred = isMintWatchlisted(coin.mint);

  return (
    <tr className="group border-b border-[var(--pump-border)]/80 last:border-0">
      <td className="sticky left-0 z-[1] bg-[var(--pump-elevated)] px-2 py-2 pl-3 text-[var(--pump-muted)] group-hover:bg-[var(--pump-surface)]/60">
        #{rank}
      </td>
      <td className="max-w-[200px] px-2 py-2 group-hover:bg-[var(--pump-surface)]/45">
        <Link href={`/token/${coin.mint}`} className="flex min-w-0 items-center gap-2">
          <ExploreCoinThumb coin={coin} className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{coin.name}</p>
            <p className="truncate text-[11px] text-[var(--pump-muted)]">{coin.symbol}</p>
          </div>
        </Link>
      </td>
      <td className="px-2 py-2 group-hover:bg-[var(--pump-surface)]/45">
        <MiniSparkline h24={coin.priceChange.h24} seed={coin.mint} />
      </td>
      <td className="px-2 py-2 group-hover:bg-[var(--pump-surface)]/45">
        <div className="flex min-w-[5.5rem] flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-400">{formatExploreMcap(coin)}</span>
            <div className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--pump-border)]">
              <div className="h-full w-[70%] rounded-full bg-emerald-400" />
            </div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 group-hover:bg-[var(--pump-surface)]/45">
        <div className="flex min-w-[100px] items-center gap-2">
          <div className="relative h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--pump-border)]">
            <div
              className="h-full rounded-full bg-emerald-500/90"
              style={{ width: `${Math.round(ath.fillRatio * 100)}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-[11px] text-[var(--pump-text)]">{ath.display}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[var(--pump-muted)] group-hover:bg-[var(--pump-surface)]/45">
        {formatLaunchAgo(coin.createdAt)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[var(--pump-text)] group-hover:bg-[var(--pump-surface)]/45">
        {coin.txnsH24 != null ? coin.txnsH24 : "—"}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[var(--pump-text)] group-hover:bg-[var(--pump-surface)]/45">
        {formatVolumeUsd24h(coin.vol24h)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[var(--pump-muted)] group-hover:bg-[var(--pump-surface)]/45">—</td>
      <td className={`whitespace-nowrap px-2 py-2 group-hover:bg-[var(--pump-surface)]/45 ${pctCell(coin.priceChange.m5).cls}`}>
        {pctCell(coin.priceChange.m5).text}
      </td>
      <td className={`whitespace-nowrap px-2 py-2 group-hover:bg-[var(--pump-surface)]/45 ${pctCell(coin.priceChange.h1).cls}`}>
        {pctCell(coin.priceChange.h1).text}
      </td>
      <td className={`whitespace-nowrap px-2 py-2 group-hover:bg-[var(--pump-surface)]/45 ${pctCell(coin.priceChange.h6).cls}`}>
        {pctCell(coin.priceChange.h6).text}
      </td>
      <td className={`whitespace-nowrap px-2 py-2 group-hover:bg-[var(--pump-surface)]/45 ${pctCell(coin.priceChange.h24).cls}`}>
        {pctCell(coin.priceChange.h24).text}
      </td>
      <td className="sticky right-0 z-[1] bg-[var(--pump-elevated)] px-1 py-2 pr-3 text-center group-hover:bg-[var(--pump-surface)]/60">
        <button
          type="button"
          aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
          className="cursor-pointer rounded-md p-1.5 text-lg leading-none text-[var(--pump-muted)] transition hover:bg-[var(--pump-surface)] hover:text-amber-300"
          onClick={() => {
            toggleWatchlistMint(coin.mint);
            bump();
          }}
        >
          {starred ? "★" : "☆"}
        </button>
      </td>
    </tr>
  );
}

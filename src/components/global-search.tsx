"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { DROP_COINS_UPDATED_EVENT, type CreatedCoinRecord } from "@/lib/created-coins-storage";
import { truncateMintMiddle } from "@/lib/drop-coins";
import { loadDropLaunchesForUi } from "@/lib/load-drop-launches";
import { fetchSolanaTokenBestMcapUsd, formatMcapUsd } from "@/lib/dexscreener-mcap";
import { formatLaunchAgo } from "@/lib/launch-time";
import { mintGradient } from "@/lib/mint-visual";

type Row = CreatedCoinRecord & { mcap: number | null };

export type GlobalSearchLayout = "bar" | "icon";

export function GlobalSearch({ layout }: { layout: GlobalSearchLayout }) {
  const listboxId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshRows = useCallback(async () => {
    const base = await loadDropLaunchesForUi();
    const next: Row[] = base.map((c) => ({ ...c, mcap: null }));
    setRows(next);
    await Promise.all(
      next.map(async (c) => {
        const m = await fetchSolanaTokenBestMcapUsd(c.mint);
        setRows((prev) => prev.map((r) => (r.mint === c.mint ? { ...r, mcap: m } : r)));
      }),
    );
  }, []);

  useEffect(() => {
    const run = () => startTransition(() => void refreshRows());
    run();
    window.addEventListener(DROP_COINS_UPDATED_EVENT, run);
    return () => window.removeEventListener(DROP_COINS_UPDATED_EVENT, run);
  }, [refreshRows]);

  const searchShortcutLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl+K";
    const ua = navigator.userAgent;
    const p = navigator.platform;
    const isApple = /Mac|iPhone|iPad|iPod/i.test(ua) || p === "MacIntel";
    return isApple ? "⌘K" : "Ctrl+K";
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      // Never treat clicks on the left rail as "outside" the search UI (avoids extra work + edge cases with the rail toggle).
      if (t instanceof Element && t.closest("[data-pump-sidebar]")) return;
      if (!wrapRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        queueMicrotask(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const qt = q.trim();
    if (!qt) return rows.slice(0, 8);
    const t = qt.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(t) ||
        r.symbol.toLowerCase().includes(t) ||
        r.mint === qt ||
        r.mint.toLowerCase().includes(t),
    );
  }, [q, rows]);

  const results = (
    <>
      {filtered.length > 0 ? (
        filtered.map((c) => <SearchRow key={c.mint} coin={c} onPick={() => setOpen(false)} />)
      ) : (
        <p className="px-4 py-6 text-center text-sm text-[var(--pump-muted)]">
          {q.trim()
            ? "No drops coins match that search."
            : "No drops coins yet (create one; mint ends in drop)."}
        </p>
      )}
    </>
  );

  if (layout === "icon") {
    return (
      <div ref={wrapRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            queueMicrotask(() => inputRef.current?.focus());
          }}
          aria-label="Search"
          aria-expanded={open}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-[var(--pump-surface)] text-white transition hover:border-white/15 ${
            open ? "border-[var(--pump-green)] ring-1 ring-[var(--pump-green)]/25" : "border-[var(--pump-border)]"
          }`}
        >
          <IconSearch className="h-[1.35rem] w-[1.35rem]" />
        </button>

        {open ? (
          <div
            id={listboxId}
            className="fixed left-3 right-3 top-[calc(3.75rem+4px)] z-[60] flex max-h-[min(78vh,520px)] flex-col overflow-hidden rounded-xl border border-[var(--pump-border)] bg-[#141414] shadow-2xl shadow-black/60"
            role="listbox"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--pump-border)] px-3 py-2">
              <span className="shrink-0 text-[var(--pump-yellow)] opacity-90">⌕</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search drops…"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--pump-text)] outline-none placeholder:text-[var(--pump-muted)]"
                aria-label="Search drops coins by name, symbol, or mint"
                aria-controls={listboxId}
              />
              {q ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
                  aria-label="Clear"
                  onClick={() => {
                    setQ("");
                    inputRef.current?.focus();
                  }}
                >
                  ✕
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">{results}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative mx-auto min-w-0 w-full max-w-2xl flex-1">
      <div
        className={`flex h-11 items-center gap-2 rounded-xl border bg-[var(--pump-surface)] px-3 py-0 text-left text-sm transition sm:px-4 ${
          open ? "border-[var(--pump-green)] ring-1 ring-[var(--pump-green)]/30" : "border-[var(--pump-border)]"
        }`}
      >
        <span className="shrink-0 text-[var(--pump-yellow)] opacity-90">⌕</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search drops (name, ticker, mint)…"
          className="min-h-0 min-w-0 flex-1 bg-transparent text-sm leading-none text-[var(--pump-text)] outline-none placeholder:text-[var(--pump-muted)]"
          aria-label="Search drops coins by name, symbol, or mint"
          aria-controls={listboxId}
        />
        {q ? (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
            aria-label="Clear"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        ) : null}
        <kbd
          className="ml-auto inline-flex shrink-0 items-center rounded border border-[var(--pump-border)] bg-[var(--pump-bg)] px-1.5 py-0.5 font-mono text-[10px] leading-none text-[var(--pump-muted)]"
          suppressHydrationWarning
        >
          {searchShortcutLabel}
        </kbd>
      </div>

      {open ? (
        <div
          id={listboxId}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-xl border border-[var(--pump-border)] bg-[#141414] py-1 shadow-2xl shadow-black/60"
          role="listbox"
        >
          {results}
        </div>
      ) : null}
    </div>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={`pointer-events-none ${className ?? ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function SearchRow({ coin, onPick }: { coin: Row; onPick: () => void }) {
  const g = mintGradient(coin.mint);
  return (
    <Link
      href={`https://solscan.io/token/${coin.mint}`}
      target="_blank"
      rel="noreferrer"
      role="option"
      onClick={onPick}
      className="flex gap-3 border-b border-[var(--pump-border)] px-3 py-2.5 last:border-b-0 hover:bg-[var(--pump-surface)]"
    >
      <SearchThumb coin={coin} g={g} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{coin.name}</p>
        <p className="mt-0.5 text-xs text-[var(--pump-muted)]">
          <span className="font-mono">{coin.symbol}</span>{" "}
          <span className="font-semibold text-[var(--pump-green)]">{formatMcapUsd(coin.mcap)}</span>
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--pump-muted)]">{truncateMintMiddle(coin.mint)}</p>
        <p className="mt-0.5 text-[10px] text-[var(--pump-muted)]">{formatLaunchAgo(coin.createdAt)}</p>
      </div>
    </Link>
  );
}

function SearchThumb({ coin, g }: { coin: CreatedCoinRecord; g: { from: string; to: string } }) {
  if (coin.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coin.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
    );
  }
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white/90"
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      {coin.symbol.slice(0, 2)}
    </div>
  );
}

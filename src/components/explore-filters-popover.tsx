"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { formatUsdFilterCompact } from "@/lib/dexscreener-mcap";
import type { ExploreEnrichedCoin } from "@/lib/explore-coin-types";
import { exploreMcapUsd } from "@/lib/explore-mcap";

export type ExploreAppliedFilters = {
  mcapMinUsd: number;
  mcapMaxUsd: number;
  volMinUsd: number;
  volMaxUsd: number;
};

const MCAP_MIN = 1_000;
const MCAP_MAX = 50_000_000;
const VOL_MIN = 0;
const VOL_MAX = 500_000;
const MCAP_STEP = 1_000;
const VOL_STEP = 1_000;

const DEFAULT_DRAFT: ExploreAppliedFilters = {
  mcapMinUsd: MCAP_MIN,
  mcapMaxUsd: MCAP_MAX,
  volMinUsd: VOL_MIN,
  volMaxUsd: VOL_MAX,
};

export function isExploreFilterFullRange(f: ExploreAppliedFilters): boolean {
  return (
    f.mcapMinUsd <= MCAP_MIN &&
    f.mcapMaxUsd >= MCAP_MAX &&
    f.volMinUsd <= VOL_MIN &&
    f.volMaxUsd >= VOL_MAX
  );
}

export function passesExploreFilters(c: ExploreEnrichedCoin, f: ExploreAppliedFilters | null): boolean {
  if (!f || isExploreFilterFullRange(f)) return true;
  const m = exploreMcapUsd(c);
  const v = c.vol24h ?? 0;
  return m >= f.mcapMinUsd && m <= f.mcapMaxUsd && v >= f.volMinUsd && v <= f.volMaxUsd;
}

function parseUsdLoose(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!t) return null;
  const m = t.match(/^([\d.]+)(k|m|b)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const suf = m[2];
  if (suf === "k") return n * 1_000;
  if (suf === "m") return n * 1_000_000;
  if (suf === "b") return n * 1_000_000_000;
  return n;
}

type Props = {
  applied: ExploreAppliedFilters | null;
  onApply: (next: ExploreAppliedFilters | null) => void;
};

export function ExploreFiltersPopover({ applied, onApply }: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExploreAppliedFilters>(DEFAULT_DRAFT);
  const [mcapMinText, setMcapMinText] = useState("");
  const [mcapMaxText, setMcapMaxText] = useState("");
  const [volMinText, setVolMinText] = useState("");
  const [volMaxText, setVolMaxText] = useState("");

  const syncTexts = useCallback((d: ExploreAppliedFilters) => {
    setMcapMinText(formatUsdFilterCompact(d.mcapMinUsd));
    setMcapMaxText(formatUsdFilterCompact(d.mcapMaxUsd));
    setVolMinText(formatUsdFilterCompact(d.volMinUsd));
    setVolMaxText(formatUsdFilterCompact(d.volMaxUsd));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (!wrapRef.current?.contains(t)) setOpen(false);
    }
    if (!open) return;
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const mergeTextsIntoDraft = useCallback(
    (d: ExploreAppliedFilters): ExploreAppliedFilters => {
      const m0 = parseUsdLoose(mcapMinText);
      const m1 = parseUsdLoose(mcapMaxText);
      const v0 = parseUsdLoose(volMinText);
      const v1 = parseUsdLoose(volMaxText);
      const mcapMinUsd = m0 != null ? Math.min(MCAP_MAX - MCAP_STEP, Math.max(MCAP_MIN, m0)) : d.mcapMinUsd;
      const mcapMaxRaw = m1 != null ? Math.min(MCAP_MAX, Math.max(MCAP_MIN + MCAP_STEP, m1)) : d.mcapMaxUsd;
      const mcapMaxUsd =
        mcapMinUsd >= mcapMaxRaw ? Math.min(MCAP_MAX, mcapMinUsd + MCAP_STEP) : mcapMaxRaw;
      const volMinUsd = v0 != null ? Math.min(VOL_MAX - VOL_STEP, Math.max(VOL_MIN, v0)) : d.volMinUsd;
      const volMaxRaw = v1 != null ? Math.min(VOL_MAX, Math.max(VOL_MIN + VOL_STEP, v1)) : d.volMaxUsd;
      const volMaxUsd = volMinUsd >= volMaxRaw ? Math.min(VOL_MAX, volMinUsd + VOL_STEP) : volMaxRaw;
      return { mcapMinUsd, mcapMaxUsd, volMinUsd, volMaxUsd };
    },
    [mcapMinText, mcapMaxText, volMinText, volMaxText],
  );

  const commitDraftFromInputs = useCallback(() => {
    setDraft((d) => {
      const next = mergeTextsIntoDraft(d);
      queueMicrotask(() => syncTexts(next));
      return next;
    });
  }, [mergeTextsIntoDraft, syncTexts]);

  const handleApply = () => {
    const next = mergeTextsIntoDraft(draft);
    setDraft(next);
    syncTexts(next);
    if (isExploreFilterFullRange(next)) onApply(null);
    else onApply(next);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(DEFAULT_DRAFT);
    syncTexts(DEFAULT_DRAFT);
    onApply(null);
  };

  const active = applied != null && !isExploreFilterFullRange(applied);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const base = applied && !isExploreFilterFullRange(applied) ? applied : DEFAULT_DRAFT;
          setDraft(base);
          syncTexts(base);
          setOpen(true);
        }}
        className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border text-white transition sm:h-10 sm:w-10 ${
          open || active
            ? "border-[var(--pump-green)] bg-[var(--pump-surface)] ring-1 ring-[var(--pump-green)]/25"
            : "border-[var(--pump-border)] bg-[var(--pump-surface)] hover:border-white/20"
        }`}
        title="Filter by mcap & 24h volume"
      >
        <IconFilter className="h-[18px] w-[18px] text-[var(--pump-text)]" />
      </button>

      {open ? (
        <div
          id={`${id}-panel`}
          className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-1.5rem),20rem)] rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-4 shadow-xl shadow-black/40"
          role="dialog"
          aria-label="Explore filters"
        >
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
              <span>Mcap</span>
              <span className="text-[11px] font-normal text-[var(--pump-muted)]">
                {formatUsdFilterCompact(draft.mcapMinUsd)} – {formatUsdFilterCompact(draft.mcapMaxUsd)}
              </span>
            </div>
            <div className="relative h-7 w-full shrink-0">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--pump-border)]" />
              <div
                className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--pump-green)]"
                style={{
                  left: `${((draft.mcapMinUsd - MCAP_MIN) / (MCAP_MAX - MCAP_MIN)) * 100}%`,
                  width: `${((draft.mcapMaxUsd - draft.mcapMinUsd) / (MCAP_MAX - MCAP_MIN)) * 100}%`,
                }}
              />
              <input
                type="range"
                min={MCAP_MIN}
                max={MCAP_MAX}
                step={MCAP_STEP}
                value={draft.mcapMinUsd}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setDraft((d) => {
                    const lo = Math.min(d.mcapMaxUsd - MCAP_STEP, Math.max(MCAP_MIN, raw));
                    queueMicrotask(() => setMcapMinText(formatUsdFilterCompact(lo)));
                    return { ...d, mcapMinUsd: lo };
                  });
                }}
                className="explore-filter-range absolute inset-0 z-[2] w-full cursor-pointer"
              />
              <input
                type="range"
                min={MCAP_MIN}
                max={MCAP_MAX}
                step={MCAP_STEP}
                value={draft.mcapMaxUsd}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setDraft((d) => {
                    const hi = Math.max(d.mcapMinUsd + MCAP_STEP, Math.min(MCAP_MAX, raw));
                    queueMicrotask(() => setMcapMaxText(formatUsdFilterCompact(hi)));
                    return { ...d, mcapMaxUsd: hi };
                  });
                }}
                className="explore-filter-range absolute inset-0 z-[3] w-full cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--pump-muted)]">
              <span>{formatUsdFilterCompact(MCAP_MIN)}</span>
              <span>{formatUsdFilterCompact(MCAP_MAX)}+</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-medium text-[var(--pump-muted)]">
                Minimum
                <input
                  value={mcapMinText}
                  onChange={(e) => setMcapMinText(e.target.value)}
                  onBlur={commitDraftFromInputs}
                  placeholder="e.g., 10k, 1m"
                  className="mt-1 w-full rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 py-1.5 text-xs text-[var(--pump-text)] outline-none placeholder:text-[var(--pump-muted)] focus:border-[var(--pump-green)]/50"
                />
              </label>
              <label className="block text-[10px] font-medium text-[var(--pump-muted)]">
                Maximum
                <input
                  value={mcapMaxText}
                  onChange={(e) => setMcapMaxText(e.target.value)}
                  onBlur={commitDraftFromInputs}
                  placeholder="e.g., 50m"
                  className="mt-1 w-full rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 py-1.5 text-xs text-[var(--pump-text)] outline-none placeholder:text-[var(--pump-muted)] focus:border-[var(--pump-green)]/50"
                />
              </label>
            </div>
          </section>

          <section className="mt-5 space-y-3 border-t border-[var(--pump-border)] pt-4">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
              <span>24h Vol</span>
              <span className="text-[11px] font-normal text-[var(--pump-muted)]">
                {formatUsdFilterCompact(draft.volMinUsd)} – {formatUsdFilterCompact(draft.volMaxUsd)}
              </span>
            </div>
            <div className="relative h-7 w-full shrink-0">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--pump-border)]" />
              <div
                className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--pump-green)]"
                style={{
                  left: `${VOL_MAX > VOL_MIN ? ((draft.volMinUsd - VOL_MIN) / (VOL_MAX - VOL_MIN)) * 100 : 0}%`,
                  width: `${VOL_MAX > VOL_MIN ? ((draft.volMaxUsd - draft.volMinUsd) / (VOL_MAX - VOL_MIN)) * 100 : 100}%`,
                }}
              />
              <input
                type="range"
                min={VOL_MIN}
                max={VOL_MAX}
                step={VOL_STEP}
                value={draft.volMinUsd}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setDraft((d) => {
                    const lo = Math.min(d.volMaxUsd - VOL_STEP, Math.max(VOL_MIN, raw));
                    queueMicrotask(() => setVolMinText(formatUsdFilterCompact(lo)));
                    return { ...d, volMinUsd: lo };
                  });
                }}
                className="explore-filter-range absolute inset-0 z-[2] w-full cursor-pointer"
              />
              <input
                type="range"
                min={VOL_MIN}
                max={VOL_MAX}
                step={VOL_STEP}
                value={draft.volMaxUsd}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setDraft((d) => {
                    const hi = Math.max(d.volMinUsd + VOL_STEP, Math.min(VOL_MAX, raw));
                    queueMicrotask(() => setVolMaxText(formatUsdFilterCompact(hi)));
                    return { ...d, volMaxUsd: hi };
                  });
                }}
                className="explore-filter-range absolute inset-0 z-[3] w-full cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--pump-muted)]">
              <span>{formatUsdFilterCompact(VOL_MIN)}</span>
              <span>{formatUsdFilterCompact(VOL_MAX)}+</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-medium text-[var(--pump-muted)]">
                Minimum
                <input
                  value={volMinText}
                  onChange={(e) => setVolMinText(e.target.value)}
                  onBlur={commitDraftFromInputs}
                  placeholder="e.g., 5k, 100k"
                  className="mt-1 w-full rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 py-1.5 text-xs text-[var(--pump-text)] outline-none placeholder:text-[var(--pump-muted)] focus:border-[var(--pump-green)]/50"
                />
              </label>
              <label className="block text-[10px] font-medium text-[var(--pump-muted)]">
                Maximum
                <input
                  value={volMaxText}
                  onChange={(e) => setVolMaxText(e.target.value)}
                  onBlur={commitDraftFromInputs}
                  placeholder="e.g., 500k"
                  className="mt-1 w-full rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 py-1.5 text-xs text-[var(--pump-text)] outline-none placeholder:text-[var(--pump-muted)] focus:border-[var(--pump-green)]/50"
                />
              </label>
            </div>
          </section>

          <div className="mt-5 flex gap-3 border-t border-[var(--pump-border)] pt-4">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 cursor-pointer rounded-xl border-2 border-[var(--pump-border)] bg-[var(--pump-surface)] px-4 py-3 text-sm font-bold text-white shadow-[0_3px_0_0_rgba(0,0,0,0.45)] transition hover:bg-[var(--pump-surface-hover)] active:translate-y-px active:shadow-[0_1px_0_0_rgba(0,0,0,0.35)]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 cursor-pointer rounded-xl border-2 border-[color-mix(in_oklab,var(--pump-green)_65%,#000)] bg-[var(--pump-green)] px-4 py-3 text-sm font-bold text-black shadow-[0_3px_0_0_rgba(0,0,0,0.35)] transition hover:brightness-110 active:translate-y-px active:shadow-[0_1px_0_0_rgba(0,0,0,0.25)]"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconFilter({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
      />
    </svg>
  );
}

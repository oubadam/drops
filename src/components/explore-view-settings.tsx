"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ExploreViewMode = "grid" | "table";

const STORAGE_KEY = "drop_explore_view_mode_v1";

export function readExploreViewMode(): ExploreViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "table") return "table";
  } catch {
    /* ignore */
  }
  return "grid";
}

export function writeExploreViewMode(mode: ExploreViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

type Props = {
  value: ExploreViewMode;
  onChange: (mode: ExploreViewMode) => void;
};

export function ExploreViewSettings({ value, onChange }: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

  const pick = useCallback(
    (mode: ExploreViewMode) => {
      onChange(mode);
      writeExploreViewMode(mode);
    },
    [onChange],
  );

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-view-panel`}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border text-white transition sm:h-10 sm:w-10 ${
          open
            ? "border-[var(--pump-green)] bg-[var(--pump-surface)] ring-1 ring-[var(--pump-green)]/25"
            : "border-[var(--pump-border)] bg-[var(--pump-surface)] hover:border-white/20"
        }`}
        title="View settings"
      >
        <IconGear className="h-[18px] w-[18px] text-[var(--pump-text)]" />
      </button>

      {open ? (
        <div
          id={`${id}-view-panel`}
          className="absolute right-0 z-50 mt-2 rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-2 shadow-xl shadow-black/40"
          role="dialog"
          aria-label="View layout"
        >
          <div className="flex rounded-full bg-[var(--pump-surface)] p-0.5">
            <button
              type="button"
              onClick={() => pick("grid")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition sm:text-[13px] ${
                value === "grid"
                  ? "bg-black text-white shadow-sm"
                  : "text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
              }`}
            >
              <IconGrid className="h-3.5 w-3.5 shrink-0 opacity-90" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => pick("table")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition sm:text-[13px] ${
                value === "table"
                  ? "bg-black text-white shadow-sm"
                  : "text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
              }`}
            >
              <IconTable className="h-3.5 w-3.5 shrink-0 opacity-90" />
              Table
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.41 1.32 1.04 1.59.63.27 1.36.2 1.92-.19l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82Z"
      />
    </svg>
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 16 16" aria-hidden>
      <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" />
    </svg>
  );
}

function IconTable({ className }: { className?: string }) {
  /** List / table: hollow bullet + rounded bar per row (matches product table icon). */
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.35} aria-hidden>
      <circle cx="3.25" cy="4.5" r="1.35" />
      <path strokeLinecap="round" d="M6.5 4.5h7.25" />
      <circle cx="3.25" cy="11.5" r="1.35" />
      <path strokeLinecap="round" d="M6.5 11.5h7.25" />
    </svg>
  );
}

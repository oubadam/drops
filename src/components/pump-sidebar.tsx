"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useCallback, useLayoutEffect, useState } from "react";
import { IconSidebarCollapseMark, IconSidebarExpandMark } from "@/components/icon-sidebar-toggle";
import { IconUserInCircle } from "@/components/icon-user-in-circle";

const COLLAPSE_STORAGE_KEY = "drop_sidebar_collapsed_v1";

type NavItem = { href: string; label: string; icon: typeof IconHome };

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/create", label: "Create", icon: IconPlus },
  { href: "/profile", label: "Profile", icon: IconUserInCircleNav },
  { href: "/docs", label: "Docs", icon: IconDoc },
];

/** Collapse state lives here so the same component that owns width classes always re-renders on toggle. */
export function PumpSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") {
        startTransition(() => setCollapsed(true));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      data-pump-sidebar
      className={`relative z-50 hidden h-full shrink-0 grow-0 basis-auto overflow-x-hidden bg-[var(--pump-sidebar)] py-5 transition-[width,padding] duration-200 ease-out sm:flex sm:flex-col ${
        collapsed
          ? "w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] items-stretch px-1.5"
          : "w-[var(--sidebar-w)] min-w-[var(--sidebar-w)] max-w-[var(--sidebar-w)] px-3.5"
      }`}
    >
      <div
        className={
          collapsed
            ? "relative isolate z-[1] flex w-full min-w-0 flex-col items-center gap-2 px-0.5"
            : "relative isolate z-[1] grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2"
        }
      >
        <Link
          href="/"
          className={`min-w-0 font-bold tracking-tight text-[var(--pump-yellow)] ${collapsed ? "max-w-full py-0.5 text-center text-base" : "truncate py-1 text-xl"}`}
          title="drop"
        >
          {collapsed ? "d" : "drop"}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="relative z-[2] flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center self-center rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] text-white shadow-sm transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.98]"
        >
          {collapsed ? <IconSidebarExpandMark className="h-[18px] w-[18px]" /> : <IconSidebarCollapseMark className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {!collapsed && (
        <p className="mt-1 px-2 text-[11px] leading-snug text-[var(--pump-muted)]">
          UI inspired by{" "}
          <a href="https://pump.fun/" className="text-[var(--pump-green)] hover:underline" target="_blank" rel="noreferrer">
            pump.fun
          </a>
        </p>
      )}

      <nav className={`mt-7 flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden ${collapsed ? "items-center" : ""}`}>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={`flex items-center rounded-xl py-3 text-[15px] font-medium leading-snug text-white transition-colors ${
                collapsed ? "w-11 justify-center px-0" : "gap-3.5 px-3"
              } ${
                active ? "bg-[var(--pump-nav-active-bg)] hover:bg-[#1f1f1f]" : "hover:bg-white/[0.04]"
              }`}
            >
              <Icon className={`h-[22px] w-[22px] shrink-0 ${active ? "text-[var(--pump-green)]" : "text-white"}`} />
              {!collapsed && <span className="text-white">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/create"
        title="Create"
        className={`mt-5 flex items-center justify-center bg-[var(--pump-green)] font-bold text-black transition hover:opacity-90 ${
          collapsed ? "mx-auto h-11 w-11 shrink-0 rounded-full p-0 text-xl leading-none" : "w-full rounded-2xl py-3.5 text-[15px]"
        }`}
      >
        {collapsed ? "+" : "Create"}
      </Link>

      {!collapsed && (
        <>
          <div className="mt-5 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--pump-muted)]">Creator rewards</span>
              <span className="rounded bg-[var(--pump-yellow-dim)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--pump-yellow)]">
                New
              </span>
            </div>
            <p className="mt-2.5 text-xl font-bold tracking-tight text-[var(--pump-text)]">$0.00</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--pump-muted)]">Placeholder until wallet connect.</p>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3.5">
            <p className="text-[13px] font-semibold text-[var(--pump-text)]">drop app</p>
            <div className="mt-3 flex gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--pump-border)] bg-[var(--pump-bg)] text-[10px] text-[var(--pump-muted)]">
                QR
              </div>
              <div className="min-w-0">
                <p className="text-[12px] leading-snug text-[var(--pump-muted)]">Mobile app (coming soon).</p>
                <Link
                  href="/docs"
                  className="mt-2 inline-block rounded-lg border border-[var(--pump-border)] px-2 py-1 text-[11px] font-medium text-[var(--pump-text)] hover:border-[var(--pump-green)]/40"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {collapsed && (
        <div className="mt-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[var(--pump-border)] bg-[var(--pump-surface)] text-[9px] text-[var(--pump-muted)]">
            QR
          </div>
        </div>
      )}

      <div className={`mt-auto border-t border-[var(--pump-border)] pt-4 ${collapsed ? "px-0" : ""}`}>
        {!collapsed ? (
          <>
            <details className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-medium text-[var(--pump-muted)] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between">
                  Holdings
                  <span className="text-[var(--pump-text)]">▾</span>
                </span>
              </summary>
              <p className="mt-2 text-xs text-[var(--pump-muted)]">No positions (placeholder).</p>
            </details>
            <p className="mt-3 px-1 text-[10px] leading-relaxed text-[var(--pump-muted)]">
              Not affiliated with{" "}
              <a className="text-[var(--pump-green)] hover:underline" href="https://pump.fun/" target="_blank" rel="noreferrer">
                pump.fun
              </a>
              .
            </p>
          </>
        ) : (
          <p className="px-0.5 text-center text-[9px] leading-tight text-[var(--pump-muted)]">
            <a className="text-[var(--pump-green)] hover:underline" href="https://pump.fun/" target="_blank" rel="noreferrer" title="pump.fun">
              pf
            </a>
          </p>
        )}
      </div>
    </aside>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}
function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
function IconUserInCircleNav({ className }: { className?: string }) {
  return <IconUserInCircle className={className} strokeWidth={1.5} />;
}
function IconDoc({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

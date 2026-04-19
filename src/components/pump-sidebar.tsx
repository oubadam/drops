"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useCallback, useLayoutEffect, useState } from "react";
import normaldrop from "@/components/normaldrop.png";
import { IconSidebarCollapseMark, IconSidebarExpandMark } from "@/components/icon-sidebar-toggle";
import { IconUserInCircle } from "@/components/icon-user-in-circle";

const COLLAPSE_STORAGE_KEY = "drop_sidebar_collapsed_v1";

type NavItem = { href: string; label: string; icon: typeof IconHome };

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
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
      className={`relative z-50 hidden h-full shrink-0 grow-0 basis-auto overflow-x-hidden bg-[var(--pump-sidebar)] py-5 transition-[width,padding] duration-500 ease-in-out md:flex md:flex-col ${
        collapsed
          ? "w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] items-stretch px-1.5"
          : "w-[var(--sidebar-w)] min-w-[var(--sidebar-w)] max-w-[var(--sidebar-w)] px-3"
      }`}
    >
      <div
        className={
          collapsed
            ? "relative isolate z-[1] flex w-full min-w-0 flex-col items-center gap-2 px-0.5"
            : "relative isolate z-[1] grid w-full min-w-0 grid-cols-[minmax(min-content,1fr)_auto] items-center gap-1.5 px-1.5"
        }
      >
        <Link
          href="/"
          className={`flex min-w-0 items-center ${collapsed ? "justify-center gap-0 py-0.5" : "min-h-0 min-w-0 gap-1.5 justify-self-start py-1"}`}
          title="drops.fun"
        >
          <Image
            src={normaldrop}
            alt={collapsed ? "drops.fun" : ""}
            width={normaldrop.width}
            height={normaldrop.height}
            className={
              collapsed
                ? "h-10 w-auto max-w-[3.25rem] shrink-0 object-contain object-left sm:h-11"
                : "h-10 w-auto max-w-[2.85rem] shrink-0 object-contain object-left sm:h-11 sm:max-w-[3.1rem]"
            }
            sizes={collapsed ? "52px" : "180px"}
            priority
          />
          {!collapsed && (
            <span className="shrink-0 whitespace-nowrap text-[1.3125rem] font-bold leading-none tracking-tight text-white sm:text-[1.4rem]">
              drops<span className="mx-px inline text-[var(--pump-green)]">.</span>fun
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="relative z-[2] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center self-center rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] text-white shadow-sm transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.98]"
        >
          {collapsed ? <IconSidebarExpandMark className="h-[18px] w-[18px]" /> : <IconSidebarCollapseMark className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <nav className={`mt-6 flex min-h-0 flex-col gap-1 overflow-x-hidden ${collapsed ? "items-center" : ""}`}>
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
        aria-label="Create"
        className={`mt-2 flex items-center justify-center bg-[var(--pump-green)] font-bold text-black transition hover:opacity-90 ${
          collapsed ? "mx-auto h-11 w-11 shrink-0 rounded-full p-0 text-xl leading-none" : "w-full rounded-2xl py-3.5 text-[15px]"
        }`}
      >
        {collapsed ? <IconPlus className="h-[22px] w-[22px] shrink-0 text-black" /> : "Create"}
      </Link>

      {!collapsed && (
        <div className="mt-3 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[var(--pump-muted)]">Creator rewards</span>
            <span className="rounded bg-[var(--pump-yellow-dim)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--pump-yellow)]">
              New
            </span>
          </div>
          <p className="mt-2.5 text-xl font-bold tracking-tight text-[var(--pump-text)]">$0.00</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--pump-muted)]">Placeholder until wallet connect.</p>
        </div>
      )}
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

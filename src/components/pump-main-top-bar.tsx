"use client";

import Image from "next/image";
import Link from "next/link";
import normaldrop from "@/components/normaldrop.png";
import { GlobalSearch } from "@/components/global-search";

export function PumpMainTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-[3.75rem] shrink-0 items-center gap-2 bg-[var(--pump-bg)]/95 px-3 backdrop-blur-sm md:gap-3 md:px-5">
      {/* `md:` = left rail visible; `@min…/topbar` = main pane wide. Below `md` use bottom nav + compact top row. */}
      <div className="hidden w-8 shrink-0 md:@min-[560px]/topbar:block" aria-hidden />

      <div className="hidden min-h-0 min-w-0 flex-1 items-center gap-2 md:@min-[560px]/topbar:flex">
        <div className="relative flex min-w-0 flex-1 justify-center px-1">
          <GlobalSearch layout="bar" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CreateNavButton expanded />
          <ProfileBlock expanded />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1.5 md:@min-[560px]/topbar:hidden">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 py-0.5 md:hidden"
          title="drops.fun"
          aria-label="drops.fun home"
        >
          <Image
            src={normaldrop}
            alt=""
            width={normaldrop.width}
            height={normaldrop.height}
            className="h-9 w-auto max-w-[2.5rem] shrink-0 object-contain"
            sizes="42px"
            priority
          />
          <span className="whitespace-nowrap text-lg font-bold leading-none tracking-tight text-white @[380px]/topbar:text-xl @[420px]/topbar:text-[1.35rem]">
            drops<span className="mx-px inline text-[var(--pump-green)]">.</span>fun
          </span>
        </Link>
        <div className="min-w-0 flex-1" aria-hidden />
        <div className="flex shrink-0 items-center gap-2">
          <GlobalSearch layout="icon" />
          <CreateNavButton expanded={false} />
          <ProfileCompact />
        </div>
      </div>
    </header>
  );
}

function CreateNavButton({ expanded }: { expanded: boolean }) {
  if (expanded) {
    return (
      <Link
        href="/create"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3.5 text-xs font-semibold text-[var(--pump-text)] transition hover:border-[var(--pump-green)]/40"
      >
        + Create
      </Link>
    );
  }
  return (
    <Link
      href="/create"
      aria-label="Create"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] text-white transition hover:border-white/15"
    >
      <IconPlus className="pointer-events-none h-[1.35rem] w-[1.35rem]" />
    </Link>
  );
}

function ProfileCompact() {
  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] text-xs font-bold text-[var(--pump-muted)] transition hover:border-[var(--pump-green)]/40"
    >
      ?
    </Link>
  );
}

function ProfileBlock({ expanded }: { expanded: boolean }) {
  if (!expanded) return null;
  return (
    <Link
      href="/profile"
      className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] py-0 pl-2 pr-2 text-left text-xs transition hover:border-[var(--pump-green)]/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pump-border)] text-[10px] font-bold text-[var(--pump-muted)]">
        ?
      </span>
      <span className="hidden min-w-0 flex-col justify-center gap-px leading-none md:flex">
        <span className="font-medium leading-tight text-[var(--pump-text)]">Profile</span>
        <span className="text-[10px] leading-tight text-[var(--pump-muted)]">0.00 SOL</span>
      </span>
      <span className="shrink-0 text-[var(--pump-muted)]">▾</span>
    </Link>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

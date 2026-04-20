"use client";

import Image from "next/image";
import Link from "next/link";
import normaldrop from "@/components/normaldrop.png";
import { GlobalSearch } from "@/components/global-search";
import { PumpTopBarAuthLegacy, PumpTopBarAuthPrivy } from "@/components/pump-top-bar-auth";
import { isPrivyConfigured } from "@/lib/privy-config";

export function PumpMainTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 bg-[var(--pump-bg)]/95 px-3 backdrop-blur-sm md:gap-3 md:px-5">
      {/* `md:` = left rail visible; `@min…/topbar` = main pane wide. Below `md` use bottom nav + compact top row. */}
      <div className="hidden w-8 shrink-0 md:@min-[560px]/topbar:block" aria-hidden />

      <div className="hidden min-h-0 min-w-0 flex-1 items-center gap-2 md:@min-[560px]/topbar:flex">
        <div className="relative flex min-w-0 flex-1 justify-center px-1">
          <GlobalSearch layout="bar" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CreateNavButton expanded />
          {isPrivyConfigured ? <PumpTopBarAuthPrivy expanded /> : <PumpTopBarAuthLegacy expanded />}
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
            className="h-11 w-auto max-w-[2.85rem] shrink-0 object-contain"
            sizes="46px"
            priority
          />
          <span className="whitespace-nowrap text-xl font-bold leading-none tracking-tight text-white @[380px]/topbar:text-2xl @[420px]/topbar:text-[1.6rem]">
            drops<span className="mx-px inline text-[var(--pump-green)]">.</span>fun
          </span>
        </Link>
        <div className="min-w-0 flex-1" aria-hidden />
        <div className="flex shrink-0 items-center gap-2">
          <GlobalSearch layout="icon" />
          <CreateNavButton expanded={false} />
          {isPrivyConfigured ? <PumpTopBarAuthPrivy expanded={false} /> : <PumpTopBarAuthLegacy expanded={false} />}
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
        className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] px-4 text-sm font-semibold text-[var(--pump-text)] transition hover:border-[var(--pump-green)]/40"
      >
        + Create
      </Link>
    );
  }
  return (
    <Link
      href="/create"
      aria-label="Create"
      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] text-white transition hover:border-white/15"
    >
      <IconPlus className="pointer-events-none h-6 w-6" />
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

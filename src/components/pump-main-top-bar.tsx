"use client";

import Link from "next/link";
import { GlobalSearch } from "@/components/global-search";

export function PumpMainTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--pump-border)] bg-[var(--pump-bg)]/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-5">
      {/* `sm:` = rail visible; `@min…/topbar` = main pane wide. Below `sm` the rail is gone (bottom nav) → always compact row. */}
      <div className="hidden w-8 shrink-0 sm:@min-[560px]/topbar:block" aria-hidden />

      <div className="hidden min-h-0 min-w-0 flex-1 items-center gap-2 sm:@min-[560px]/topbar:flex">
        <div className="relative flex min-w-0 flex-1 justify-center px-1">
          <GlobalSearch layout="bar" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VoiceChatButton expanded />
          <CreateNavButton expanded />
          <ProfileBlock expanded />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 sm:@min-[560px]/topbar:hidden">
        <div className="min-w-0 flex-1" aria-hidden />
        <div className="flex shrink-0 items-center gap-2">
          <GlobalSearch layout="icon" />
          <VoiceChatButton expanded={false} />
          <CreateNavButton expanded={false} />
          <ProfileCompact />
        </div>
      </div>
    </header>
  );
}

function VoiceChatButton({ expanded }: { expanded: boolean }) {
  if (expanded) {
    return (
      <button
        type="button"
        className="relative hidden items-center gap-2 rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-1.5 pr-4 text-xs font-medium text-[var(--pump-muted)] transition hover:border-[var(--pump-green)]/40 sm:flex"
      >
        Voice chat
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--pump-green)] px-1 text-[10px] font-bold text-white">
          8
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label="Voice chat"
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] text-white transition hover:border-white/15"
    >
      <IconMic className="pointer-events-none h-5 w-5" />
      <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-[var(--pump-green)] px-0.5 text-[8px] font-bold leading-none text-white">
        8
      </span>
    </button>
  );
}

function CreateNavButton({ expanded }: { expanded: boolean }) {
  if (expanded) {
    return (
      <Link
        href="/create"
        className="rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--pump-text)] transition hover:border-[var(--pump-green)]/40"
      >
        + Create
      </Link>
    );
  }
  return (
    <Link
      href="/create"
      aria-label="Create"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] text-white transition hover:border-white/15"
    >
      <IconPlus className="pointer-events-none h-5 w-5" />
    </Link>
  );
}

function ProfileCompact() {
  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] text-xs font-bold text-[var(--pump-muted)] transition hover:border-[var(--pump-green)]/40"
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
      className="flex items-center gap-2 rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] py-1 pl-2 pr-2 text-left text-xs transition hover:border-[var(--pump-green)]/40"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--pump-border)] text-[10px] font-bold text-[var(--pump-muted)]">
        ?
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="font-medium text-[var(--pump-text)]">Profile</span>
        <span className="text-[10px] text-[var(--pump-muted)]">0.00 SOL</span>
      </span>
      <span className="text-[var(--pump-muted)]">▾</span>
    </Link>
  );
}

function IconMic({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3v-4.5a3 3 0 1 1 6 0v4.5a3 3 0 0 1-3 3Z"
      />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

"use client";

import Link from "next/link";
import { useLogout, usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { useOpenSignIn } from "@/components/sign-in-modal-context";

const SESSION_BOOTSTRAP_LOGOUT_KEY = "drop_privy_bootstrap_logout_v1";

function truncateAddr(s: string) {
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function displayName(user: {
  email?: { address?: string };
  wallet?: { address?: string };
  linkedAccounts?: { type: string; address?: string }[];
}) {
  if (user.email?.address) return user.email.address;
  const addr = user.wallet?.address;
  if (addr) return truncateAddr(addr);
  const first = user.linkedAccounts?.find((a) => a.type === "wallet" && a.address);
  if (first?.address) return truncateAddr(first.address);
  return "Profile";
}

export function PumpTopBarAuthPrivy({ expanded }: { expanded: boolean }) {
  const { ready, authenticated, user } = usePrivy();
  const { logout } = useLogout();
  const { openSignIn } = useOpenSignIn();

  useEffect(() => {
    if (!ready || !authenticated || typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_BOOTSTRAP_LOGOUT_KEY)) return;
    window.sessionStorage.setItem(SESSION_BOOTSTRAP_LOGOUT_KEY, "1");
    // Prevent carrying over stale auth from a previous run; users sign in explicitly via the top-bar button.
    void logout();
  }, [authenticated, logout, ready]);

  if (!ready) {
    return expanded ? (
      <div className="h-12 w-[7.5rem] shrink-0 animate-pulse rounded-full bg-[var(--pump-surface)]" />
    ) : (
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-[var(--pump-surface)]" />
    );
  }

  if (!authenticated) {
    if (expanded) {
      return (
        <button
          type="button"
          onClick={openSignIn}
          className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#7ee8c8] px-6 text-sm font-semibold text-black shadow-sm transition hover:brightness-95 active:brightness-90"
        >
          Sign in
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#7ee8c8] px-4 text-xs font-semibold text-black shadow-sm transition hover:brightness-95 active:brightness-90"
      >
        Sign in
      </button>
    );
  }

  const label = user ? displayName(user) : "Profile";

  if (expanded) {
    return (
      <Link
        href="/profile"
        className="flex h-12 shrink-0 max-w-[14rem] items-center gap-2 rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] py-0 pl-2 pr-2 text-left text-xs transition hover:border-[var(--pump-green)]/40"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--pump-green)]/20 text-[11px] font-bold text-[var(--pump-green)]">
          ✓
        </span>
        <span className="hidden min-w-0 flex-col justify-center gap-px leading-none md:flex">
          <span className="truncate font-medium leading-tight text-[var(--pump-text)]">{label}</span>
          <span className="text-[10px] leading-tight text-[var(--pump-muted)]">Account</span>
        </span>
        <span className="shrink-0 text-[var(--pump-muted)]">▾</span>
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className="grid h-12 max-w-[5.5rem] shrink-0 place-items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 text-[10px] font-bold leading-tight text-[var(--pump-green)] transition hover:border-[var(--pump-green)]/40"
    >
      <span className="truncate">{label.includes("@") ? label.split("@")[0]?.slice(0, 8) : label}</span>
    </Link>
  );
}

export function PumpTopBarAuthLegacy({ expanded }: { expanded: boolean }) {
  const { openSignIn } = useOpenSignIn();
  if (expanded) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#7ee8c8] px-6 text-sm font-semibold text-black shadow-sm transition hover:brightness-95"
      >
        Sign in
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openSignIn}
      className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#7ee8c8] px-4 text-xs font-semibold text-black shadow-sm transition hover:brightness-95"
    >
      Sign in
    </button>
  );
}

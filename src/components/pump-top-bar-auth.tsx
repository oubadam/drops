"use client";

import Link from "next/link";
import { useLogout, usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOpenSignIn } from "@/components/sign-in-modal-context";
import defaultPfp from "@/components/dropspfps.png";
import { fetchProfile, fetchWalletBalance } from "@/lib/profile-api";
import { clearExternalWalletAddress, getExternalWalletAddress, subscribeExternalWallet } from "@/lib/external-wallet-session";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [walletSol, setWalletSol] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [copiedEntered, setCopiedEntered] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const externalWalletAddress = useSyncExternalStore(
    subscribeExternalWallet,
    getExternalWalletAddress,
    () => null,
  );

  useEffect(() => {
    if (!ready || !authenticated || typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_BOOTSTRAP_LOGOUT_KEY)) return;
    window.sessionStorage.setItem(SESSION_BOOTSTRAP_LOGOUT_KEY, "1");
    // Prevent carrying over stale auth from a previous run; users sign in explicitly via the top-bar button.
    void logout();
  }, [authenticated, logout, ready]);

  useEffect(() => {
    if (!externalWalletAddress) {
      return;
    }
    void Promise.all([
      fetchProfile(externalWalletAddress).catch(() => null),
      fetchWalletBalance(externalWalletAddress).catch(() => null),
    ]).then(([profile, balance]) => {
      setWalletName(profile?.username ? `@${profile.username.replace(/^@+/, "")}` : null);
      setWalletSol(balance?.sol ?? 0);
    });
  }, [externalWalletAddress]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function triggerCopiedToast() {
    setCopied(true);
    setCopiedEntered(false);
    window.setTimeout(() => setCopiedEntered(true), 10);
    window.setTimeout(() => setCopiedEntered(false), 2200);
    window.setTimeout(() => setCopied(false), 3000);
  }

  if (!ready) {
    return expanded ? (
      <div className="h-12 w-[7.5rem] shrink-0 animate-pulse rounded-full bg-[var(--pump-surface)]" />
    ) : (
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-[var(--pump-surface)]" />
    );
  }

  if (!authenticated && !externalWalletAddress) {
    if (expanded) {
      return (
        <button
          type="button"
          onClick={openSignIn}
          className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#3b82f6] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
        >
          Sign in
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#3b82f6] px-4 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
      >
        Sign in
      </button>
    );
  }

  const label = user
    ? displayName(user)
    : walletName
      ? walletName.replace(/^@/, "")
      : externalWalletAddress
        ? truncateAddr(externalWalletAddress)
        : "Profile";
  const solLabel = externalWalletAddress ? `${walletSol.toFixed(2)} SOL` : "Account";

  if (expanded) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-12 shrink-0 max-w-[15rem] items-center gap-2 rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] py-0 pl-2 pr-2 text-left text-xs transition hover:border-[var(--pump-green)]/40"
        >
          <Image src={defaultPfp} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
          <span className="hidden min-w-0 items-center gap-2 leading-none md:flex">
            <span className="truncate text-[1.05rem] font-semibold text-[var(--pump-text)]">{label}</span>
            <span className="truncate text-[1.05rem] font-semibold text-[var(--pump-muted)]">{solLabel}</span>
          </span>
          <span className={`shrink-0 text-[var(--pump-muted)] transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}>⌃</span>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#141a23] p-2 shadow-xl shadow-black/40">
            <Link href="/profile" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/5">
              Profile
            </Link>
            <button type="button" onClick={() => { setMenuOpen(false); openSignIn(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5">
              Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                if (externalWalletAddress && navigator.clipboard) {
                  void navigator.clipboard.writeText(externalWalletAddress).then(triggerCopiedToast);
                }
                setMenuOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5"
            >
              Copy address
            </button>
            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false);
                clearExternalWalletAddress();
                if (authenticated) await logout();
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        ) : null}
        {copied ? (
          <div className={`pointer-events-none fixed left-1/2 top-4 z-[260] -translate-x-1/2 rounded-xl border border-[#3b82f6] bg-[#0b1018]/95 px-4 py-3 text-sm font-semibold text-white transition-all duration-700 ease-in-out ${copiedEntered ? "translate-y-4 opacity-100" : "-translate-y-3 opacity-0"}`}>Copied Wallet Address!</div>
        ) : null}
      </div>
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
        className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#3b82f6] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
      >
        Sign in
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openSignIn}
      className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#3b82f6] px-4 text-xs font-semibold text-white shadow-sm transition hover:brightness-95"
    >
      Sign in
    </button>
  );
}

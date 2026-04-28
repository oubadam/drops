"use client";

import Link from "next/link";
import { startTransition, useEffect, useState, useSyncExternalStore } from "react";
import { type CreatedCoinRecord, loadCreatedCoins } from "@/lib/created-coins-storage";
import { getExternalWalletAddress, subscribeExternalWallet } from "@/lib/external-wallet-session";
import { defaultUsernameFromWallet, fetchProfile, fetchWalletBalance, type PersistedProfile } from "@/lib/profile-api";
import Image from "next/image";
import defaultPfp from "@/components/dropspfps.png";
import { useOpenSignIn } from "@/components/sign-in-modal-context";

export default function ProfilePage() {
  const [username, setUsername] = useState("Guest");
  const [copied, setCopied] = useState(false);
  const [coins, setCoins] = useState<CreatedCoinRecord[]>([]);
  const walletAddress = useSyncExternalStore(subscribeExternalWallet, getExternalWalletAddress, () => null);
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  const [balanceUsd, setBalanceUsd] = useState(0);
  const [balanceSol, setBalanceSol] = useState(0);
  const { openSignIn } = useOpenSignIn();

  useEffect(() => {
    const wallet = walletAddress;
    startTransition(() => setCoins(loadCreatedCoins()));
    if (!wallet) return;
    void fetch(`/api/launches?creator=${encodeURIComponent(wallet)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { configured?: boolean; items?: CreatedCoinRecord[] }) => {
        if (j.configured && Array.isArray(j.items)) setCoins(j.items);
      })
      .catch(() => null);
    void Promise.all([fetchProfile(wallet), fetchWalletBalance(wallet)])
      .then(([p, b]) => {
        setProfile(p);
        setUsername(p.username);
        setBalanceUsd(b.usd);
        setBalanceSol(b.sol);
      })
      .catch(() => {
        setUsername(defaultUsernameFromWallet(wallet));
      });
  }, [walletAddress]);

  const walletPreview = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect wallet";

  return (
    <div className="mx-auto w-full max-w-[980px] space-y-6 px-6 pb-20 pt-4">
      <div className="rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-5 py-5">
        <div className="flex min-w-0 gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] ring-2 ring-[var(--pump-yellow)]/25 ring-offset-2 ring-offset-[var(--pump-bg)]">
            <Image
              src={profile?.avatarUrl || defaultPfp}
              alt="profile avatar"
              width={64}
              height={64}
              className="w-16 h-auto object-cover"
              unoptimized={Boolean(profile?.avatarUrl?.startsWith("data:"))}
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight">{username}</h1>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-xs text-[var(--pump-muted)]">{walletPreview}</p>
              {walletAddress ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.clipboard) return;
                    void navigator.clipboard.writeText(walletAddress).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2200);
                    });
                  }}
                  className="cursor-pointer text-xs font-semibold text-[var(--pump-green)] hover:underline"
                >
                  Copy
                </button>
              ) : null}
            </div>
            {walletAddress ? (
              <p className="mt-1 text-xs text-[var(--pump-muted)]">
                <span className="font-semibold text-[var(--pump-text)]">$ {balanceUsd.toFixed(2)}</span> · {balanceSol.toFixed(2)} SOL
              </p>
            ) : null}
            <p className="mt-1 text-xs">
              <a
                href={walletAddress ? `https://solscan.io/account/${walletAddress}` : "https://solscan.io/"}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--pump-green)] hover:underline"
              >
                View on solscan
              </a>
            </p>
            {walletAddress ? (
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem("drop_open_profile_edit_v1", "1");
                  openSignIn();
                }}
                className="mt-2 cursor-pointer rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--pump-text)] transition hover:border-[var(--pump-green)]/50 hover:text-white"
              >
                Edit profile
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <section className="rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-4 py-5 text-center">
          <p className="text-4xl font-black leading-none tracking-tight text-[var(--pump-text)]">{coins.length}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--pump-muted)]">Created coins</p>
        </section>
        <aside className="rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--pump-text)]">Created coins ({coins.length})</h2>
            <Link href="/create" className="text-xs font-semibold text-[var(--pump-green)] hover:underline">
              Create
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {coins.slice(0, 12).map((c) => (
              <li key={c.mint} className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--pump-surface)] text-xs font-bold text-[var(--pump-green)]">
                  {c.symbol.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-[var(--pump-muted)]">{c.symbol}</p>
                  <p className="text-[11px] text-[var(--pump-muted)]">{timeAgo(c.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
          {coins.length > 12 ? <p className="mt-3 text-center text-xs text-[var(--pump-muted)]">Showing latest 12</p> : null}
        </aside>
      </div>
      {copied ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[260] -translate-x-1/2 rounded-xl border border-[#3b82f6] bg-[#0b1018]/95 px-4 py-3 text-sm font-semibold text-white">
          Copied Wallet Address!
        </div>
      ) : null}

    </div>
  );
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const d = Math.floor((Date.now() - t) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}


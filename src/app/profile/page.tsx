"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { PROFILE_USERNAME_KEY, type CreatedCoinRecord, loadCreatedCoins } from "@/lib/created-coins-storage";
import { clearExternalWalletAddress } from "@/lib/external-wallet-session";
import { isPrivyConfigured } from "@/lib/privy-config";
import { useLogout, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { getExternalWalletAddress } from "@/lib/external-wallet-session";
import { defaultUsernameFromWallet, fetchProfile, fetchWalletBalance, saveProfile, type PersistedProfile } from "@/lib/profile-api";
import Image from "next/image";
import defaultPfp from "@/components/dropspfps.png";

const tabs = ["Balances", "Coins", "Creator Rewards", "Replies", "Notifications", "Followers"] as const;

export default function ProfilePage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Balances");
  const [username, setUsername] = useState(() => {
    if (typeof window === "undefined") return "Guest";
    return window.localStorage.getItem(PROFILE_USERNAME_KEY) || "Guest";
  });
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");
  const [coins, setCoins] = useState<CreatedCoinRecord[]>([]);
  const [walletAddress] = useState<string | null>(() => (typeof window === "undefined" ? null : getExternalWalletAddress()));
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  const [balanceUsd, setBalanceUsd] = useState(0);
  const [balanceSol, setBalanceSol] = useState(0);

  useEffect(() => {
    const wallet = walletAddress;
    startTransition(() => setCoins(loadCreatedCoins()));
    if (!wallet) return;
    void Promise.all([fetchProfile(wallet), fetchWalletBalance(wallet)])
      .then(([p, b]) => {
        setProfile(p);
        setUsername(p.username);
        setDraftName(p.username);
        setDraftBio(p.bio);
        setDraftAvatarUrl(p.avatarUrl);
        setBalanceUsd(b.usd);
        setBalanceSol(b.sol);
      })
      .catch(() => {
        setUsername(defaultUsernameFromWallet(wallet));
      });
  }, [walletAddress]);

  async function saveUsername() {
    const next = draftName.trim() || (walletAddress ? defaultUsernameFromWallet(walletAddress) : "Guest");
    setUsername(next);
    window.localStorage.setItem(PROFILE_USERNAME_KEY, next);
    if (walletAddress) {
      const saved = await saveProfile({
        walletAddress,
        username: next,
        bio: draftBio.trim(),
        avatarUrl: draftAvatarUrl.trim(),
      });
      setProfile(saved);
    }
    setEditing(false);
  }

  const walletPreview = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect wallet";

  return (
    <div className="space-y-8 px-1 pb-20 lg:pr-2">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--pump-border)] bg-[var(--pump-surface)] ring-2 ring-[var(--pump-yellow)]/25 ring-offset-2 ring-offset-[var(--pump-bg)]">
            <Image
              src={profile?.avatarUrl || defaultPfp}
              alt="profile avatar"
              width={64}
              height={64}
              className="h-16 w-16 object-cover"
              unoptimized={Boolean(profile?.avatarUrl?.startsWith("data:"))}
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight">{username}</h1>
            <p className="mt-1 font-mono text-xs text-[var(--pump-muted)]">{walletPreview}</p>
            {walletAddress ? (
              <p className="mt-1 text-xs text-[var(--pump-muted)]">
                <span className="font-semibold text-[var(--pump-text)]">$ {balanceUsd.toFixed(2)}</span> · {balanceSol.toFixed(4)} SOL
              </p>
            ) : null}
            <p className="mt-1 text-xs">
              <a
                href={coins[0] ? `https://solscan.io/account/${coins[0].mint}` : "https://solscan.io/"}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--pump-green)] hover:underline"
              >
                View on solscan
              </a>
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--pump-muted)]">
              <span>
                <strong className="text-[var(--pump-text)]">{coins.length}</strong> Created coins
              </span>
              <span>
                <strong className="text-[var(--pump-text)]">0</strong> Followers
              </span>
              <span>
                <strong className="text-[var(--pump-text)]">0</strong> Following
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="field max-w-[200px] text-sm"
                placeholder="Username"
              />
              <input value={draftBio} onChange={(e) => setDraftBio(e.target.value)} className="field max-w-[220px] text-sm" placeholder="Bio" />
              <button type="button" onClick={saveUsername} className="btn-primary text-sm">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(username);
                setEditing(true);
              }}
              className="btn-ghost text-sm"
            >
              Edit profile
            </button>
          )}
          {isPrivyConfigured ? <PrivyLogoutButton /> : <LocalLogoutButton />}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--pump-border)] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  tab === t ? "bg-[var(--pump-surface)] text-[var(--pump-green)]" : "text-[var(--pump-muted)] hover:text-[var(--pump-text)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="rounded-b-2xl border border-t-0 border-[var(--pump-border)] bg-[var(--pump-elevated)] p-5">
            {tab === "Balances" ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-[var(--pump-border)] py-2 text-[var(--pump-muted)]">
                  <span>Coins</span>
                  <span>Value</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Solana balance</span>
                  <span className="font-mono text-[var(--pump-text)]">0.00 SOL</span>
                </div>
                <div className="flex justify-between py-2 text-[var(--pump-muted)]">
                  <span>Value</span>
                  <span>$0</span>
                </div>
              </div>
            ) : null}
            {tab === "Coins" ? (
              <ul className="space-y-2 text-sm">
                {coins.length === 0 ? (
                  <p className="text-[var(--pump-muted)]">No coins yet. Create one first.</p>
                ) : (
                  coins.map((c) => (
                    <li key={c.mint} className="flex items-center justify-between rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="font-mono text-xs text-[var(--pump-muted)]">{c.mint}</p>
                      </div>
                      <a href={`https://solscan.io/token/${c.mint}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-[var(--pump-green)] hover:underline">
                        View
                      </a>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <p className="text-sm text-[var(--pump-muted)]">Nothing here yet (placeholder).</p>
            )}
          </div>
        </div>

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
          {coins.length > 12 ? (
            <p className="mt-3 text-center text-xs text-[var(--pump-muted)]">Showing latest 12 · full list in Coins tab</p>
          ) : null}
        </aside>
      </div>

      <footer className="border-t border-[var(--pump-border)] pt-8 text-center text-[10px] text-[var(--pump-muted)]">
        <p>© {new Date().getFullYear()} drop · Not affiliated with pump.fun</p>
        <p className="mt-2">
          <Link href="/docs" className="hover:text-[var(--pump-green)]">
            Docs
          </Link>
        </p>
      </footer>
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

function LocalLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        clearExternalWalletAddress();
        router.push("/");
        router.refresh();
      }}
      className="btn-ghost text-sm text-red-300 hover:text-red-200 disabled:opacity-60"
    >
      {pending ? "Logging out..." : "Logout"}
    </button>
  );
}

function PrivyLogoutButton() {
  const router = useRouter();
  const { logout } = useLogout();
  const { authenticated } = usePrivy();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (pending) return;
        setPending(true);
        try {
          clearExternalWalletAddress();
          if (authenticated) {
            await logout();
          }
        } finally {
          router.push("/");
          router.refresh();
          setPending(false);
        }
      }}
      className="btn-ghost text-sm text-red-300 hover:text-red-200 disabled:opacity-60"
    >
      {pending ? "Logging out..." : "Logout"}
    </button>
  );
}

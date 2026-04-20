"use client";

import Image from "next/image";
import type { StaticImageData } from "next/image";
import { useLogin } from "@privy-io/react-auth";
import { useCallback, useMemo, useState } from "react";
import normaldrop from "@/components/normaldrop.png";
import defaultPfp from "@/components/dropspfps.png";
import {
  connectInjectedSolana,
  getInjectedSolanaProvider,
  signUtf8MessageBase64,
  type InjectedWalletId,
} from "@/lib/solana-injected-wallet";
import { clearExternalWalletAddress, setExternalWalletAddress } from "@/lib/external-wallet-session";
import {
  defaultUsernameFromWallet,
  fetchProfile,
  fetchWalletBalance,
  saveProfile,
  type PersistedProfile,
  type WalletBalance,
} from "@/lib/profile-api";

export function SignInModalPrivy({ onClose }: { onClose: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [walletLoginHint, setWalletLoginHint] = useState<string | null>(null);
  const [connectingPhase, setConnectingPhase] = useState<"connecting" | "confirming" | null>(null);
  const [connectingWalletLabel, setConnectingWalletLabel] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarDataUrl, setEditAvatarDataUrl] = useState<string>("");
  const { login } = useLogin({
    onComplete: () => onClose(),
  });

  const connectViaInjectedExtension = useCallback(
    async (wallet: InjectedWalletId, label: string) => {
      setWalletLoginHint(null);
      setConnectingWalletLabel(label);
      setConnectingPhase("connecting");
      try {
        const provider = getInjectedSolanaProvider(wallet);
        if (!provider) {
          setWalletLoginHint("Wallet extension not detected. Install or unlock it, then retry.");
          setConnectingPhase(null);
          return;
        }
        const address = await connectInjectedSolana(provider);
        setConnectingPhase("confirming");
        await signUtf8MessageBase64(provider, `Sign in to drops\nWallet: ${address}\nTime: ${new Date().toISOString()}`);
        setExternalWalletAddress(address);
        setConnectedWallet(address);
        const [nextProfile, nextBalance] = await Promise.all([
          fetchProfile(address),
          fetchWalletBalance(address).catch(() => null),
        ]);
        setProfile(nextProfile);
        setBalance(nextBalance);
      } catch (e) {
        console.error("[sign-in] extension wallet connect failed", e);
        setWalletLoginHint("Wallet connection failed. Please approve the extension prompt and retry.");
      } finally {
        setConnectingPhase(null);
        setConnectingWalletLabel(null);
      }
    },
    [],
  );

  const launchPrivyEmailSocial = useCallback(() => {
    onClose();
    queueMicrotask(() =>
      login({
        loginMethods: ["email", "google", "twitter", "apple"],
        walletChainType: "solana-only",
      }),
    );
  }, [login, onClose]);

  const launchPhantom = useCallback(() => {
    void connectViaInjectedExtension("phantom", "Phantom");
  }, [connectViaInjectedExtension]);

  const launchSolflare = useCallback(() => {
    void connectViaInjectedExtension("solflare", "Solflare");
  }, [connectViaInjectedExtension]);

  const launchBitget = useCallback(() => {
    void connectViaInjectedExtension("bitget", "Bitget");
  }, [connectViaInjectedExtension]);

  const launchTorus = useCallback(() => {
    void connectViaInjectedExtension("torus", "Torus");
  }, [connectViaInjectedExtension]);

  const avatarSrc = useMemo(() => profile?.avatarUrl || defaultPfp, [profile?.avatarUrl]);
  const usd = balance?.usd ?? 0;
  const sol = balance?.sol ?? 0;

  async function onSaveProfile() {
    if (!connectedWallet) return;
    setSavingProfile(true);
    try {
      const next = await saveProfile({
        walletAddress: connectedWallet,
        username: editName.trim() || defaultUsernameFromWallet(connectedWallet),
        bio: editBio.trim(),
        avatarUrl: editAvatarDataUrl.trim(),
      });
      setProfile(next);
      setEditOpen(false);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarPick(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditAvatarDataUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function onDisconnect() {
    clearExternalWalletAddress();
    setConnectedWallet(null);
    setProfile(null);
    setBalance(null);
    setMoreOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        className="relative flex w-full max-w-[21rem] flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#101318] font-sans shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-4 pb-2.5 pt-3.5">
          <button
            type="button"
            className="absolute right-2.5 top-2.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
          {!connectingPhase && !connectedWallet ? (
            <>
              <h2 className="mt-1.5 text-center text-[1.05rem] font-semibold leading-none tracking-tight text-white">
                Connect or create wallet
              </h2>
              <div className="mb-4 mt-5 flex justify-center">
                <Image
                  src={normaldrop}
                  alt="drops logo"
                  width={normaldrop.width}
                  height={normaldrop.height}
                  className="h-28 w-auto object-contain"
                  priority
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-2.5 px-4 pb-3.5">
          {connectingPhase ? (
            <WalletConnectingCard phase={connectingPhase} walletLabel={connectingWalletLabel ?? "Wallet"} />
          ) : null}
          {connectedWallet && profile ? (
            <ConnectedWalletCard
              username={profile.username}
              wallet={connectedWallet}
              avatarSrc={avatarSrc}
              usd={usd}
              sol={sol}
              onEdit={() => {
                setEditName(profile.username);
                setEditBio(profile.bio);
                setEditAvatarDataUrl(profile.avatarUrl);
                setEditOpen(true);
              }}
              onDisconnect={onDisconnect}
            />
          ) : null}
          {!connectingPhase && !connectedWallet ? (
            <>
          <button
            type="button"
            onClick={launchPrivyEmailSocial}
            className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/25 bg-[#151a22] px-4 py-3 text-left transition hover:border-white/40 hover:bg-[#1c2230]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/20 text-zinc-300">
              <IconUser className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.86rem] font-normal leading-tight text-white">Login with email or socials</span>
              <span className="mt-0.5 block text-[0.75rem] leading-tight text-zinc-400">Zero confirmation trading</span>
            </span>
            <span className="shrink-0 text-[1.125rem] leading-none text-zinc-300">›</span>
          </button>

          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#101318] px-2 text-[0.875rem] leading-none text-zinc-500">or</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={launchPhantom}
              className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-[#1a212d] px-3.5 py-2.5 text-left transition hover:border-white/20 hover:bg-[#212b3a]"
            >
              <img
                src="https://cdn.jsdelivr.net/npm/solana-icons@latest/svg/wallets/phantom.svg"
                alt=""
                className="h-5 w-5 shrink-0 rounded-md object-contain"
              />
              <span className="text-[0.8125rem] font-normal leading-none text-white">Phantom</span>
            </button>

            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-[#1a212d] px-3.5 py-2.5 text-left transition hover:border-white/20 hover:bg-[#212b3a]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-white/20 text-zinc-300">
                <IconWallet className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[0.8125rem] font-normal leading-none text-white">More wallets</span>
              <span
                className={`text-zinc-400 transition-transform duration-200 ${moreOpen ? "rotate-90" : ""}`}
                aria-hidden
              >
                ›
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${moreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#161c27] p-2 transition-opacity duration-200 ${moreOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
                >
                  <WalletItem label="Solflare" logo="https://cdn.jsdelivr.net/npm/solana-icons@latest/svg/wallets/solflare.svg" onClick={launchSolflare} />
                  <WalletItem label="Torus" logo="https://tor.us/images/torus-icon-blue-3.svg" onClick={launchTorus} />
                  <WalletItem label="Bitget" logo="https://raw.githubusercontent.com/bitgetwallet/download/main/logo/png/Bitget%20Wallet-Logomark.png" onClick={launchBitget} />
                </div>
              </div>
            </div>

            {walletLoginHint ? (
              <p
                role="status"
                className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[0.7rem] leading-snug text-amber-100/95"
              >
                {walletLoginHint}
              </p>
            ) : null}
          </div>
            </>
          ) : null}
        </div>
      </div>
      {editOpen && profile ? (
        <EditProfileModal
          username={editName}
          bio={editBio}
          avatarSrc={editAvatarDataUrl || defaultPfp.src}
          saving={savingProfile}
          onUsername={setEditName}
          onBio={setEditBio}
          onPickAvatar={onAvatarPick}
          onClose={() => setEditOpen(false)}
          onSave={onSaveProfile}
        />
      ) : null}
    </div>
  );
}

function WalletItem({ label, logo, onClick }: { label: string; logo: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-[#1a212d] px-3.5 py-2.5 text-left transition hover:border-white/20 hover:bg-[#212b3a]"
    >
      <img src={logo} alt="" className="h-5 w-5 shrink-0 rounded-md object-contain" />
      <span className="text-[0.8125rem] font-normal leading-none text-white">{label}</span>
    </button>
  );
}


function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12V7.5a2.25 2.25 0 0 0-2.25-2.25h-15A2.25 2.25 0 0 0 1.5 7.5v9a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21 16.5V12m-9-3h6.75A2.25 2.25 0 0 1 21 11.25v1.5a2.25 2.25 0 0 1-2.25 2.25H12"
      />
    </svg>
  );
}

function WalletConnectingCard({ phase, walletLabel }: { phase: "connecting" | "confirming"; walletLabel: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-[#0f131a] p-5 text-center">
      <h3 className="text-lg font-semibold text-white">Sign message</h3>
      <div className="mt-4 flex justify-center">
        <Image
          src={normaldrop}
          alt="drops logo"
          width={normaldrop.width}
          height={normaldrop.height}
          className="h-16 w-auto object-contain"
          priority
        />
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 whitespace-nowrap text-[1.1rem] text-white">
        <span>{phase === "confirming" ? "Click confirm in your wallet" : `Connecting ${walletLabel}...`}</span>
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#59d79a] border-t-transparent" />
      </div>
      <p className="mt-2 text-sm text-zinc-400">This proves wallet ownership</p>
    </div>
  );
}

function ConnectedWalletCard(props: {
  username: string;
  wallet: string;
  avatarSrc: string | StaticImageData;
  usd: number;
  sol: number;
  onEdit: () => void;
  onDisconnect: () => void;
}) {
  const { username, wallet, avatarSrc, usd, sol, onEdit, onDisconnect } = props;
  const shownName = username || `@${wallet.slice(0, 6)}`;
  const shownUsd = usd > 0 ? Number(usd.toFixed(2)).toString() : "0";

  function copyAddress() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(wallet);
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-[#0f131a] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[2rem] font-semibold leading-none text-white">{shownName}</p>
        <button type="button" onClick={onDisconnect} className="text-zinc-400 hover:text-white">
          ✕
        </button>
      </div>
      <button type="button" onClick={onEdit} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-[1.45rem] font-semibold text-white">
        Edit profile
      </button>
      <div className="mt-6 flex items-center justify-center gap-4">
        <Image
          src={avatarSrc}
          alt="profile avatar"
          width={72}
          height={72}
          className="h-[72px] w-[72px] rounded-full border border-white/20 object-cover"
          unoptimized={typeof avatarSrc === "string" && avatarSrc.startsWith("data:")}
        />
        <div className="text-left leading-none">
          <p className="text-[2.15rem] text-white">{shownUsd}</p>
          <p className="mt-2 text-sm text-zinc-400">{sol.toFixed(4)} SOL</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-center">
        <p className="font-mono text-sm text-zinc-300">
          {wallet.slice(0, 4)}...{wallet.slice(-4)}
        </p>
        <button type="button" onClick={copyAddress} className="text-zinc-400 hover:text-white" aria-label="Copy wallet address">
          ⧉
        </button>
      </div>
      <button type="button" className="mt-5 w-full rounded-2xl border border-[#405a82] bg-[#0f1521] px-4 py-3 text-left text-white">
        <span className="flex items-start justify-between">
          <span className="mr-3 mt-0.5 inline-grid h-6 w-6 place-items-center rounded-md border border-white/30 text-sm">◫</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[2rem] font-semibold leading-none">transfer from wallet</span>
            <span className="mt-1 block text-sm text-zinc-400">no limits • instant</span>
          </span>
          <img src="https://cdn.jsdelivr.net/npm/solana-icons@latest/svg/wallets/phantom.svg" alt="" className="ml-2 h-6 w-6 rounded-md object-contain" />
        </span>
      </button>
      <div className="my-4 flex items-center gap-2 text-zinc-500">
        <div className="h-px flex-1 bg-white/20" />
        <span>or</span>
        <div className="h-px flex-1 bg-white/20" />
      </div>
      <button type="button" onClick={onDisconnect} className="w-full rounded-xl bg-white/20 py-2 text-[2rem] text-white">
        Disconnect wallet
      </button>
    </div>
  );
}

function EditProfileModal(props: {
  username: string;
  bio: string;
  avatarSrc: string;
  saving: boolean;
  onUsername: (v: string) => void;
  onBio: (v: string) => void;
  onPickAvatar: (f: File | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { username, bio, avatarSrc, saving, onUsername, onBio, onPickAvatar, onClose, onSave } = props;
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[420px] rounded-2xl border border-white/15 bg-[#0f131a] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-xl text-zinc-400">
          ✕
        </button>
        <h3 className="text-center text-[2rem] font-semibold text-white">Choose your username</h3>
        <div className="mt-5 flex items-end gap-2">
          <Image src={avatarSrc} alt="avatar" width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover" unoptimized={avatarSrc.startsWith("data:")} />
          <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-md bg-white/15 text-white">
            📷
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="mt-5 text-sm text-zinc-400">
          Username <span className="text-red-400">*</span>
        </p>
        <input value={username} onChange={(e) => onUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
        <p className="mt-3 text-sm text-zinc-500">You can change your username once every day</p>
        <p className="mt-6 text-sm text-zinc-400">Bio</p>
        <textarea
          value={bio}
          onChange={(e) => onBio(e.target.value)}
          placeholder="Describe your profile"
          rows={4}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
        />
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-2xl bg-[#72f2a7] px-8 py-3 text-lg font-semibold text-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}


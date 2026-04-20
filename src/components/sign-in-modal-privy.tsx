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
  const [copiedToastVisible, setCopiedToastVisible] = useState(false);
  const [copiedToastEntered, setCopiedToastEntered] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarDataUrl, setEditAvatarDataUrl] = useState<string>("");
  const [profileErrorVisible, setProfileErrorVisible] = useState(false);
  const [profileErrorEntered, setProfileErrorEntered] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState("");
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
    const trimmedUsername = editName.trim().replace(/^@+/, "");
    const usernameValid = /^(?=.{1,15}$)(?!.*[._-]{2})[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(trimmedUsername);
    if (!usernameValid) {
      showProfileError(
        "Username must start and end with a letter or number, can contain periods, underscores and hyphens (but not consecutively), and no special characters at the beginning or end",
      );
      return;
    }
    setSavingProfile(true);
    try {
      const next = await saveProfile({
        walletAddress: connectedWallet,
        username: trimmedUsername || defaultUsernameFromWallet(connectedWallet).replace(/^@+/, ""),
        bio: editBio.trim(),
        avatarUrl: editAvatarDataUrl.trim(),
      });
      setProfile(next);
      setEditOpen(false);
    } catch (e) {
      showProfileError(e instanceof Error ? e.message : "Error updating profile");
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

  function triggerCopiedToast() {
    setCopiedToastVisible(true);
    setCopiedToastEntered(false);
    window.setTimeout(() => setCopiedToastEntered(true), 10);
    window.setTimeout(() => setCopiedToastEntered(false), 2200);
    window.setTimeout(() => {
      setCopiedToastVisible(false);
      setCopiedToastEntered(false);
    }, 3000);
  }

  function showProfileError(message: string) {
    setProfileErrorMessage(message);
    setProfileErrorVisible(true);
    setProfileErrorEntered(false);
    window.setTimeout(() => setProfileErrorEntered(true), 10);
    window.setTimeout(() => setProfileErrorEntered(false), 2200);
    window.setTimeout(() => {
      setProfileErrorVisible(false);
      setProfileErrorEntered(false);
    }, 3000);
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
        className="relative flex w-full max-w-[23rem] flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#101318] font-sans shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-4 pb-2.5 pt-3.5">
          {connectingPhase ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => {
                setConnectingPhase(null);
                setConnectingWalletLabel(null);
                setWalletLoginHint(null);
              }}
              className="absolute left-2.5 top-2.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              ←
            </button>
          ) : null}
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
                setEditName(profile.username.replace(/^@+/, ""));
                setEditBio(profile.bio);
                setEditAvatarDataUrl(profile.avatarUrl);
                setEditOpen(true);
              }}
              onCopiedAddress={triggerCopiedToast}
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
      {copiedToastVisible ? <CopiedAddressToast entered={copiedToastEntered} /> : null}
      {profileErrorVisible ? <ProfileErrorToast entered={profileErrorEntered} message={profileErrorMessage} /> : null}
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
    <div className="rounded-2xl bg-[#0f131a] p-5 text-center">
      <h3 className="mb-2 text-lg font-semibold text-white">Sign message</h3>
      <div className="mt-1 flex justify-center">
        <Image
          src={normaldrop}
          alt="drops logo"
          width={normaldrop.width}
          height={normaldrop.height}
          className="h-24 w-auto object-contain"
          priority
        />
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 whitespace-nowrap text-[1.1rem] text-white">
        <span>{phase === "confirming" ? "Click confirm in your wallet" : `Connecting ${walletLabel}...`}</span>
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
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
  onCopiedAddress: () => void;
  onDisconnect: () => void;
}) {
  const { username, wallet, avatarSrc, usd, sol, onEdit, onCopiedAddress, onDisconnect } = props;
  const shownName = username ? (username.startsWith("@") ? username : `@${username}`) : `@${wallet.slice(0, 6)}`;
  const shownUsd = usd.toFixed(2);

  function copyAddress() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(wallet).then(onCopiedAddress);
  }

  return (
    <div className="px-2 pb-2 pt-2">
      <div className="text-center">
        <p className="text-[1rem] font-semibold leading-none text-white">{shownName}</p>
      </div>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer rounded-xl bg-white/10 px-4 py-1.5 text-[0.95rem] font-semibold text-white transition hover:bg-white/15"
        >
          Edit profile
        </button>
      </div>
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
          <p className="text-[0.95rem] font-bold text-zinc-300">$ {shownUsd}</p>
          <p className="mt-1 text-sm text-zinc-400">{sol.toFixed(2)} SOL</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-center">
        <p className="font-mono text-sm text-zinc-300">
          {wallet.slice(0, 4)}...{wallet.slice(-4)}
        </p>
        <button
          type="button"
          onClick={copyAddress}
          className="grid h-5 w-5 cursor-pointer place-items-center rounded-sm border border-white/15 bg-[#121821] text-zinc-300 transition hover:text-white"
          aria-label="Copy wallet address"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        className="mt-5 w-full cursor-pointer rounded-xl bg-white/20 py-2 text-[0.9rem] font-medium text-white transition hover:bg-white/25"
      >
        Disconnect wallet
      </button>
    </div>
  );
}

function CopiedAddressToast({ entered }: { entered: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-[260] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-[#3b82f6] bg-[#0b1018]/95 px-4 py-3 text-center transition-all duration-700 ease-in-out ${
        entered ? "translate-y-4 opacity-100" : "-translate-y-3 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
        <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-[#3b82f6] text-[11px] leading-none text-white">✓</span>
        <span>Copied Wallet Address!</span>
      </p>
    </div>
  );
}

function ProfileErrorToast({ entered, message }: { entered: boolean; message: string }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-[261] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-red-500 bg-black/95 px-5 py-4 transition-all duration-700 ease-in-out ${
        entered ? "translate-y-4 opacity-100" : "-translate-y-3 opacity-0"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <p className="text-lg font-semibold text-zinc-100">Error updating profile</p>
      <div className="mt-2 flex items-start gap-2 text-zinc-100">
        <span className="mt-0.5 inline-grid h-4 w-4 place-items-center rounded-full bg-zinc-200 text-[11px] font-bold leading-none text-black">!</span>
        <p className="text-[1.02rem] leading-snug">{message}</p>
      </div>
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close edit profile"
          className="absolute right-4 top-4 cursor-pointer text-xl text-zinc-400 transition hover:text-white"
        >
          ✕
        </button>
        <h3 className="text-center text-[1.6rem] font-semibold text-white">Edit profile</h3>
        <div className="mt-5">
          <div className="relative inline-block">
            <Image
              src={avatarSrc}
              alt="avatar"
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full border border-[#6b7280] object-cover"
              unoptimized={avatarSrc.startsWith("data:")}
            />
            <label className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-[#d1d5db] bg-[#f4f4f5] text-black">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h3l1.2-2h7.6L17 7h3v11H4z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <p className="mt-5 text-sm text-zinc-400">
          Username <span className="text-red-400">*</span>
        </p>
        <input
          value={username}
          onChange={(e) => onUsername(e.target.value.slice(0, 15))}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-[#3b82f6]"
        />
        <p className="mt-3 text-sm text-zinc-500">You can change your username once every day</p>
        <p className="mt-6 text-sm text-zinc-400">Bio</p>
        <textarea
          value={bio}
          onChange={(e) => onBio(e.target.value)}
          placeholder="Describe your profile"
          rows={2}
          className="mt-2 min-h-[56px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-[#3b82f6]"
        />
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-2xl bg-[#3b82f6] px-6 py-2.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}


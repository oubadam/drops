"use client";

import type { WalletListEntry } from "@privy-io/react-auth";
import { useConnectWallet, useLogin } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

type Step = "root" | "more";

const MORE_SOLANA_WALLETS: { label: string; id: WalletListEntry }[] = [
  { label: "Phantom", id: "phantom" },
  { label: "Solflare", id: "solflare" },
  { label: "Backpack", id: "backpack" },
  { label: "Jupiter", id: "jupiter" },
  { label: "OKX Wallet", id: "okx_wallet" },
  { label: "Coinbase Wallet", id: "coinbase_wallet" },
  { label: "Bitget Wallet", id: "bitget_wallet" },
  { label: "Kraken Wallet", id: "kraken_wallet" },
  { label: "Binance", id: "binance" },
];

export function SignInModalPrivy({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("root");

  const { login } = useLogin({
    onComplete: () => onClose(),
  });

  const { connectWallet } = useConnectWallet({
    onSuccess: () => onClose(),
  });

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
    onClose();
    queueMicrotask(() =>
      connectWallet({
        walletChainType: "solana-only",
        preSelectedWalletId: "phantom",
      }),
    );
  }, [connectWallet, onClose]);

  const launchWallet = useCallback(
    (id: WalletListEntry) => {
      onClose();
      queueMicrotask(() =>
        connectWallet({
          walletChainType: "solana-only",
          preSelectedWalletId: id,
        }),
      );
    },
    [connectWallet, onClose],
  );

  const launchAllSolanaWallets = useCallback(() => {
    onClose();
    queueMicrotask(() => connectWallet({ walletChainType: "solana-only" }));
  }, [connectWallet, onClose]);

  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        className="relative flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#141518] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-white/10 px-5 pb-3 pt-4">
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
          <h2 id="sign-in-title" className="pr-8 text-center text-[15px] font-semibold text-white">
            {step === "root" ? "Connect or create wallet" : "More Solana wallets"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          {step === "root" ? (
            <>
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
                <PillMark />
              </div>

              <button
                type="button"
                onClick={launchPrivyEmailSocial}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-[#1e2026] px-4 py-3.5 text-left transition hover:border-white/20 hover:bg-[#252830]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-zinc-400">
                  <IconUser className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">Login with email or socials</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">Zero confirmation trading</span>
                </span>
                <span className="shrink-0 text-zinc-500">›</span>
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  <span className="bg-[#141518] px-3">or</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={launchPhantom}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-[#1e2026] px-4 py-3.5 text-left transition hover:border-white/18 hover:bg-[#252830]"
                >
                  <PhantomGlyph className="h-9 w-9 shrink-0" />
                  <span className="text-sm font-semibold text-white">Phantom</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep("more")}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-[#1e2026] px-4 py-3.5 text-left transition hover:border-white/18 hover:bg-[#252830]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400">
                    <IconWallet className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-white">More wallets</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("root")}
                className="mb-4 text-xs font-semibold text-[var(--pump-green)] hover:underline"
              >
                ← Back
              </button>
              <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-1">
                {MORE_SOLANA_WALLETS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => launchWallet(w.id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-[#1e2026] px-4 py-3 text-left transition hover:border-white/18 hover:bg-[#252830]"
                  >
                    <WalletGlyph id={w.id} />
                    <span className="text-sm font-semibold text-white">{w.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={launchAllSolanaWallets}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-transparent px-4 py-3 text-sm font-medium text-zinc-400 transition hover:border-white/25 hover:text-white"
                >
                  Other Solana wallets…
                </button>
              </div>
            </>
          )}
        </div>

        <p className="shrink-0 border-t border-white/10 px-4 py-3 text-center text-[10px] text-zinc-600">
          Protected by{" "}
          <a
            href="https://privy.io"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-400 hover:text-zinc-300"
          >
            Privy
          </a>
        </p>
      </div>
    </div>
  );
}

function PillMark() {
  return (
    <div
      className="relative h-20 w-20 rotate-[-18deg] rounded-full border-2 border-black/80 shadow-lg"
      style={{
        background: "linear-gradient(165deg, #ffffff 0%, #ffffff 48%, #22c55e 48%, #16a34a 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 24px rgba(0,0,0,0.45)",
      }}
    />
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7.5a2.25 2.25 0 0 0-2.25-2.25h-15A2.25 2.25 0 0 0 1.5 7.5v9a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21 16.5V12m-9-3h6.75A2.25 2.25 0 0 1 21 11.25v1.5a2.25 2.25 0 0 1-2.25 2.25H12m-9-3h3.75m-3.75 3h3.75m-3.75 3h3.75m3.75-6h3m-3 3h3m-3 3h3" />
    </svg>
  );
}

function PhantomGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ab9ff2" />
          <stop offset="100%" stopColor="#5346e4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#pg)" />
      <path
        fill="white"
        d="M12 22c1.2-4 4.5-7 8.5-7s7.3 3 8.5 7c-2.2 2.8-5.2 4.5-8.5 4.5S14.2 24.8 12 22Z"
        opacity="0.95"
      />
    </svg>
  );
}

function WalletGlyph({ id }: { id: WalletListEntry }) {
  const hue =
    id === "phantom"
      ? "#5346e4"
      : id === "solflare"
        ? "#fc7224"
        : id === "backpack"
          ? "#e33ebb"
          : id === "jupiter"
            ? "#c7f284"
            : id === "okx_wallet"
              ? "#fff"
              : id === "coinbase_wallet"
                ? "#0052ff"
                : id === "bitget_wallet"
                  ? "#00f0ff"
                  : id === "kraken_wallet"
                    ? "#5741d9"
                    : id === "binance"
                      ? "#f0b90b"
                      : "#64748b";
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-black text-white"
      style={{ backgroundColor: hue, color: id === "okx_wallet" ? "#111" : "#fff" }}
    >
      {id === "phantom" ? "P" : id === "solflare" ? "S" : id.slice(0, 2).toUpperCase()}
    </span>
  );
}

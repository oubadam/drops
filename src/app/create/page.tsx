"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { mintGradient, mintSparkPoints, sparkLinePathD } from "@/lib/mint-visual";
import { prependCreatedCoin } from "@/lib/created-coins-storage";
import { getExternalWalletAddress } from "@/lib/external-wallet-session";

const NAME_MAX_LEN = 32;
const TICKER_MAX_LEN = 10;
const MAX_WHITELIST_WALLETS = 25;

export default function CreateTokenPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [amount, setAmount] = useState("0.05");
  const [whitelistWalletInputs, setWhitelistWalletInputs] = useState<string[]>([""]);
  const [whitelistFeePercent, setWhitelistFeePercent] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const previewSeed = `${name}|${symbol}`.trim() || "preview";
  const g = mintGradient(previewSeed);
  const spark = sparkLinePathD(mintSparkPoints(previewSeed, 28));

  const imagePreviewUrl = useMemo(() => {
    if (!image) return null;
    return URL.createObjectURL(image);
  }, [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const canSubmit = useMemo(() => {
    const nameLen = name.trim().length;
    const symbolLen = symbol.trim().length;
    const wallets = whitelistWalletInputs.map((w) => w.trim()).filter((w) => w.length > 0);
    const allValid = wallets.every(isValidSolanaPublicKey);
    return (
      nameLen > 0 &&
      nameLen <= NAME_MAX_LEN &&
      symbolLen > 0 &&
      symbolLen <= TICKER_MAX_LEN &&
      allValid &&
      wallets.length >= 1 &&
      wallets.length <= MAX_WHITELIST_WALLETS &&
      image !== null &&
      !loading
    );
  }, [name, symbol, whitelistWalletInputs, image, loading]);

  async function createCoinWithAmount() {
    if (!image) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("symbol", symbol.trim().toUpperCase());
    fd.append("description", description.trim());
    fd.append("website", website.trim());
    fd.append("twitter", twitter.trim());
    fd.append("telegram", telegram.trim());
    fd.append("amount", String(Math.max(0.05, Number(amount) || 0.05)));
    const cleanWallets = Array.from(
      new Set(
        whitelistWalletInputs
          .map((w) => w.trim())
          .filter((w) => w.length > 0 && isValidSolanaPublicKey(w)),
      ),
    );
    fd.append("whitelistWallets", JSON.stringify(cleanWallets));
    fd.append("whitelistFeeBps", String(Math.round(whitelistFeePercent * 100)));
    fd.append("image", image);
    const creatorWallet = getExternalWalletAddress();
    if (creatorWallet) fd.append("creatorWallet", creatorWallet);

    const res = await fetch("/api/create-token", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Create failed.");
      return;
    }
    prependCreatedCoin({
      mint: data.mint,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      signature: data.signature ?? undefined,
      createdAt: new Date().toISOString(),
      description: description.trim() || undefined,
      imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    });
    router.push("/profile");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setShowBuyModal(true);
  }

  function handleDropFile(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImage(file);
  }

  return (
    <div className="grid gap-8 px-4 pb-24 pt-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <form onSubmit={onSubmit} className="min-w-0 space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Create new coin</h1>
            <span className="hidden h-1 w-10 shrink-0 rounded-full bg-[var(--pump-yellow)]/85 sm:block" aria-hidden />
          </div>
          <p className="mt-2 text-sm text-[var(--pump-muted)]">
            <span className="font-semibold text-[var(--pump-text)]">Coin details</span> — Choose carefully, these can&apos;t be changed once the coin is created.
          </p>
        </div>

        <section className="space-y-4 rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coin name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_MAX_LEN))}
                placeholder="Name your coin"
                className="field"
                maxLength={NAME_MAX_LEN}
                required
              />
            </Field>
            <Field label="Ticker">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.slice(0, TICKER_MAX_LEN))}
                placeholder="Add a coin ticker (e.g. DOGE)"
                className="field"
                maxLength={TICKER_MAX_LEN}
                required
              />
            </Field>
          </div>
          <p className="text-xs text-[var(--pump-muted)]">Name max {NAME_MAX_LEN} chars · Ticker max {TICKER_MAX_LEN} chars</p>
          <Field label="Airdrop wallets (1 to 25, one per line or comma-separated)">
            <div className="space-y-2">
              {whitelistWalletInputs.map((wallet, idx) => {
                const hasValue = wallet.trim().length > 0;
                const valid = !hasValue || isValidSolanaPublicKey(wallet.trim());
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={wallet}
                      onChange={(e) =>
                        setWhitelistWalletInputs((prev) => {
                          const next = [...prev];
                          next[idx] = e.target.value;
                          return next;
                        })
                      }
                      placeholder={`Wallet ${idx + 1} public key`}
                      className={`field flex-1 font-mono text-xs ${valid ? "" : "border-red-500/60"}`}
                      required={idx === 0}
                    />
                    {whitelistWalletInputs.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setWhitelistWalletInputs((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="cursor-pointer rounded-lg border border-white/20 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--pump-muted)]">
                  {whitelistWalletInputs.filter((w) => w.trim()).length}/{MAX_WHITELIST_WALLETS} wallets
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWhitelistWalletInputs([""])}
                    className="cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5"
                  >
                    Remove all
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setWhitelistWalletInputs((prev) =>
                        prev.length >= MAX_WHITELIST_WALLETS ? prev : [...prev, ""],
                      )
                    }
                    className="cursor-pointer rounded-lg border border-[#3b82f6] px-3 py-1.5 text-xs font-semibold text-[#60a5fa] hover:bg-[#3b82f6]/10"
                  >
                    Add wallet
                  </button>
                </div>
              </div>
            </div>
          </Field>
          <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-4">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-[var(--pump-text)]">Creator fee split to whitelist wallets</p>
              <p className="text-[var(--pump-muted)]">{whitelistFeePercent}%</p>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={whitelistFeePercent}
              onChange={(e) => setWhitelistFeePercent(Number(e.target.value))}
              className="mt-3 w-full accent-[#3b82f6]"
            />
            <p className="mt-2 text-xs text-[var(--pump-muted)]">
              Whitelist wallets: {whitelistFeePercent}% (equal split) · Holders (top 100): {100 - whitelistFeePercent}% (weighted by holdings)
            </p>
          </div>
          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a short description"
              rows={4}
              className="field resize-y"
            />
          </Field>

          <details className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--pump-text)]">Add social links (optional)</summary>
            <div className="mt-4 space-y-3">
              <Field label="Website">
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="field" />
              </Field>
              <Field label="X (Twitter)">
                <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" className="field" />
              </Field>
              <Field label="Telegram">
                <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" className="field" />
              </Field>
            </div>
          </details>
        </section>

        <section className="rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-5 sm:p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDropFile}
            className={`rounded-xl border border-dashed bg-[var(--pump-surface)] p-8 text-center transition sm:p-10 ${dragOver ? "border-[var(--pump-green)]" : "border-[var(--pump-border)]"}`}
          >
            {imagePreviewUrl ? (
              <div className="relative mx-auto h-[280px] w-full max-w-[280px] overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="Selected coin media" className="h-full w-full object-cover" />
                <label className="absolute bottom-2 right-2 inline-flex cursor-pointer rounded-lg bg-black/75 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/85">
                  Replace
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,video/mp4"
                    className="hidden"
                    onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-300">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <p className="mt-4 text-[1.15rem] font-semibold text-[var(--pump-text)]">Select video or image to upload</p>
                <p className="text-[1.05rem] text-[var(--pump-muted)]">or drag and drop it here</p>
                <label className="mt-5 inline-flex cursor-pointer rounded-xl bg-[var(--pump-green)] px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-105">
                  Select file
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,video/mp4"
                    className="hidden"
                    onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              </>
            )}
          </div>
          <div className="mt-5 grid gap-4 border-t border-[var(--pump-border)] pt-4 text-xs text-[var(--pump-muted)] sm:grid-cols-2">
            <div>
              <p className="font-semibold text-[var(--pump-text)]">File size and type</p>
              <p className="mt-1">Image - max 15mb, jpg/gif/png recommended</p>
              <p>Video - max 30mb, mp4 recommended</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--pump-text)]">Resolution and aspect ratio</p>
              <p className="mt-1">Image - min 1000x1000px, 1:1 square recommended</p>
              <p>Video - 16:9 or 9:16, 1080p+ recommended</p>
            </div>
          </div>
        </section>

        <p className="text-xs text-[var(--pump-muted)]">
          Coin data (social links, banner, etc) can only be added now, and can&apos;t be changed or edited after creation
        </p>

        {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

        <div className="flex">
          <button type="submit" disabled={!canSubmit} className="btn-primary w-full sm:w-auto sm:min-w-[220px]">
            {loading ? "Creating…" : "Create coin"}
          </button>
        </div>
      </form>

      <aside className="h-fit space-y-3 lg:sticky lg:top-4">
        <h2 className="text-sm font-bold text-[var(--pump-muted)]">Preview</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-surface)]">
          <div
            className="relative aspect-[4/5] w-full bg-gradient-to-br"
            style={{
              backgroundImage: imagePreviewUrl
                ? `url(${imagePreviewUrl})`
                : `linear-gradient(145deg, ${g.from}, ${g.to})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <svg viewBox="0 0 100 22" className="h-8 w-full" preserveAspectRatio="none">
                <path d={spark} fill="none" stroke="var(--pump-green)" strokeWidth="1.35" />
              </svg>
            </div>
          </div>
          <div className="space-y-1 p-4">
            <p className="text-lg font-black text-[var(--pump-text)]">{name.trim() || "Coin name"}</p>
            <p className="text-sm font-bold text-[var(--pump-green)]">{symbol.trim().toUpperCase() || "TICKER"}</p>
            <p className="line-clamp-4 text-xs text-[var(--pump-muted)]">
              {description.trim() || "A preview of how the coin will look like."}
            </p>
          </div>
        </div>
      </aside>
      {showBuyModal ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[420px] rounded-xl border border-white/85 bg-[#0f131b] px-6 py-7 text-center">
            <h3 className="text-xl font-semibold leading-snug text-white">
              Choose how many {symbol.trim() ? `$${symbol.trim().toLowerCase()}` : "$ticker"} you want to buy (optional)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Tip: its optional but buying a small amount of coins helps protect your coin from snipers
            </p>
            <div className="mt-5 flex items-center rounded-xl border border-white/70 bg-[#2a2f3d] px-3 py-2.5">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="0.05"
                step="0.01"
                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-zinc-400"
              />
              <span className="ml-2 text-xl text-zinc-100">SOL</span>
              <span className="ml-2 grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-white/40">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <defs>
                    <linearGradient id="solGradA" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00ffa3" />
                      <stop offset="100%" stopColor="#dc1fff" />
                    </linearGradient>
                  </defs>
                  <rect x="4" y="5" width="16" height="3" rx="1.5" fill="url(#solGradA)" />
                  <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="url(#solGradA)" />
                  <rect x="4" y="16" width="16" height="3" rx="1.5" fill="url(#solGradA)" />
                </svg>
              </span>
            </div>
            <p className="mt-2 text-left text-sm text-zinc-400">Minimum 0.05 SOL</p>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (Number(amount) < 0.05) {
                  setError("Minimum dev buy is 0.05 SOL.");
                  return;
                }
                setShowBuyModal(false);
                void createCoinWithAmount();
              }}
              className="mt-7 w-full cursor-pointer rounded-2xl bg-[#3b82f6] py-3 text-base font-semibold text-white transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create coin"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isValidSolanaPublicKey(value: string): boolean {
  try {
    const key = new PublicKey(value);
    return PublicKey.isOnCurve(key.toBytes());
  } catch {
    return false;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-[var(--pump-muted)]">{label}</span>
      {children}
    </label>
  );
}


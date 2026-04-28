"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { mintGradient, mintSparkPoints, sparkLinePathD } from "@/lib/mint-visual";
import { prependCreatedCoin } from "@/lib/created-coins-storage";
import { getExternalWalletAddress } from "@/lib/external-wallet-session";
import { findInjectedProviderByAddress, signAndSendTransactionBase58 } from "@/lib/solana-injected-wallet";

const NAME_MAX_LEN = 32;
const TICKER_MAX_LEN = 10;
const MAX_WHITELIST_WALLETS = 25;

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export default function CreateTokenPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [amount, setAmount] = useState("0");
  const [whitelistWalletInputs, setWhitelistWalletInputs] = useState<string[]>([""]);
  const [whitelistFeePercent, setWhitelistFeePercent] = useState(0);
  const [devBuyAirdropEnabled, setDevBuyAirdropEnabled] = useState(false);
  const [devBuyAirdropTokenPercent, setDevBuyAirdropTokenPercent] = useState(0);
  const [devBuyAirdropWalletPercents, setDevBuyAirdropWalletPercents] = useState<Record<string, number>>({});
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const whitelistRuleOk = whitelistFeePercent <= 0 ? true : wallets.length >= 1;
    const devBuyAirdropRuleOk = devBuyAirdropEnabled ? wallets.length >= 1 : true;
    return (
      nameLen > 0 &&
      nameLen <= NAME_MAX_LEN &&
      symbolLen > 0 &&
      symbolLen <= TICKER_MAX_LEN &&
      allValid &&
      whitelistRuleOk &&
      devBuyAirdropRuleOk &&
      wallets.length <= MAX_WHITELIST_WALLETS &&
      image !== null &&
      !loading
    );
  }, [name, symbol, whitelistWalletInputs, whitelistFeePercent, devBuyAirdropEnabled, image, loading]);

  const cleanWalletsForAirdrops = useMemo(() => {
    return Array.from(
      new Set(
        whitelistWalletInputs
          .map((w) => w.trim())
          .filter((w) => w.length > 0 && isValidSolanaPublicKey(w)),
      ),
    );
  }, [whitelistWalletInputs]);

  useEffect(() => {
    if (!devBuyAirdropEnabled) return;
    if (cleanWalletsForAirdrops.length < 1) return;
    setDevBuyAirdropWalletPercents((prev) => {
      const next: Record<string, number> = { ...prev };
      const known = cleanWalletsForAirdrops.filter((w) => Number.isFinite(next[w]));
      if (known.length >= cleanWalletsForAirdrops.length) return prev;
      const equal = 100 / cleanWalletsForAirdrops.length;
      for (const w of cleanWalletsForAirdrops) {
        if (!Number.isFinite(next[w])) next[w] = equal;
      }
      return next;
    });
  }, [devBuyAirdropEnabled, cleanWalletsForAirdrops]);

  async function createCoinWithAmount() {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("symbol", symbol.trim().toUpperCase());
      fd.append("description", description.trim());
      fd.append("website", website.trim());
      fd.append("twitter", twitter.trim());
      fd.append("telegram", telegram.trim());
      fd.append("amount", String(Math.max(0, Number(amount) || 0)));
      const cleanWallets = cleanWalletsForAirdrops;
      fd.append("whitelistWallets", JSON.stringify(cleanWallets));
      fd.append("whitelistFeeBps", String(Math.round(whitelistFeePercent * 100)));
      fd.append("devBuyAirdropEnabled", devBuyAirdropEnabled ? "1" : "0");
      fd.append("devBuyAirdropBps", String(Math.round(devBuyAirdropTokenPercent * 100)));
      if (devBuyAirdropEnabled && cleanWallets.length > 0) {
        const rawPercents = cleanWallets.map((w) => Math.max(0, Number(devBuyAirdropWalletPercents[w] ?? 0) || 0));
        const sum = rawPercents.reduce((a, b) => a + b, 0);
        const normalized = sum > 0 ? rawPercents.map((p) => (p / sum) * 100) : rawPercents.map(() => 100 / cleanWallets.length);
        const bps = normalized.map((p) => Math.round(p * 100));
        const bpsSum = bps.reduce((a, b) => a + b, 0);
        if (bpsSum !== 10000 && bps.length > 0) bps[bps.length - 1] += 10000 - bpsSum;
        fd.append("devBuyAirdropWalletBps", JSON.stringify(bps));
      } else {
        fd.append("devBuyAirdropWalletBps", "[]");
      }
      fd.append("image", image);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);
      const creatorWallet = getExternalWalletAddress();
      if (!creatorWallet) {
        setError("Connect your wallet first.");
        return;
      }
      fd.append("creatorWallet", creatorWallet);

      const res = await fetch("/api/create-token", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Create failed.");
        return;
      }
      if (typeof data.transactionBase64 !== "string" || !data.draft) {
        setError("Launch payload missing wallet transaction.");
        return;
      }

      const provider = await findInjectedProviderByAddress(creatorWallet);
      if (!provider) {
        setError("Wallet provider not available. Reconnect wallet and retry.");
        return;
      }
      const tx = VersionedTransaction.deserialize(b64ToBytes(data.transactionBase64));
      const walletSig = await signAndSendTransactionBase58(provider, tx);

      const finalizeRes = await fetch("/api/create-token/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: walletSig,
          draft: data.draft,
        }),
      });
      const finalized = await finalizeRes.json().catch(() => ({}));
      if (!finalizeRes.ok) {
        setError(finalized.error ?? "Launch finalize failed.");
        return;
      }

      const launchedMint = typeof finalized.mint === "string" ? finalized.mint : "";
      prependCreatedCoin({
        mint: launchedMint,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        signature: finalized.signature ?? undefined,
        createdAt: new Date().toISOString(),
        description: description.trim() || undefined,
        imageUrl: typeof finalized.imageUrl === "string" ? finalized.imageUrl : undefined,
      });
      router.push(launchedMint ? `/token/${launchedMint}` : "/profile");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("Launch request exceeded 120s. Please retry.");
        return;
      }
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if ((whitelistFeePercent > 0 || devBuyAirdropEnabled) && whitelistWalletInputs.every((w) => w.trim().length === 0)) {
      setError("Add at least one whitelist wallet when whitelist split is used or dev-buy token airdrop is enabled.");
      return;
    }
    if (Number(amount) < 0) {
      setError("Dev buy cannot be negative.");
      return;
    }
    void createCoinWithAmount();
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
          <Field label="Airdrop wallets (1 to 25, one per line or comma-separated) (Whitelisted wallets)">
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
                      placeholder={`Wallet ${idx + 1} SOL address`}
                      className={`field flex-1 font-mono text-xs ${valid ? "" : "border-red-500/60"}`}
                      required={idx === 0 && whitelistFeePercent > 0}
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
          {whitelistFeePercent > 0 && whitelistWalletInputs.every((w) => w.trim().length === 0) ? (
            <p className="text-xs text-amber-300">
              Add at least one whitelist wallet when whitelist fee split is above 0%.
            </p>
          ) : null}
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
              Whitelist wallets: {whitelistFeePercent}% (equal split) · Holders (top 100): {100 - whitelistFeePercent}%
            </p>
            {whitelistFeePercent === 0 ? (
              <p className="mt-1 text-xs text-[var(--pump-muted)]">No whitelist wallets needed at 0% (holders receive 100%).</p>
            ) : null}
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black tracking-tight text-white">Dev buy + optional token airdrop</h2>
              <p className="mt-1 text-xs text-[var(--pump-muted)]">
                Dev buy is optional. If you keep token airdrop off, you keep all dev-bought tokens normally. If enabled, token airdrop settings are saved at launch.
              </p>
            </div>
          </div>

          <label className="mt-4 block text-xs font-semibold text-[var(--pump-muted)]">Dev buy amount (SOL)</label>
          <div className="mt-2 flex items-center rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-2.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.000001"
              className="w-full bg-transparent text-base text-white outline-none placeholder:text-zinc-400"
            />
            <span className="ml-2 text-base text-zinc-200">SOL</span>
          </div>
          <p className="mt-2 text-xs text-[var(--pump-muted)]">Minimum 0 SOL</p>

          <div className="mt-5 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--pump-text)]">Airdrop tokens from dev buy (optional)</span>
              <input
                type="checkbox"
                checked={devBuyAirdropEnabled}
                onChange={(e) => setDevBuyAirdropEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#3b82f6]"
              />
            </label>
            {devBuyAirdropEnabled ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-[var(--pump-muted)]">
                    <span>% of the dev-bought tokens to airdrop</span>
                    <span className="font-semibold text-[var(--pump-text)]">{devBuyAirdropTokenPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={devBuyAirdropTokenPercent}
                    onChange={(e) => setDevBuyAirdropTokenPercent(Number(e.target.value))}
                    className="mt-2 w-full accent-[#3b82f6]"
                  />
                </div>
                <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3">
                  <p className="text-xs font-semibold text-[var(--pump-text)]">Wallet split (who gets what)</p>
                  <p className="mt-1 text-xs text-[var(--pump-muted)]">
                    These percentages control how the airdropped tokens are split across your airdrop wallets.
                  </p>
                  <div className="mt-3 space-y-2">
                    {cleanWalletsForAirdrops.length > 0 ? (
                      cleanWalletsForAirdrops.map((w) => {
                        const pct = devBuyAirdropWalletPercents[w] ?? 0;
                        return (
                          <div key={w} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1 truncate rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 py-2 font-mono text-[11px] text-[var(--pump-muted)]">
                              {w}
                            </div>
                            <input
                              value={String(pct)}
                              onChange={(e) =>
                                setDevBuyAirdropWalletPercents((prev) => ({
                                  ...prev,
                                  [w]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                }))
                              }
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className="w-[92px] rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2 py-2 text-xs text-white outline-none"
                            />
                            <span className="text-xs text-[var(--pump-muted)]">%</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-amber-300">Add at least one airdrop wallet above to enable token airdrops.</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[var(--pump-muted)]">
                  This does <span className="font-semibold text-[var(--pump-text)]">not</span> mean “% of total supply”. Pump.fun supply is 1B,
                  but your dev buy only purchases some amount of tokens — this slider controls what % of those dev-bought tokens you airdrop.
                </p>
                {whitelistWalletInputs.every((w) => w.trim().length === 0) ? (
                  <p className="text-xs text-amber-300">Add at least one whitelist wallet to use dev-buy token airdrop.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--pump-muted)]">Off by default.</p>
            )}
          </div>
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
      <span className="text-sm font-bold text-[var(--pump-text)]">{label}</span>
      {children}
    </label>
  );
}


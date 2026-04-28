"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { loadCreatedCoins, type CreatedCoinRecord } from "@/lib/created-coins-storage";
import { fetchSolanaTokenPairExploreStats, formatMcapUsd } from "@/lib/dexscreener-mcap";
import { useOpenSignIn } from "@/components/sign-in-modal-context";
import { formatLaunchAgo } from "@/lib/launch-time";
import { formatExploreMcap } from "@/lib/explore-mcap";
import type { ExploreEnrichedCoin } from "@/lib/explore-coin-types";
import { getExternalWalletAddress, subscribeExternalWallet } from "@/lib/external-wallet-session";
import { EMPTY_PUMP_FRONT_STATE, fetchPumpFrontCoinState } from "@/lib/pump-front-api";
import { pumpTokenInfoToCreatedRecord, type PumpTokenInfoPayload } from "@/lib/pump-token-info";
import { findInjectedProviderByAddress, signAndSendTransactionBase58 } from "@/lib/solana-injected-wallet";
import { isMintWatchlisted, toggleWatchlistMint, WATCHLIST_UPDATED_EVENT } from "@/lib/watchlist-storage";

const emptyCoin: ExploreEnrichedCoin = {
  mint: "",
  name: "",
  symbol: "",
  createdAt: new Date().toISOString(),
  mcap: null,
  vol24h: null,
  dexId: null,
  fdvUsd: null,
  priceChange: { m5: null, h1: null, h6: null, h24: null },
  txnsH24: null,
  pump: { ...EMPTY_PUMP_FRONT_STATE },
};

function routeMintParam(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
  return "";
}

function mergeStats(base: ExploreEnrichedCoin, stats: Awaited<ReturnType<typeof fetchSolanaTokenPairExploreStats>>): ExploreEnrichedCoin {
  return {
    ...base,
    mcap: stats.mcapUsd,
    vol24h: stats.volumeUsd24h,
    dexId: stats.dexId,
    pairAddress: stats.pairAddress,
    priceUsd: stats.priceUsd,
    fdvUsd: stats.fdvUsd,
    priceChange: stats.priceChange,
    txnsH24: stats.txnsH24,
  };
}

function mergePump(base: ExploreEnrichedCoin, pump: Awaited<ReturnType<typeof fetchPumpFrontCoinState>>): ExploreEnrichedCoin {
  return {
    ...base,
    pump,
  };
}

export default function TokenPage() {
  const params = useParams<{ mint: string | string[] }>();
  const mint = useMemo(() => routeMintParam(params?.mint), [params?.mint]);
  const [coin, setCoin] = useState<ExploreEnrichedCoin | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "notfound">("idle");
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("0.05");
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeMsg, setTradeMsg] = useState<string>("");
  const [tradeMsgIsError, setTradeMsgIsError] = useState(false);
  const [tradeSig, setTradeSig] = useState<string>("");
  const [copiedCa, setCopiedCa] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<PumpTokenInfoPayload | null>(null);
  const [, bumpWatch] = useReducer((x: number) => x + 1, 0);
  const pumpPollBusyRef = useRef(false);
  const statsPollBusyRef = useRef(false);
  const walletAddress = useSyncExternalStore(subscribeExternalWallet, getExternalWalletAddress, () => null);
  const { openSignIn } = useOpenSignIn();
  useEffect(() => {
    const fn = () => bumpWatch();
    window.addEventListener(WATCHLIST_UPDATED_EVENT, fn);
    return () => window.removeEventListener(WATCHLIST_UPDATED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    setLoadState("loading");
    setCoin(null);
    setTokenInfo(null);

    void (async () => {
      const fetchWithTimeout = async (url: string, ms: number) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), ms);
        try {
          return await fetch(url, { cache: "no-store", signal: controller.signal });
        } finally {
          window.clearTimeout(timeout);
        }
      };

      const [launchesResult, infoResult] = await Promise.allSettled([
        fetchWithTimeout(`/api/launches?q=${encodeURIComponent(mint)}`, 6000),
        fetchWithTimeout(`/api/token-info/${encodeURIComponent(mint)}`, 6000),
      ]);

      let source: CreatedCoinRecord | null = null;
      let infoPayload: PumpTokenInfoPayload | null = null;
      if (launchesResult.status === "fulfilled" && launchesResult.value.ok) {
        const j = (await launchesResult.value.json()) as { items?: CreatedCoinRecord[] };
        const items = Array.isArray(j.items) ? j.items : [];
        const exact = items.find((r) => r.mint === mint) ?? null;
        if (exact) source = exact;
      }
      if (infoResult.status === "fulfilled" && infoResult.value.ok) {
        const t = (await infoResult.value.json()) as PumpTokenInfoPayload;
        if (t && t.mint === mint) {
          infoPayload = t;
          if (!source) source = pumpTokenInfoToCreatedRecord(t);
        }
      }
      if (!source) {
        const local = loadCreatedCoins().find((c) => c.mint === mint) ?? null;
        if (local) source = local;
      }

      if (cancelled) return;
      if (!source) {
        source = {
          mint,
          name: mint.slice(0, 8),
          symbol: "TOKEN",
          createdAt: new Date().toISOString(),
        };
      }

      const base: ExploreEnrichedCoin = {
        ...emptyCoin,
        ...source,
        mint: source.mint,
        name: source.name || mint.slice(0, 8),
        symbol: source.symbol || "TOKEN",
        createdAt: source.createdAt,
        description: source.description || infoPayload?.description || undefined,
        imageUrl: source.imageUrl,
        creatorWallet: source.creatorWallet,
      };
      setCoin(base);
      setTokenInfo(infoPayload);
      setLoadState("ready");

      // Pump market cap is canonical for this UI.
      try {
        const pump = await fetchPumpFrontCoinState(mint);
        if (!cancelled) {
          setCoin((prev) => (prev && prev.mint === mint ? mergePump(prev, pump) : prev));
        }
      } catch {}

      // Keep Dex as secondary/fallback stats.
      try {
        const stats = await fetchSolanaTokenPairExploreStats(mint);
        if (!cancelled) {
          setCoin((prev) => (prev && prev.mint === mint ? mergeStats(prev, stats) : prev));
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [mint]);

  useEffect(() => {
    if (!coin?.mint || loadState !== "ready") return;
    const id = window.setInterval(() => {
      if (document.hidden || pumpPollBusyRef.current) return;
      pumpPollBusyRef.current = true;
      void fetchPumpFrontCoinState(coin.mint)
        .then((pump) => {
          setCoin((prev) => (prev && prev.mint === coin.mint ? mergePump(prev, pump) : prev));
        })
        .catch(() => {})
        .finally(() => {
          pumpPollBusyRef.current = false;
        });
    }, 8000);
    return () => window.clearInterval(id);
  }, [coin?.mint, loadState]);


  useEffect(() => {
    if (!walletAddress || !coin?.mint) return;
    if (tradeTab !== "sell") return;
    void fetch(`/api/trade/token-balance?wallet=${encodeURIComponent(walletAddress)}&mint=${encodeURIComponent(coin.mint)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { uiAmount?: number; decimals?: number } | null) => {
        if (!j) return;
        setTokenBalance(typeof j.uiAmount === "number" ? j.uiAmount : 0);
        setTokenDecimals(typeof j.decimals === "number" ? j.decimals : 6);
      })
      .catch(() => {});
  }, [walletAddress, coin?.mint, tradeTab]);

  useEffect(() => {
    if (!walletAddress) {
      setSolBalance(0);
      return;
    }
    void fetch(`/api/wallet-balance?wallet=${encodeURIComponent(walletAddress)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { sol?: number } | null) => {
        setSolBalance(typeof j?.sol === "number" ? j.sol : 0);
      })
      .catch(() => setSolBalance(0));
  }, [walletAddress]);

  useEffect(() => {
    if (!tradeMsg) return;
    const id = window.setTimeout(() => {
      setTradeMsg("");
      setTradeMsgIsError(false);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [tradeMsg]);

  useEffect(() => {
    setTradeAmount((prev) => {
      if (tradeTab === "sell") return prev === "0.05" ? "25" : prev;
      return prev === "25" || prev === "50" || prev === "100" ? "0.05" : prev;
    });
  }, [tradeTab]);

  function toAtomicAmount(input: string, decimals: number): string {
    const clean = input.trim();
    if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error("Enter a valid amount");
    const [whole, frac = ""] = clean.split(".");
    const fracCut = frac.slice(0, decimals).padEnd(decimals, "0");
    const joined = `${whole}${fracCut}`.replace(/^0+/, "") || "0";
    if (!/^\d+$/.test(joined) || joined === "0") throw new Error("Amount must be greater than zero");
    return joined;
  }

  function b64ToBytes(b64: string): Uint8Array {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: number | null = null;
    const timeout = new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (timer != null) window.clearTimeout(timer);
    }
  }

  async function executeTrade() {
    if (!coin) return;
    if (!walletAddress) {
      setTradeMsgIsError(true);
      setTradeMsg("Connect wallet first.");
      return;
    }
    setTradeBusy(true);
    setTradeMsg("");
    setTradeMsgIsError(false);
    setTradeSig("");
    try {
      if (tradeTab === "buy") {
        const wanted = Number(tradeAmount);
        if (!Number.isFinite(wanted) || wanted <= 0) throw new Error("Enter a valid SOL amount");
        if (solBalance <= 0 || wanted > solBalance) {
          throw new Error(`Insufficient balance: You have ${solBalance.toFixed(2)} SOL`);
        }
      } else {
        const pct = Number(tradeAmount);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error("Sell % must be between 0 and 100");
        if (tokenBalance <= 0) throw new Error(`Insufficient balance: You have ${tokenBalance.toFixed(2)} ${coin.symbol}`);
      }
      const amountAtomic =
        tradeTab === "buy"
          ? toAtomicAmount(tradeAmount, 9)
          : (() => {
              const pct = Number(tradeAmount);
              if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error("Sell % must be between 0 and 100");
              const tokenAmount = tokenBalance * (pct / 100);
              if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) throw new Error("No token balance to sell");
              return toAtomicAmount(tokenAmount.toFixed(tokenDecimals), tokenDecimals);
            })();
      const quoteRes = await withTimeout(
        fetch("/api/trade/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side: tradeTab,
            mint: coin.mint,
            amount: amountAtomic,
            slippageBps: 10000,
          }),
        }),
        12000,
        "Quote request",
      );
      const quoteJson = (await quoteRes.json()) as { quote?: Record<string, unknown>; error?: string };
      if (!quoteRes.ok || !quoteJson.quote) throw new Error(quoteJson.error || "Quote failed");

      const swapRes = await withTimeout(
        fetch("/api/trade/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteResponse: quoteJson.quote, userPublicKey: walletAddress }),
        }),
        12000,
        "Swap build",
      );
      const swapJson = (await swapRes.json()) as { swapTransaction?: string; error?: string };
      if (!swapRes.ok || !swapJson.swapTransaction) throw new Error(swapJson.error || "Swap transaction failed");

      const provider = await withTimeout(findInjectedProviderByAddress(walletAddress), 6000, "Wallet provider lookup");
      if (!provider) throw new Error("Wallet provider not available in browser. Reconnect wallet.");
      const tx = VersionedTransaction.deserialize(b64ToBytes(swapJson.swapTransaction));
      const signature = await withTimeout(signAndSendTransactionBase58(provider, tx), 45000, "Wallet signature");

      // Fast optimistic confirmation.
      const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      void conn.confirmTransaction(signature, "confirmed");
      setTradeSig(signature);
      setTradeMsgIsError(false);
      setTradeMsg(`${tradeTab === "buy" ? "Buy" : "Sell"} submitted.`);
    } catch (e) {
      setTradeMsgIsError(true);
      setTradeMsg(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setTradeBusy(false);
    }
  }

  useEffect(() => {
    if (!coin?.mint || loadState !== "ready") return;
    const id = window.setInterval(() => {
      if (document.hidden || statsPollBusyRef.current) return;
      statsPollBusyRef.current = true;
      void fetchSolanaTokenPairExploreStats(coin.mint)
        .then((stats) => {
          setCoin((prev) => (prev && prev.mint === coin.mint ? mergeStats(prev, stats) : prev));
        })
        .catch(() => {})
        .finally(() => {
          statsPollBusyRef.current = false;
        });
    }, 20000);
    return () => window.clearInterval(id);
  }, [coin?.mint, loadState]);

  if (loadState === "loading" || loadState === "idle") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--pump-muted)]">
        Loading token...
      </div>
    );
  }

  if (loadState === "notfound" || !coin) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--pump-muted)]">
        <p>We could not load this token. Check the mint address or try again.</p>
        <Link href="/" className="mt-4 inline-block text-[var(--pump-green)] hover:underline">
          ← Back home
        </Link>
      </div>
    );
  }

  const dev = (coin.creatorWallet || coin.mint).slice(0, 6);
  // Use mint route so DexScreener resolves the active pair itself.
  // Locking to a stale pair address can show a "wrong-looking" chart.
  const chartUrl = `https://dexscreener.com/solana/${encodeURIComponent(coin.mint)}?embed=1&theme=dark&trades=0&info=0`;
  // Keep header values aligned with the embedded Dex chart source.
  const currMcap = coin.pump.usdMarketCap ?? coin.mcap ?? 0;
  const athCandidate = coin.pump.athMarketCap ?? coin.fdvUsd ?? currMcap;
  const athMcap = Math.max(currMcap, athCandidate, 1);
  const progressBase = coin.pump.complete ? 1 : (coin.pump.bondingProgress ?? (athMcap > 0 ? currMcap / athMcap : 0));
  const athRatio = Math.min(1, Math.max(0, progressBase));
  const h24 = coin.priceChange.h24 ?? null;
  const h24Tone = h24 != null && h24 < 0 ? "text-red-400" : "text-emerald-400";
  const h24Text = h24 == null ? "(—)" : `(${h24 > 0 ? "+" : ""}${h24.toFixed(2)}%)`;

  function formatShortUsdLower(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n) || n <= 0) return "$0";
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }

  function formatUsdPrice(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n) || n <= 0) return "$0";
    if (n >= 1) return `$${n.toFixed(6)}`;
    if (n >= 0.01) return `$${n.toFixed(8)}`;
    return `$${n.toFixed(10)}`;
  }

  function formatPct(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  function sanitizeExternalUrl(raw: string | undefined): string | null {
    const v = (raw ?? "").trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  }

  const websiteUrl = sanitizeExternalUrl(tokenInfo?.website);
  const twitterUrl = sanitizeExternalUrl(tokenInfo?.twitter);
  const telegramUrl = sanitizeExternalUrl(tokenInfo?.telegram);
  const tokenDescription = (coin.description ?? tokenInfo?.description ?? "").trim();
  const watchlisted = isMintWatchlisted(coin.mint);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-4 text-[var(--pump-text)] lg:px-6">
      <div className="mb-3 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3">
        <div className="flex items-center gap-3">
          {coin.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coin.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-[var(--pump-green)]/35" />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-[var(--pump-surface)]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[31px] font-semibold leading-none text-white">{coin.name}</p>
            <p className="truncate text-base leading-tight text-[var(--pump-muted)]">{coin.symbol}</p>
            <p className="mt-1 text-sm text-[var(--pump-muted)]">
              <span className="text-[var(--pump-green)]">◌</span> {dev} · {formatLaunchAgo(coin.createdAt)}
            </p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => {
                toggleWatchlistMint(coin.mint);
                bumpWatch();
              }}
              aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                watchlisted
                  ? "border-amber-400/60 bg-amber-500/15 text-amber-300"
                  : "border-[var(--pump-border)] bg-[var(--pump-surface)] text-[var(--pump-muted)] hover:text-amber-300"
              }`}
            >
              {watchlisted ? "★" : "☆"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!navigator.clipboard) return;
                void navigator.clipboard.writeText(coin.mint).then(() => {
                  setCopiedCa(true);
                  window.setTimeout(() => setCopiedCa(false), 1400);
                });
              }}
              className="cursor-pointer rounded-lg border border-[var(--pump-border)] bg-[var(--pump-surface)] px-3 py-2 text-sm text-[var(--pump-text)]"
            >
              ⧉ {copiedCa ? "Copied" : `${coin.mint.slice(0, 4)}...${coin.mint.slice(-4)}`}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="overflow-hidden rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)]">
            <div className="border-b border-[var(--pump-border)] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-medium text-[var(--pump-muted)]">Market Cap</p>
                  <p className="mt-1 text-3xl font-medium leading-none text-white">{formatExploreMcap(coin)}</p>
                  <p className={`mt-1 text-sm ${h24Tone}`}>{h24Text} 24hr</p>
                </div>
                <div className="w-full max-w-[280px] pt-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--pump-surface)]">
                      <div
                        className="h-full bg-gradient-to-r from-[#2f3a4f] to-[#43e689]"
                        style={{ width: `${Math.round(athRatio * 100)}%` }}
                      />
                    </div>
                    <p className="whitespace-nowrap text-sm font-medium text-[var(--pump-muted)]">ATH {formatMcapUsd(athMcap)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative h-[620px]">
              <iframe
                title="DexScreener chart"
                src={chartUrl}
                className="h-[620px] w-full"
                loading="lazy"
                allow="clipboard-write"
              />
            </div>
            <div className="border-t border-[var(--pump-border)] p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3 text-center">
                  <p className="text-[11px] text-[var(--pump-muted)]">Vol 24h</p>
                  <p className="mt-1 text-base font-semibold text-white">{formatShortUsdLower(coin.vol24h)}</p>
                </div>
                <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3 text-center">
                  <p className="text-[11px] text-[var(--pump-muted)]">Price</p>
                  <p className="mt-1 text-base font-semibold text-white">{formatUsdPrice(coin.priceUsd)}</p>
                </div>
                <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3 text-center">
                  <p className="text-[11px] text-[var(--pump-muted)]">5m</p>
                  <p className={`mt-1 text-base font-semibold ${coin.priceChange.m5 != null && coin.priceChange.m5 < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatPct(coin.priceChange.m5)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3 text-center">
                  <p className="text-[11px] text-[var(--pump-muted)]">1h</p>
                  <p className={`mt-1 text-base font-semibold ${coin.priceChange.h1 != null && coin.priceChange.h1 < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatPct(coin.priceChange.h1)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3 text-center">
                  <p className="text-[11px] text-[var(--pump-muted)]">6h</p>
                  <p className={`mt-1 text-base font-semibold ${coin.priceChange.h6 != null && coin.priceChange.h6 < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatPct(coin.priceChange.h6)}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-[var(--pump-border)] bg-[var(--pump-surface)] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {websiteUrl ? (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-3 py-1.5 text-sm text-white hover:border-[var(--pump-green)]/45"
                    >
                      Website
                    </a>
                  ) : null}
                  {twitterUrl ? (
                    <a
                      href={twitterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-3 py-1.5 text-sm text-white hover:border-[var(--pump-green)]/45"
                    >
                      X
                    </a>
                  ) : null}
                  {telegramUrl ? (
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--pump-border)] bg-[var(--pump-elevated)] px-3 py-1.5 text-sm text-white hover:border-[var(--pump-green)]/45"
                    >
                      Telegram
                    </a>
                  ) : null}
                </div>
                <p className="text-base leading-relaxed text-[var(--pump-muted)]">
                  {tokenDescription || "No description available."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTradeTab("buy")}
                className={`cursor-pointer rounded-md py-2 text-sm font-bold ${
                  tradeTab === "buy"
                    ? "bg-[#28e38d] text-[#0d121a]"
                    : "bg-[var(--pump-surface)] text-[var(--pump-muted)]"
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTradeTab("sell")}
                className={`cursor-pointer rounded-md py-2 text-sm font-bold ${
                  tradeTab === "sell"
                    ? "bg-[#ef5350] text-white"
                    : "bg-[var(--pump-surface)] text-[var(--pump-muted)]"
                }`}
              >
                Sell
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {tradeTab === "buy" ? (
                <>
                  <button type="button" onClick={() => setTradeAmount("0.1")} className="cursor-pointer rounded-xl border border-[var(--pump-border)] bg-black/35 py-2 text-sm text-white">0.1 SOL</button>
                  <button type="button" onClick={() => setTradeAmount("0.5")} className="cursor-pointer rounded-xl border border-[var(--pump-border)] bg-black/35 py-2 text-sm text-white">0.5 SOL</button>
                  <button type="button" onClick={() => setTradeAmount("1")} className="cursor-pointer rounded-xl border border-[var(--pump-border)] bg-black/35 py-2 text-sm text-white">1 SOL</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setTradeAmount("25")} className="cursor-pointer rounded-xl border border-[#7a2a2a] bg-[#2a1212] py-2 text-sm text-[#ffb7b7]">25%</button>
                  <button type="button" onClick={() => setTradeAmount("50")} className="cursor-pointer rounded-xl border border-[#7a2a2a] bg-[#2a1212] py-2 text-sm text-[#ffb7b7]">50%</button>
                  <button type="button" onClick={() => setTradeAmount("100")} className="cursor-pointer rounded-xl border border-[#7a2a2a] bg-[#2a1212] py-2 text-sm text-[#ffb7b7]">100%</button>
                </>
              )}
            </div>
            <label className="mt-3 block text-xs text-[var(--pump-muted)]">
              Amount ({tradeTab === "buy" ? "SOL" : "%"})
            </label>
            <input
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--pump-border)] bg-[var(--pump-surface)] px-2.5 py-2 text-sm text-white outline-none"
              placeholder={tradeTab === "buy" ? "0.05" : "25"}
            />
            {tradeTab === "sell" ? (
              <p className="mt-1 text-[11px] text-[var(--pump-muted)]">Wallet balance: {tokenBalance.toFixed(2)}</p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--pump-muted)]">SOL Balance: {solBalance.toFixed(2)} SOL</p>
            )}
            {!walletAddress ? (
              <button
                type="button"
                onClick={openSignIn}
                className="mt-3 w-full cursor-pointer rounded-xl bg-[#43e689] px-3 py-2.5 text-center text-base font-semibold leading-none text-[#0d121a]"
              >
                Connect wallet
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void executeTrade()}
                disabled={tradeBusy}
                className={`mt-3 w-full cursor-pointer rounded-xl px-3 py-2.5 text-center text-base font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-60 ${
                  tradeTab === "sell" ? "bg-[#ef5350] text-white" : "bg-[#43e689] text-[#0d121a]"
                }`}
              >
                {tradeBusy ? "Submitting..." : tradeTab === "buy" ? `Buy ${coin.symbol}` : `Sell ${coin.symbol}`}
              </button>
            )}
            {tradeMsg ? (
              <p className={`mt-2 text-xs ${tradeMsgIsError ? "text-red-400" : "text-[var(--pump-muted)]"}`}>{tradeMsg}</p>
            ) : null}
            {tradeSig ? (
              <a
                href={`https://solscan.io/tx/${encodeURIComponent(tradeSig)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs text-[var(--pump-green)] hover:underline"
              >
                View transaction
              </a>
            ) : null}
          </div>

          <div className="rounded-xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-3">
            <div className="flex items-center justify-between text-xs text-[var(--pump-muted)]">
              <span>Bonding curve progress</span>
              <span>{coin.pump.bondingProgress != null ? `${(coin.pump.bondingProgress * 100).toFixed(1)}%` : "—"}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--pump-surface)]">
              <div
                className="h-full bg-[#6af09d]"
                style={{ width: `${Math.round((coin.pump.bondingProgress ?? 0) * 100)}%` }}
              />
            </div>
            <div className="mt-3 space-y-1 text-xs text-[var(--pump-muted)]">
              <p>Current mcap: {formatShortUsdLower(currMcap)}</p>
              <p>ATH mcap: {formatShortUsdLower(athMcap)}</p>
              <p>Status: {coin.pump.complete ? "Bonded" : "Bonding"}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { Buffer } from "node:buffer";
import bs58 from "bs58";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getFeeTreasuryWallet, getPinataJwt } from "@/lib/env";
import { ipfsUri, pinataUploadFile } from "@/lib/pinata";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MIN_DEV_BUY_SOL = 0;
const FIXED_SLIPPAGE = 15;
const FIXED_PRIORITY_FEE = 0.00005;
const NAME_MAX_LEN = 32;
const TICKER_MAX_LEN = 10;
const MAX_WHITELIST_WALLETS = 25;
const MAX_WHITELIST_FEE_BPS = 5000;
const HOLDERS_LIMIT = 100;
const MAX_DEV_BUY_AIRDROP_BPS = 10000;

function normalizeUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return raw;
  }
}

function isValidSolanaWallet(value: string): boolean {
  try {
    const key = new PublicKey(value);
    return PublicKey.isOnCurve(key.toBytes());
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const pinataJwt = getPinataJwt();
  const feeTreasuryWallet = getFeeTreasuryWallet();
  if (!pinataJwt) {
    return NextResponse.json(
      { error: "Missing PINATA_JWT on the server." },
      { status: 500 },
    );
  }
  if (!feeTreasuryWallet || !isValidSolanaWallet(feeTreasuryWallet)) {
    return NextResponse.json(
      { error: "Missing/invalid FEE_TREASURY_WALLET on server. Launch is blocked until configured." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const symbol = String(form.get("symbol") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const website = String(form.get("website") ?? "").trim();
  const twitter = String(form.get("twitter") ?? "").trim();
  const telegram = String(form.get("telegram") ?? "").trim();
  const amount = Number(form.get("amount") ?? MIN_DEV_BUY_SOL);
  const whitelistRaw = String(form.get("whitelistWallets") ?? "[]");
  const whitelistFeeBps = Number(form.get("whitelistFeeBps") ?? 0);
  const devBuyAirdropEnabled = String(form.get("devBuyAirdropEnabled") ?? "0") === "1";
  const devBuyAirdropBps = Number(form.get("devBuyAirdropBps") ?? 0);
  const devBuyAirdropWalletBpsRaw = String(form.get("devBuyAirdropWalletBps") ?? "[]");
  const creatorWalletRaw = String(form.get("creatorWallet") ?? "").trim();
  const creatorWallet = isValidSolanaWallet(creatorWalletRaw) ? creatorWalletRaw : null;
  let whitelistWallets: string[] = [];
  try {
    const parsed = JSON.parse(whitelistRaw) as unknown;
    if (Array.isArray(parsed)) whitelistWallets = parsed.map((v) => String(v).trim());
  } catch {
    return NextResponse.json({ error: "Invalid whitelist wallets payload." }, { status: 400 });
  }
  whitelistWallets = Array.from(new Set(whitelistWallets.filter((w) => isValidSolanaWallet(w))));

  const image = form.get("image");
  if (!name || !symbol) {
    return NextResponse.json({ error: "Name and ticker are required." }, { status: 400 });
  }
  if (name.length > NAME_MAX_LEN) {
    return NextResponse.json({ error: `Coin name max length is ${NAME_MAX_LEN} characters.` }, { status: 400 });
  }
  if (symbol.length > TICKER_MAX_LEN) {
    return NextResponse.json({ error: `Ticker max length is ${TICKER_MAX_LEN} characters.` }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }
  if (!creatorWallet) {
    return NextResponse.json({ error: "A valid creator wallet is required for launch and initial dev buy." }, { status: 400 });
  }
  if (whitelistWallets.length > MAX_WHITELIST_WALLETS) {
    return NextResponse.json({ error: `Whitelist wallets cannot exceed ${MAX_WHITELIST_WALLETS}.` }, { status: 400 });
  }
  if (whitelistFeeBps > 0 && whitelistWallets.length < 1) {
    return NextResponse.json(
      { error: "Whitelist wallets are required when whitelist fee split is above 0%." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(whitelistFeeBps) || whitelistFeeBps < 0 || whitelistFeeBps > MAX_WHITELIST_FEE_BPS) {
    return NextResponse.json({ error: "Whitelist fee split must be between 0% and 50%." }, { status: 400 });
  }
  if (!Number.isFinite(devBuyAirdropBps) || devBuyAirdropBps < 0 || devBuyAirdropBps > MAX_DEV_BUY_AIRDROP_BPS) {
    return NextResponse.json({ error: "Dev-buy airdrop percentage must be between 0% and 100%." }, { status: 400 });
  }
  if (devBuyAirdropEnabled && whitelistWallets.length < 1) {
    return NextResponse.json(
      { error: "Add at least one whitelist wallet when optional dev-buy token airdrop is enabled." },
      { status: 400 },
    );
  }

  let devBuyAirdropWalletBps: number[] = [];
  try {
    const parsed = JSON.parse(devBuyAirdropWalletBpsRaw) as unknown;
    if (Array.isArray(parsed)) devBuyAirdropWalletBps = parsed.map((v) => Number(v));
  } catch {
    return NextResponse.json({ error: "Invalid dev-buy airdrop wallet split payload." }, { status: 400 });
  }
  devBuyAirdropWalletBps = devBuyAirdropWalletBps
    .map((n) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0))
    .filter((n) => n >= 0);
  if (devBuyAirdropEnabled) {
    if (devBuyAirdropWalletBps.length !== whitelistWallets.length) {
      return NextResponse.json(
        { error: "Dev-buy token airdrop wallet split must have the same number of entries as the wallet list." },
        { status: 400 },
      );
    }
    const sum = devBuyAirdropWalletBps.reduce((a, b) => a + b, 0);
    if (sum !== 10000) {
      return NextResponse.json({ error: "Dev-buy token airdrop wallet split must sum to 100%." }, { status: 400 });
    }
  } else {
    devBuyAirdropWalletBps = [];
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 15MB or smaller." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < MIN_DEV_BUY_SOL) {
    return NextResponse.json({ error: "Invalid dev buy amount. Minimum is 0 SOL." }, { status: 400 });
  }

  const holdersFeeBps = whitelistWallets.length > 0 ? 10000 - whitelistFeeBps : 10000;

  const mintKeypair = Keypair.generate();
  const mintPublic = mintKeypair.publicKey.toBase58();
  try {
    const imageCid = await pinataUploadFile(pinataJwt, image, image.name || "token.png");
    const imageUrl = ipfsUri(imageCid);

    const banner = form.get("banner");
    let bannerUrl: string | undefined;
    if (banner instanceof File && banner.size > 0) {
      const bannerCid = await pinataUploadFile(pinataJwt, banner, banner.name || "banner.png");
      bannerUrl = ipfsUri(bannerCid);
    }

    const metadata: Record<string, string> = {
      name,
      symbol,
      image: imageUrl,
      description: description || `${name} (${symbol})`,
      twitter: normalizeUrl(twitter),
      telegram: normalizeUrl(telegram),
      website: normalizeUrl(website),
    };
    if (bannerUrl) metadata.banner = bannerUrl;

    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
    const metadataFile = new File([metadataBlob], "metadata.json", { type: "application/json" });
    const metadataCid = await pinataUploadFile(pinataJwt, metadataFile, "metadata.json");
    const metadataUri = ipfsUri(metadataCid);

    const tradeController = new AbortController();
    const tradeTimeout = setTimeout(() => tradeController.abort(), 45_000);
    const tradeRes = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: tradeController.signal,
      body: JSON.stringify({
        publicKey: creatorWallet,
        action: "create",
        tokenMetadata: {
          name,
          symbol,
          uri: metadataUri,
        },
        mint: mintPublic,
        denominatedInSol: "true",
        amount,
        slippage: FIXED_SLIPPAGE,
        priorityFee: FIXED_PRIORITY_FEE,
        feeRecipient: feeTreasuryWallet,
        pool: "pump",
      }),
    }).finally(() => clearTimeout(tradeTimeout));

    if (!tradeRes.ok) {
      const msg = await tradeRes.text().catch(() => tradeRes.statusText);
      return NextResponse.json({ error: `PumpPortal error: ${msg}` }, { status: 502 });
    }
    const txBytes = new Uint8Array(await tradeRes.arrayBuffer());
    const tx = VersionedTransaction.deserialize(txBytes);
    tx.sign([mintKeypair]);
    const transactionBase64 = Buffer.from(tx.serialize()).toString("base64");
    return NextResponse.json({
      mode: "wallet-sign",
      mint: mintPublic,
      transactionBase64,
      draft: {
        mint: mintPublic,
        name,
        symbol,
        creatorWallet,
        whitelistWallets,
        whitelistFeeBps,
        holdersFeeBps,
        holderLimit: HOLDERS_LIMIT,
        devBuyAirdropEnabled,
        devBuyAirdropBps: devBuyAirdropEnabled ? devBuyAirdropBps : 0,
        devBuyAirdropSupplyBps: 0,
        devBuyAirdropWalletBps,
        feeTreasuryWallet,
        feeRecipientLocked: true,
        description: description || null,
        imageUrl,
        metadataUri,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json(
        { error: "PumpPortal request timed out. Please retry in a few seconds." },
        { status: 504 },
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.toLowerCase().includes("pinata")) {
      return NextResponse.json({ error: message }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

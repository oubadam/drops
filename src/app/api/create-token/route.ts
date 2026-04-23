import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getFeeTreasuryWallet, getPinataJwt, getPumpPortalApiKey } from "@/lib/env";
import { ipfsUri, pinataUploadFile } from "@/lib/pinata";
import { recordDropLaunch } from "@/lib/drop-launches-db";
import { grindKeypairEndingDrop } from "@/lib/grind-drop-mint";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MIN_DEV_BUY_SOL = 0.05;
const FIXED_SLIPPAGE = 15;
const FIXED_PRIORITY_FEE = 0.00005;
const NAME_MAX_LEN = 32;
const TICKER_MAX_LEN = 10;
const MAX_WHITELIST_WALLETS = 25;
const MAX_WHITELIST_FEE_BPS = 5000;
const HOLDERS_LIMIT = 100;

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
  const pumpKey = getPumpPortalApiKey();
  const feeTreasuryWallet = getFeeTreasuryWallet();
  if (!pinataJwt || !pumpKey) {
    return NextResponse.json(
      { error: "Missing PINATA_JWT or PUMPPORTAL_API_KEY on the server." },
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
  if (whitelistWallets.length < 1 || whitelistWallets.length > MAX_WHITELIST_WALLETS) {
    return NextResponse.json({ error: `Whitelist wallets must be between 1 and ${MAX_WHITELIST_WALLETS}.` }, { status: 400 });
  }
  if (!Number.isFinite(whitelistFeeBps) || whitelistFeeBps < 0 || whitelistFeeBps > MAX_WHITELIST_FEE_BPS) {
    return NextResponse.json({ error: "Whitelist fee split must be between 0% and 50%." }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 15MB or smaller." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < MIN_DEV_BUY_SOL) {
    return NextResponse.json({ error: `Invalid dev buy amount. Minimum is ${MIN_DEV_BUY_SOL} SOL.` }, { status: 400 });
  }

  let mintKeypair;
  try {
    mintKeypair = grindKeypairEndingDrop();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Vanity mint failed.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
  const mintPublic = mintKeypair.publicKey.toBase58();
  const mintSecretBs58 = bs58.encode(mintKeypair.secretKey);

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

    const tradeUrl = `https://pumpportal.fun/api/trade?api-key=${encodeURIComponent(pumpKey)}`;
    const tradeRes = await fetch(tradeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        tokenMetadata: {
          name,
          symbol,
          uri: metadataUri,
        },
        mint: mintSecretBs58,
        denominatedInSol: "true",
        amount,
        slippage: FIXED_SLIPPAGE,
        priorityFee: FIXED_PRIORITY_FEE,
        feeRecipient: feeTreasuryWallet,
        pool: "pump",
      }),
    });

    const tradeText = await tradeRes.text();
    let tradeJson: Record<string, unknown> | null = null;
    try {
      tradeJson = JSON.parse(tradeText) as Record<string, unknown>;
    } catch {
      /* non-json */
    }

    if (!tradeRes.ok) {
      const msg =
        (tradeJson?.error as string | undefined) ||
        (tradeJson?.message as string | undefined) ||
        tradeText ||
        tradeRes.statusText;
      return NextResponse.json({ error: `PumpPortal error: ${msg}` }, { status: 502 });
    }

    const signature =
      (tradeJson?.signature as string | undefined) ||
      (tradeJson?.tx as string | undefined) ||
      (tradeJson?.transaction as string | undefined);

    const indexed = await recordDropLaunch({
      mint: mintPublic,
      name,
      symbol,
      creatorWallet,
      whitelistWallets,
      whitelistFeeBps,
      holdersFeeBps: 10000 - whitelistFeeBps,
      holderLimit: HOLDERS_LIMIT,
      feeTreasuryWallet,
      feeRecipientLocked: true,
      description: description || null,
      imageUrl,
      metadataUri,
      signature: signature ?? null,
    });

    return NextResponse.json({
      mint: mintPublic,
      signature: signature ?? null,
      metadataUri,
      imageUrl,
      raw: tradeJson,
      launchIndexed: indexed.ok,
      launchIndexError: indexed.ok ? undefined : indexed.error,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

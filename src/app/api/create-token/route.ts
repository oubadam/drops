import bs58 from "bs58";
import { NextResponse } from "next/server";
import { getPinataJwt, getPumpPortalApiKey } from "@/lib/env";
import { ipfsUri, pinataUploadFile } from "@/lib/pinata";
import { recordDropLaunch } from "@/lib/drop-launches-db";
import { grindKeypairEndingDrop } from "@/lib/grind-drop-mint";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const pinataJwt = getPinataJwt();
  const pumpKey = getPumpPortalApiKey();
  if (!pinataJwt || !pumpKey) {
    return NextResponse.json(
      { error: "Missing PINATA_JWT or PUMPPORTAL_API_KEY on the server." },
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
  const amount = Number(form.get("amount") ?? 0.01);
  const slippage = Number(form.get("slippage") ?? 15);
  const priorityFee = Number(form.get("priorityFee") ?? 0.00005);

  const image = form.get("image");
  if (!name || !symbol) {
    return NextResponse.json({ error: "Name and ticker are required." }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 15MB or smaller." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid dev buy amount." }, { status: 400 });
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
      twitter: twitter || "",
      telegram: telegram || "",
      website: website || "",
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
        slippage,
        priorityFee,
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

import { NextResponse } from "next/server";
import { getSolanaRpcUrl } from "@/lib/env";
import { recordDropLaunch } from "@/lib/drop-launches-db";

type LaunchDraft = {
  mint: string;
  name: string;
  symbol: string;
  creatorWallet: string | null;
  whitelistWallets: string[];
  whitelistFeeBps: number;
  holdersFeeBps: number;
  holderLimit: number;
  devBuyAirdropEnabled: boolean;
  devBuyAirdropBps: number;
  devBuyAirdropSupplyBps: number;
  devBuyAirdropWalletBps: number[];
  feeTreasuryWallet: string;
  feeRecipientLocked: boolean;
  description: string | null;
  imageUrl: string | null;
  metadataUri: string | null;
};

async function waitForSignatureOnChain(signature: string, timeoutMs = 35_000): Promise<boolean> {
  const rpcUrl = getSolanaRpcUrl();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }],
        }),
      });
      const json = (await res.json()) as {
        result?: { value?: Array<{ err?: unknown } | null> };
      };
      const status = json.result?.value?.[0] ?? null;
      if (status && status.err == null) return true;
      if (status && status.err != null) return false;
    } catch {
      // Retry until timeout.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export async function POST(request: Request) {
  let body: { signature?: string; draft?: LaunchDraft };
  try {
    body = (await request.json()) as { signature?: string; draft?: LaunchDraft };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const signature = String(body.signature ?? "").trim();
  const draft = body.draft;
  if (!signature || !draft?.mint || !draft.name || !draft.symbol) {
    return NextResponse.json({ error: "Missing signature or draft payload." }, { status: 400 });
  }

  const confirmed = await waitForSignatureOnChain(signature);
  if (!confirmed) {
    return NextResponse.json(
      { error: "Wallet transaction was not confirmed on-chain. Launch failed or was dropped." },
      { status: 502 },
    );
  }

  const indexed = await recordDropLaunch({
    ...draft,
    signature,
  });

  return NextResponse.json({
    mint: draft.mint,
    signature,
    imageUrl: draft.imageUrl,
    metadataUri: draft.metadataUri,
    launchIndexed: indexed.ok,
    launchIndexError: indexed.ok ? undefined : indexed.error,
  });
}

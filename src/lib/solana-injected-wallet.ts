import bs58 from "bs58";

export type InjectedWalletId = "phantom" | "solflare" | "bitget" | "torus";

type SolanaInjected = {
  connect?: (opts?: unknown) => Promise<{ publicKey?: unknown } | void>;
  publicKey?: unknown | null;
  isPhantom?: boolean;
  isTorus?: boolean;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array } | { signature: Uint8Array }[] | Uint8Array>;
  signAndSendTransaction?: (tx: unknown, opts?: unknown) => Promise<{ signature?: Uint8Array | string } | string>;
};

function toBase58Address(pk: unknown): string {
  if (!pk) throw new Error("Wallet did not return a public key");
  if (typeof pk === "string") return pk;
  if (typeof (pk as { toBase58?: () => string }).toBase58 === "function") {
    return (pk as { toBase58: () => string }).toBase58();
  }
  if (typeof (pk as { toString?: () => string }).toString === "function") {
    const s = (pk as { toString: () => string }).toString();
    if (s && s !== "[object Object]") return s;
  }
  throw new Error("Unsupported public key format from wallet");
}

function getWindow() {
  if (typeof window === "undefined") return null;
  return window as Window & {
    phantom?: { solana?: SolanaInjected };
    solana?: SolanaInjected;
    solflare?: SolanaInjected;
    bitkeep?: { solana?: SolanaInjected };
    BitKeep?: { solana?: SolanaInjected };
    torus?: { solana?: SolanaInjected };
  };
}

/** Returns the browser extension's injected Solana provider, or null if missing. */
export function getInjectedSolanaProvider(id: InjectedWalletId): SolanaInjected | null {
  const w = getWindow();
  if (!w) return null;

  if (id === "phantom") {
    const fromPhantom = w.phantom?.solana;
    if (fromPhantom?.isPhantom) return fromPhantom;
    if (w.solana?.isPhantom) return w.solana;
    return null;
  }

  if (id === "solflare") {
    return w.solflare ?? null;
  }

  if (id === "bitget") {
    return w.bitkeep?.solana ?? w.BitKeep?.solana ?? null;
  }

  if (id === "torus") {
    return w.torus?.solana ?? (w.solana?.isTorus ? w.solana : null) ?? null;
  }

  return null;
}

function tryGetProviderAddress(provider: SolanaInjected | null): string | null {
  if (!provider?.publicKey) return null;
  try {
    return toBase58Address(provider.publicKey);
  } catch {
    return null;
  }
}

export async function findInjectedProviderByAddress(address: string): Promise<SolanaInjected | null> {
  const ids: InjectedWalletId[] = ["phantom", "solflare", "bitget", "torus"];
  for (const id of ids) {
    const provider = getInjectedSolanaProvider(id);
    if (!provider) continue;
    const existing = tryGetProviderAddress(provider);
    if (existing === address) return provider;
    if (provider.connect) {
      try {
        await provider.connect({ onlyIfTrusted: true });
      } catch {
        /* provider may reject if not trusted yet */
      }
      const next = tryGetProviderAddress(provider);
      if (next === address) return provider;
    }
  }
  return null;
}

export async function connectInjectedSolana(provider: SolanaInjected): Promise<string> {
  if (!provider.connect) throw new Error("Wallet does not support connect()");
  const res = await provider.connect();
  const pk = provider.publicKey ?? (res && typeof res === "object" && "publicKey" in res ? (res as { publicKey?: unknown }).publicKey : null);
  return toBase58Address(pk);
}

/** Base64-encoded signature bytes, as expected by Privy `loginWithSiws` (see Privy SIWS docs). */
export async function signUtf8MessageBase64(provider: SolanaInjected, message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  if (!provider.signMessage) throw new Error("Wallet cannot sign this sign-in message");
  const signed = await provider.signMessage(bytes);
  const raw =
    signed instanceof Uint8Array
      ? signed
      : Array.isArray(signed)
        ? signed[0]?.signature
        : signed.signature;
  if (!(raw instanceof Uint8Array)) throw new Error("Unexpected signature format from wallet");
  let binary = "";
  for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]!);
  return btoa(binary);
}

export async function signAndSendTransactionBase58(provider: SolanaInjected, tx: unknown): Promise<string> {
  if (!provider.signAndSendTransaction) throw new Error("Wallet cannot send transactions");
  const out = await provider.signAndSendTransaction(tx, { preflightCommitment: "confirmed" });
  if (typeof out === "string") return out;
  const sig = out?.signature;
  if (!sig) throw new Error("Wallet returned no transaction signature");
  if (typeof sig === "string") return sig;
  if (sig instanceof Uint8Array) return bs58.encode(sig);
  throw new Error("Unsupported signature format from wallet");
}

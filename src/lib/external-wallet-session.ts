"use client";

const EXTERNAL_WALLET_KEY = "drop_external_wallet_address_v1";
const EXTERNAL_WALLET_EVENT = "drop:external-wallet-updated";

export function getExternalWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EXTERNAL_WALLET_KEY);
}

export function setExternalWalletAddress(address: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXTERNAL_WALLET_KEY, address);
  window.dispatchEvent(new Event(EXTERNAL_WALLET_EVENT));
}

export function clearExternalWalletAddress() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EXTERNAL_WALLET_KEY);
  window.dispatchEvent(new Event(EXTERNAL_WALLET_EVENT));
}

export function subscribeExternalWallet(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === EXTERNAL_WALLET_KEY) listener();
  };
  window.addEventListener(EXTERNAL_WALLET_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EXTERNAL_WALLET_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

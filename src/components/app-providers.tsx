"use client";

import type { ReactNode } from "react";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { isPrivyConfigured, PRIVY_APP_ID } from "@/lib/privy-config";
import { SignInModalProvider } from "@/components/sign-in-modal-context";

const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "dark",
    walletChainType: "solana-only",
    accentColor: "#5eead4",
  },
  loginMethods: ["email", "google", "twitter", "apple", "wallet"],
  embeddedWallets: {
    solana: {
      createOnLogin: "users-without-wallets",
    },
  },
  externalWallets: {
    solana: {
      connectors: toSolanaWalletConnectors(),
    },
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  if (!isPrivyConfigured) {
    return <SignInModalProvider auth="missing">{children}</SignInModalProvider>;
  }
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <SignInModalProvider auth="privy">{children}</SignInModalProvider>
    </PrivyProvider>
  );
}

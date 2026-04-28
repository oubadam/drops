import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { PumpAppFrame } from "@/components/pump-app-frame";
import normaldrop from "@/components/normaldrop.png";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  /** Mono is only used via theme tokens; preloading both sans + mono triggers unused preload warnings in dev. */
  preload: false,
});

export const metadata: Metadata = {
  title: "drops",
  description: "Create pump.fun coins via PumpPortal + Pinata. Home, create, profile, docs.",
  icons: {
    icon: normaldrop.src,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden bg-[var(--pump-bg)] text-[var(--pump-text)]">
        <div className="h-full">
          <AppProviders>
            <PumpAppFrame>{children}</PumpAppFrame>
          </AppProviders>
        </div>
      </body>
    </html>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import dropBanner from "./dropban.png";

const STORAGE_KEY = "drop_welcome_dismissed_v2";

export function WelcomeModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");
  const isHome = pathname === "/";

  useEffect(() => {
    startTransition(() => {
      if (typeof window === "undefined") return;

      if (isDocsRoute) {
        window.localStorage.setItem(STORAGE_KEY, "1");
        setOpen(false);
        return;
      }

      if (!isHome) {
        setOpen(false);
        return;
      }

      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
      else setOpen(false);
    });
  }, [isDocsRoute, isHome]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--pump-border)] bg-[#0c0c0c] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full overflow-hidden border-b border-[var(--pump-border)]">
          <Image
            src={dropBanner}
            alt="drops: just drop it"
            width={dropBanner.width}
            height={dropBanner.height}
            className="block h-auto w-full"
            sizes="(max-width: 448px) 100vw, 448px"
            priority
          />
          <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
            <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--pump-green)]">
              Verifiable drops
            </span>
            <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-medium text-[var(--pump-yellow)]">
              On-chain receipts
            </span>
          </div>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-5 text-center">
          <h2 id="welcome-title" className="text-2xl font-black tracking-tight text-white">
            tired of fake airdrops?
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            airdrops nowadays are just trusting random devs. this trust is slowly disappearing with the infinite amount of devs promising airdrops, then selling their whole supply.  
          </p>
          <p className="text-sm leading-relaxed text-zinc-400">
          <span className="text-[var(--pump-green)]">drops</span> does it differently: devs must specify the wallets to recieve tokens as an airdrop, before the token is launched.
          
          </p>
          <h2 id="welcome-title" className="text-1xl font-black tracking-tight text-white">
            while other devs promise an airdrop, <span className="text-[var(--pump-green)]">drops</span> has already done it.  
          </h2>
          

          <button
            type="button"
            onClick={dismiss}
            className="w-full cursor-pointer select-none rounded-xl border border-black/10 bg-[var(--pump-green)] py-3.5 text-sm font-black text-white shadow-[0_2px_0_0_rgba(0,0,0,0.35)] transition-[opacity,box-shadow,transform] duration-150 hover:opacity-90 hover:shadow-[0_2px_0_0_rgba(0,0,0,0.45)] active:translate-y-px active:opacity-85 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pump-yellow)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c]"
          >
            Continue
          </button>

          <p className="text-[10px] leading-relaxed text-zinc-600">
            Crypto is risky; not financial advice.{" "}
            <Link
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--pump-green)] underline underline-offset-2 hover:opacity-90"
            >
              Docs
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

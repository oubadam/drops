import Image from "next/image";
import Link from "next/link";

import dropBanner from "@/components/dropban.png";
import { HomeDropsExplore } from "@/components/home-drops-explore";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-3 py-12 text-center sm:px-4 sm:py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--pump-yellow)]">drop</p>
      <div className="mt-6 w-full overflow-hidden rounded-2xl border border-[var(--pump-border)] border-t-[var(--pump-yellow)]/50 shadow-lg shadow-black/20">
        <Image
          src={dropBanner}
          alt="drops: just drop it"
          width={dropBanner.width}
          height={dropBanner.height}
          className="block h-auto w-full"
          sizes="(max-width: 672px) 100vw, 672px"
          priority
        />
      </div>
      <h1 className="mt-8 text-balance text-4xl font-black tracking-tight sm:text-5xl">Launch on pump.fun, from here.</h1>
      <p className="mt-6 text-pretty text-sm text-[var(--pump-muted)] sm:text-base">
        Create a coin with the same flow as pump.fun: name, ticker, socials, and media. We generate the mint, upload metadata to
        IPFS via Pinata, and hit PumpPortal&apos;s create API — no pasting mint addresses.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/create" className="btn-primary min-w-[160px]">
          Create coin
        </Link>
        <Link href="/profile" className="btn-ghost min-w-[160px]">
          Profile
        </Link>
        <Link href="/docs" className="btn-ghost min-w-[160px]">
          Docs
        </Link>
      </div>
      <p className="mt-12 text-xs text-[var(--pump-muted)]">
        Trading and markets live on{" "}
        <a className="text-[var(--pump-green)] hover:underline" href="https://pump.fun/" target="_blank" rel="noreferrer">
          pump.fun
        </a>
        . drop is not affiliated with pump.fun.
      </p>
      </div>

      <HomeDropsExplore />
    </div>
  );
}

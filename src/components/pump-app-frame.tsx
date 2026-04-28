"use client";

import type { ReactNode } from "react";
import bgdrops from "@/components/bgdrops.png";
import { PumpMainTopBar } from "@/components/pump-main-top-bar";
import { PumpMobileNav } from "@/components/pump-mobile-nav";
import { RoutePrefetcher } from "@/components/route-prefetcher";
import { RouteProgressBar } from "@/components/route-progress-bar";
import { PumpSidebar } from "@/components/pump-sidebar";
import { WelcomeModal } from "@/components/welcome-modal";

export function PumpAppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-transparent text-[var(--pump-text)]">
      <RoutePrefetcher />
      <RouteProgressBar />
      <WelcomeModal />
      <PumpSidebar />
      <div className="@container/topbar relative isolate z-0 flex min-h-0 min-w-0 flex-1 flex-col border-l-0 md:border-l md:border-[var(--pump-border)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${bgdrops.src})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center bottom",
              backgroundSize: "100% auto",
              opacity: 0.11,
            }}
          />
        </div>
        <PumpMainTopBar />
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {children}
        </div>
      </div>
      <PumpMobileNav />
    </div>
  );
}

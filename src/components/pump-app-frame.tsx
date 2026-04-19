"use client";

import type { ReactNode } from "react";
import { PumpMainTopBar } from "@/components/pump-main-top-bar";
import { PumpMobileNav } from "@/components/pump-mobile-nav";
import { PumpSidebar } from "@/components/pump-sidebar";
import { WelcomeModal } from "@/components/welcome-modal";

export function PumpAppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--pump-bg)] text-[var(--pump-text)]">
      <WelcomeModal />
      <PumpSidebar />
      <div className="@container/topbar relative isolate z-0 flex min-h-0 min-w-0 flex-1 flex-col border-l-0 md:border-l md:border-[var(--pump-border)]">
        <PumpMainTopBar />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {children}
        </div>
      </div>
      <PumpMobileNav />
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUserInCircle } from "@/components/icon-user-in-circle";

const STROKE = 1.75;
const ICON = "h-[22px] w-[22px]";
const SLOT_BASE =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors active:opacity-90";

/**
 * Bottom nav — same rules as sidebar: white by default, accent blue only on active route.
 * Shown below `sm` (640px).
 */
export function PumpMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex min-h-14 flex-col border-t border-[var(--pump-border)] bg-[var(--pump-sidebar)] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      aria-label="Main navigation"
    >
      <div className="grid h-14 w-full grid-cols-4 place-items-center px-1">
        <MobileItem href="/" label="Home" active={pathname === "/"}>
          <IconHomeOutline className={ICON} />
        </MobileItem>

        <MobileItem href="/profile" label="Profile" active={pathname === "/profile"}>
          <IconUserInCircle className={ICON} strokeWidth={STROKE} />
        </MobileItem>

        <MobileItem href="/docs" label="Docs" active={pathname === "/docs" || pathname.startsWith("/docs/")}>
          <IconDocOutline className={ICON} />
        </MobileItem>

        <MobileItem href="/create" label="Create" active={pathname === "/create"}>
          <IconPlusInCircle className={ICON} />
        </MobileItem>
      </div>
    </nav>
  );
}

function MobileItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const cls = `${SLOT_BASE} text-white ${active ? "bg-[var(--pump-nav-active-bg)] hover:bg-[var(--pump-nav-active-hover)]" : "hover:bg-white/[0.05]"}`;
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={active ? "page" : undefined}>
      <span className={active ? "text-[var(--pump-green)]" : "text-white"}>{children}</span>
    </Link>
  );
}

function IconHomeOutline({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={STROKE}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function IconPlusInCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={STROKE}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path strokeLinecap="round" d="M12 8.25v7.5M8.25 12h7.5" />
    </svg>
  );
}

function IconDocOutline({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={STROKE}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z"
      />
    </svg>
  );
}

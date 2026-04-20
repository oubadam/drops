"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { SignInModalPrivy } from "@/components/sign-in-modal-privy";

type AuthMode = "privy" | "missing";

const Ctx = createContext<{ openSignIn: () => void } | null>(null);

export function useOpenSignIn() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOpenSignIn must be used within SignInModalProvider");
  return v;
}

export function SignInModalProvider({ auth, children }: { auth: AuthMode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSignIn = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openSignIn }), [openSignIn]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {open && auth === "privy" ? <SignInModalPrivy onClose={close} /> : null}
      {open && auth === "missing" ? <MissingPrivyModal onClose={close} /> : null}
    </Ctx.Provider>
  );
}

function MissingPrivyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privy-missing-title"
        className="relative w-full max-w-md rounded-2xl border border-[var(--pump-border)] bg-[var(--pump-elevated)] p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg p-1 text-[var(--pump-muted)] hover:bg-white/5 hover:text-white"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 id="privy-missing-title" className="pr-8 text-lg font-bold text-white">
          Sign in unavailable
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Add <span className="font-mono text-[var(--pump-green)]">NEXT_PUBLIC_PRIVY_APP_ID</span> to{" "}
          <span className="font-mono">.env.local</span> (from the Privy dashboard), then restart the dev server.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-black/10 bg-[var(--pump-green)] py-3 text-sm font-bold text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}

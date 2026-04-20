"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const trickleRef = useRef<number | null>(null);
  const finishRef = useRef<number | null>(null);

  const routeKey = `${pathname ?? ""}?${searchParams?.toString() ?? ""}`;

  useEffect(() => {
    function clearTimers() {
      if (trickleRef.current) {
        window.clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
      if (finishRef.current) {
        window.clearTimeout(finishRef.current);
        finishRef.current = null;
      }
    }

    function start() {
      clearTimers();
      setExiting(false);
      setVisible(true);
      setProgress(8);
      trickleRef.current = window.setInterval(() => {
        setProgress((p) => (p >= 88 ? p : p + Math.max(1, (90 - p) * 0.08)));
      }, 120);
    }

    function complete() {
      if (!visible) return;
      clearTimers();
      setProgress(100);
      finishRef.current = window.setTimeout(() => {
        setExiting(true);
        finishRef.current = window.setTimeout(() => {
          setVisible(false);
          setExiting(false);
          setProgress(0);
        }, 180);
      }, 90);
    }

    function onDocClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const rawHref = a.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const samePathAndQuery = url.pathname === window.location.pathname && url.search === window.location.search;
      if (samePathAndQuery) return;
      start();
    }

    function onPopstate() {
      start();
    }

    document.addEventListener("click", onDocClick, true);
    window.addEventListener("popstate", onPopstate);

    return () => {
      document.removeEventListener("click", onDocClick, true);
      window.removeEventListener("popstate", onPopstate);
      clearTimers();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    // Route committed; finish quickly and fade out.
    setProgress((p) => (p < 92 ? 92 : p));
    const t = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => {
        setExiting(true);
        window.setTimeout(() => {
          setVisible(false);
          setExiting(false);
          setProgress(0);
        }, 180);
      }, 80);
    }, 20);
    return () => window.clearTimeout(t);
  }, [routeKey, visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed left-0 right-0 top-0 z-[300] h-[2px] bg-transparent transition-opacity duration-200 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="h-full bg-white transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}


"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const HOT_ROUTES = ["/", "/create", "/profile", "/docs"] as const;

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    // Warm key routes right after initial paint so first nav feels instant.
    const t = window.setTimeout(() => {
      for (const r of HOT_ROUTES) router.prefetch(r);
    }, 120);
    return () => window.clearTimeout(t);
  }, [router]);

  return null;
}


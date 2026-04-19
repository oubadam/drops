"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Tracks `window.matchMedia(query).matches`.
 * Uses `useLayoutEffect` so the value updates before paint (avoids “stuck” wrong layout on load).
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);

  return matches;
}

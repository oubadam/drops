import type { NextConfig } from "next";

/**
 * Browsing via `http://127.0.0.1:3000` sends `Origin: http://127.0.0.1:3000` (hostname `127.0.0.1`), which is
 * outside Next’s default dev allowlist (`localhost` only). Next then blocks `/_next/webpack-hmr` with 403, so the
 * browser logs repeated WebSocket failures even though the app runs. Listing the host here fixes HMR for IP URLs.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "::1"],
};

export default nextConfig;

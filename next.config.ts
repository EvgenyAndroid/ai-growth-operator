import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy (P6).
 *
 * Enforced (not report-only): the policy below is verified compatible with
 * this app — build + full smoke suite green, pages render. Rationale for the
 * two relaxations, documented per the hardening brief:
 *
 * - `script-src 'unsafe-inline'`: Next.js App Router bootstraps hydration
 *   through inline <script> tags without nonces. A strict nonce-based CSP
 *   requires per-request nonce middleware + `headers()` moving off static
 *   config; that is a production TODO (see docs/HARDENING-BRIEF.md P6), not
 *   an alpha-demo requirement. `'unsafe-eval'` is dev-only (React Refresh).
 * - `style-src 'unsafe-inline'`: React inline style props + Next-injected
 *   style tags.
 *
 * Everything else is locked down: no external script/style/img/font/connect
 * origins (the app is deliberately offline-capable — no CDNs), no plugins,
 * no framing (frame-ancestors 'none' + X-Frame-Options DENY belt-and-braces),
 * form posts and <base> pinned to self. Dev adds ws:/wss: for HMR.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  // Demo workspace with simulated data — keep it out of search indexes
  // (mirrored by the robots metadata in app/layout.tsx).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the workspace root (a stray lockfile exists in a parent directory).
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Every route, including static assets and the root.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

// Makes getCloudflareContext() usable during `next dev` (bindings via miniflare).
initOpenNextCloudflareForDev();

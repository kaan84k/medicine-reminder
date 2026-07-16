import type { NextConfig } from "next";

// Security headers (P1-2). Applied to every route.
//
// CSP note: `script-src` includes `'unsafe-inline'` as a **documented
// exception**. Next.js App Router injects inline hydration/streaming scripts
// with no nonce by default; a strict `script-src 'self'` breaks the app. Bootstrap
// is now self-hosted (imported in app/layout.tsx) so no external origins are
// needed and all other directives stay tight. The A+ hardening follow-up is to
// move to a nonce-based CSP in middleware and drop `'unsafe-inline'` for scripts.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // 2 years, subdomains, preload-eligible (>= the required 15552000).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

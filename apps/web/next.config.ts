import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const isProduction = process.env.NODE_ENV === "production";

/**
 * The quotation and invoice previews embed a same-origin PDF proxied through the BFF, so
 * `frame-src 'self'` is required. `'unsafe-inline'` on styles covers Next's inlined critical CSS;
 * scripts stay restricted to same-origin. Development additionally needs `'unsafe-eval'` for the
 * React refresh runtime, so the stricter policy is applied only to production builds.
 */
// RevenueCat Web SDK + optional Stripe checkout (RC Billing) need these origins.
// Test Store keys only need api.revenuecat.com / e.revenue.cat; Stripe hosts are for RC Billing.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "img-src 'self' data: blob: https://*.revenuecat.com https://*.stripe.com",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com" +
    (isProduction ? "" : " 'unsafe-eval'"),
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://api.revenuecat.com https://e.revenue.cat https://api.stripe.com https://*.stripe.com",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@bizo/contracts", "@bizo/ui", "@revenuecat/purchases-js"],
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

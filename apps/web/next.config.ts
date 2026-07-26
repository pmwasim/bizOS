import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@bizo/contracts", "@bizo/ui"],
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/marketing";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    "",
    "/product",
    "/pricing",
    "/subscribe",
    "/signup",
    "/signin",
    "/contact",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency:
      path === "" || path === "/pricing" || path === "/product" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" || path === "/product" ? 0.9 : 0.6,
  }));
}

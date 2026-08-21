import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/marketing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/b/", "/admin/", "/api/", "/start"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

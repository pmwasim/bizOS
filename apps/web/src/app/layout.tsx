import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";

import { SITE_URL } from "@/lib/marketing";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "bizOS — Quotations and invoices for service businesses",
    template: "%s · bizOS",
  },
  description:
    "Create customers, send polished quotations, and turn them into invoices. Free 30-day trial for service businesses in Saudi Arabia, the UAE, and India.",
  openGraph: {
    type: "website",
    siteName: "bizOS",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "bizOS — Quotations and invoices for service businesses",
    description:
      "From new customer to sent invoice in minutes. Free 30-day trial — no card required.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const localeCookie = cookieStore.get("locale")?.value || cookieStore.get("lang")?.value;
  const headerLocale =
    headerStore.get("x-locale") ||
    (headerStore.get("accept-language")?.startsWith("ar") ? "ar" : null);

  const isArabic = localeCookie === "ar" || headerLocale === "ar";
  const lang = isArabic ? "ar" : "en";
  const dir = isArabic ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir}>
      <body>{children}</body>
    </html>
  );
}

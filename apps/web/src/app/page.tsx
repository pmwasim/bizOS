import type { Metadata } from "next";

import { auth } from "@/auth";
import { LandingPage } from "@/components/landing-page";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { MarketingShell } from "@/components/marketing-shell";
import { SITE_URL } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "bizOS — The Business Operating System for service companies",
  description:
    "Run offers, invoices, payments, and statements in plain language. Free 30-day trial for service businesses in Saudi Arabia, the UAE, and India.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "bizOS — The Business Operating System for service companies",
    description:
      "From first offer to paid invoice — with a proper ERP underneath and none of the jargon in the way.",
    url: SITE_URL,
    siteName: "bizOS",
    type: "website",
  },
};

export default async function Home() {
  const session = await auth();
  const ctaHref = session ? "/start" : "/signup";
  const ctaLabel = session ? "Continue to bizOS" : "Start free — 30 days";

  return (
    <main>
      <MarketingShell
        active="home"
        sessionHref={session ? "/start" : "/signin"}
        sessionLabel={session ? "Open workspace" : "Sign in"}
      >
        <MaintenanceBanner />
        <LandingPage ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </MarketingShell>
    </main>
  );
}

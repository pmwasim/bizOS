import { ArrowRight, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { MarketingShell } from "@/components/marketing-shell";
import { PricingTable } from "@/components/pricing-table";
import { SITE_URL } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Pricing & Plans",
  description:
    "Transparent, per-business pricing for small businesses, contractors, and service companies in Saudi Arabia, UAE, and India. Start with a 30-day free trial.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing & Plans · bizOS",
    description:
      "Pay per business, not per seat. Start free for 30 days — no credit card required.",
    url: `${SITE_URL}/pricing`,
    siteName: "bizOS",
    type: "website",
  },
};

const SERVICES = [
  {
    title: "Guided self-setup",
    price: "Free",
    scope: "Product-led registration and documented configuration wizard",
  },
  {
    title: "Assisted remote setup",
    price: "SAR 750 / AED 750 / ₹7,500",
    scope:
      "Up to two remote sessions: company setup, pack selection, users, and opening configuration",
  },
  {
    title: "Team training",
    price: "SAR 500 / AED 500 / ₹5,000 per session",
    scope: "Up to 90 minutes, up to ten attendees, standard workflow walkthrough",
  },
  {
    title: "Configuration workshop",
    price: "SAR 1,500 / AED 1,500 / ₹15,000",
    scope: "Discovery plus a fixed, documented configuration plan",
  },
];

const FAQS = [
  {
    question: "Do you charge per user seat or per business?",
    answer:
      "We charge primarily per business entity, with team member allowances included in each tier. This matches small businesses where several collaborators need visibility without unpredictable per-seat surcharges.",
  },
  {
    question: "Are country compliance features and ZATCA included?",
    answer:
      "Growth includes Saudi ZATCA Phase 1 helpers (QR payload and unsigned UBL XML export) and tax summaries for Saudi Arabia, the UAE, and India. Full Phase 2 Fatoora clearance (cryptographic stamp and regulator submission) is not finished yet — treat that path as beta until we say otherwise. Always confirm filing requirements with your tax adviser.",
  },
  {
    question: "Can I switch plans or cancel anytime?",
    answer:
      "Yes for subscriptions purchased through our billing portal (Subscribe / Qloudi Pro). Cancel or change there; you keep access to historical records you exported or that remain in your workspace. Plan changes for list tiers that are not yet billed automatically are handled by contacting support.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Start immediately with a 30-day free trial. No credit card is required to create an account and explore core quotation and invoice workflows.",
  },
  {
    question: "Are seat and document limits enforced today?",
    answer:
      "The numbers on the price cards are our published commercial terms. Automated cut-off is not live yet — we will give advance notice before enforcement begins so you are never surprised mid-month.",
  },
];

export default async function PricingPage() {
  const session = await auth();

  return (
    <main className="pricing-page">
      <MarketingShell
        active="pricing"
        sessionHref={session ? "/start" : "/signin"}
        sessionLabel={session ? "Open workspace" : "Sign in"}
      >
        <header className="pricing-header">
          <span className="eyebrow">Predictable, transparent plans</span>
          <h1>Simple pricing tailored to your market</h1>
          <p>
            Pay per business, not per seat. Start free for 30 days and scale as your transaction
            volume grows.
          </p>
        </header>

        <section className="pricing-section">
          <PricingTable />
        </section>

        <section className="services-section">
          <div className="section-header">
            <h2>Onboarding & Training Services</h2>
            <p>
              Need help migrating from spreadsheets or training your team? Remote onboarding
              packages are available — email us from the contact page to schedule.
            </p>
          </div>

          <div className="services-grid">
            {SERVICES.map((srv) => (
              <div key={srv.title} className="service-card">
                <div className="service-header">
                  <h3>{srv.title}</h3>
                  <span className="service-price">{srv.price}</span>
                </div>
                <p className="service-scope">{srv.scope}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="faq-section">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know about bizOS pricing, billing, and compliance.</p>
          </div>

          <div className="faq-grid">
            {FAQS.map((faq) => (
              <div key={faq.question} className="faq-card">
                <h3>
                  <HelpCircle size={18} className="faq-icon" aria-hidden="true" />
                  <span>{faq.question}</span>
                </h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pricing-cta">
          <h2>Ready to simplify your business operations?</h2>
          <p>Start a free trial and send your first quotation today.</p>
          <div className="pricing-cta-actions">
            <Link className="button button-primary" href={session ? "/start" : "/signup"}>
              {session ? "Continue to workspace" : "Start your free 30-day trial"}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="button button-quiet" href="/subscribe">
              Subscribe (Qloudi Pro)
            </Link>
          </div>
        </section>
      </MarketingShell>
    </main>
  );
}

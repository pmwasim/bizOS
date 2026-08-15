import { ArrowRight, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { PricingTable } from "@/components/pricing-table";

export const metadata: Metadata = {
  title: "Pricing & Plans · bizOS",
  description:
    "Transparent, per-business pricing for small businesses, contractors, and service companies in Saudi Arabia, UAE, and India. Start with a 30-day free trial.",
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
      "We charge primarily per business entity, with generous team member allowances included in each tier. This matches real small businesses where several collaborators need visibility without unpredictable per-seat surcharges.",
  },
  {
    question: "Are country compliance features and ZATCA Phase 2 included?",
    answer:
      "Yes. Mandatory country compliance packs (such as ZATCA e-invoicing in Saudi Arabia and GST in India) are built directly into standard and growth plans. We never hold legally required compliance or audit trails behind expensive enterprise paywalls.",
  },
  {
    question: "Can I switch plans or cancel anytime?",
    answer:
      "Yes. You can upgrade, downgrade, or cancel your subscription at any time. If you cancel, you retain full read-only and export access to all your historical business records.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! You can start immediately with our 30-day Free Trial. No credit card or payment method is required to explore all core capabilities.",
  },
];

export default async function PricingPage() {
  const session = await auth();

  return (
    <main className="pricing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="brand" href="/">
          bizOS
        </Link>
        <div className="nav-links">
          <Link className="nav-link active" href="/pricing">
            Pricing
          </Link>
          <Link className="button button-quiet" href={session ? "/start" : "/signin"}>
            {session ? "Open workspace" : "Sign in"}
          </Link>
        </div>
      </nav>

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
            Need assistance migrating from legacy spreadsheets or training your team? Our certified
            specialists are available for remote onboarding.
          </p>
        </div>

        <div className="services-grid">
          {SERVICES.map((srv, idx) => (
            <div key={idx} className="service-card">
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
          {FAQS.map((faq, idx) => (
            <div key={idx} className="faq-card">
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
        <p>Join hundreds of businesses running clean, auditable quotations and invoices.</p>
        <Link className="button button-primary" href={session ? "/start" : "/signup"}>
          {session ? "Continue to workspace" : "Start your free 30-day trial"}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </section>
    </main>
  );
}

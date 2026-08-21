import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { auth } from "@/auth";
import { MarketingShell } from "@/components/marketing-shell";
import { SITE_URL } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Product",
  description:
    "How bizOS works: a guided Business Operating System on a real ERP foundation for service companies in Saudi Arabia, the UAE, and India.",
  alternates: { canonical: `${SITE_URL}/product` },
  openGraph: {
    title: "Product · bizOS",
    description:
      "Plain-language offers, invoices, payments, and statements — with ERPNext as the ledger underneath.",
    url: `${SITE_URL}/product`,
    siteName: "bizOS",
    type: "website",
  },
};

const SURFACES = [
  {
    name: "Today",
    copy: "Assigned actions, exceptions, due work, and recent outcomes — so you open the day knowing what matters.",
  },
  {
    name: "Work",
    copy: "Offers, orders, approvals, invoices, payments, and statements in one place, ordered by the job — not by module acronyms.",
  },
  {
    name: "Contacts",
    copy: "Customers, suppliers, and the people behind them, scoped to the business you are operating right now.",
  },
  {
    name: "Reports",
    copy: "Operational and financial views phrased as questions your team can answer without a finance degree.",
  },
  {
    name: "Automations",
    copy: "Visible rules and recent outcomes — so automation never becomes a black box.",
  },
  {
    name: "Settings",
    copy: "Business identity, team, numbering, currencies, tax, integrations, and modules — revealed when you earn the complexity.",
  },
] as const;

const FOUNDATION = [
  {
    title: "Proper ERP by default",
    body: "ERPNext remains authoritative for records, permissions, audit, and accounting controls. bizOS does not rebuild what the foundation already does safely.",
  },
  {
    title: "Guided experience on top",
    body: "You buy a configurable, branded workspace that uses ordinary business language and only reveals ERP depth when it helps.",
  },
  {
    title: "Hybrid onboarding",
    body: "Self-serve registration and guided setup, or request assisted setup for pack selection, migration, or training — same configuration model either way.",
  },
  {
    title: "Progressive capability",
    body: "Start with one business, one currency, a simple tax choice, and a small role set. Advanced rules appear after explicit enablement.",
  },
] as const;

export default async function ProductPage() {
  const session = await auth();
  const ctaHref = session ? "/start" : "/signup";
  const ctaLabel = session ? "Continue to bizOS" : "Start free — 30 days";

  return (
    <main>
      <MarketingShell
        active="product"
        sessionHref={session ? "/start" : "/signin"}
        sessionLabel={session ? "Open workspace" : "Sign in"}
      >
        <section className="mkt-hero mkt-hero-compact" aria-labelledby="product-brand">
          <div className="mkt-hero-atmosphere" aria-hidden="true">
            <div className="mkt-hero-grid" />
            <div className="mkt-hero-wash" />
          </div>
          <div className="mkt-hero-copy">
            <p className="mkt-hero-brand" id="product-brand">
              bizOS
            </p>
            <h1 className="mkt-hero-title">The product customers actually buy.</h1>
            <p className="mkt-hero-lede">
              Not another spreadsheet stack. Not a raw ERP console. A Business Operating System that
              speaks like your team — while the ledger underneath stays formal, auditable, and
              upgradeable.
            </p>
            <div className="mkt-hero-actions">
              <Link className="mkt-btn mkt-btn-primary" href={ctaHref}>
                {ctaLabel}
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link className="mkt-btn mkt-btn-ghost" href="/pricing">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-journey" aria-labelledby="foundation-title">
          <div className="mkt-section-inner">
            <p className="mkt-kicker">Foundation</p>
            <h2 id="foundation-title">ERP depth without ERP homework.</h2>
            <p className="mkt-section-lede">
              During registration, a business can start on the default bizOS experience pack or
              standard ERPNext mode. Membership, roles, and data stay separate for every business.
            </p>
            <ul className="mkt-cap-list">
              {FOUNDATION.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mkt-section" aria-labelledby="surfaces-title">
          <div className="mkt-section-inner">
            <p className="mkt-kicker">Workspace</p>
            <h2 id="surfaces-title">Navigation describes work, not modules.</h2>
            <p className="mkt-section-lede">
              Desktop keeps a compact side navigation. Mobile stays task-first. The selected
              business is always visible — switching it is deliberate.
            </p>
            <ol className="mkt-journey-list">
              {SURFACES.map((surface, index) => (
                <li key={surface.name} className="mkt-journey-step">
                  <span className="mkt-journey-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{surface.name}</h3>
                    <p>{surface.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mkt-section mkt-promise" aria-labelledby="product-cta-title">
          <div className="mkt-section-inner mkt-promise-panel">
            <p className="mkt-kicker">Ready when you are</p>
            <h2 id="product-cta-title">Thirty days free. No card to explore the core path.</h2>
            <p>
              Create customers, send offers, issue invoices, record payments, and read statements —
              then decide if assisted setup or a paid plan is worth it.
            </p>
            <div className="mkt-hero-actions">
              <Link className="mkt-btn mkt-btn-primary" href={ctaHref}>
                {ctaLabel}
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link className="mkt-btn mkt-btn-ghost" href="/">
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </MarketingShell>
    </main>
  );
}

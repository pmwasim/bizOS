import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Globe,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { SITE_URL } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "bizOS — Quotations and invoices for service businesses",
  description:
    "Create customers, send polished quotations, and turn them into invoices. Free 30-day trial for service businesses in Saudi Arabia, the UAE, and India.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "bizOS — Quotations and invoices for service businesses",
    description:
      "From new customer to sent invoice in minutes. Free 30-day trial — no card required.",
    url: SITE_URL,
    siteName: "bizOS",
    type: "website",
  },
};

export default async function Home() {
  const session = await auth();

  return (
    <div className="landing-wrapper">
      <MarketingNav />

      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-badge">
              <Sparkles size={15} aria-hidden="true" />
              <span>Commercial Revenue Platform · Quotations, Invoices & Payments</span>
            </div>
            <h1>From new customer to sent invoice in minutes.</h1>
            <p>
              bizOS gives service businesses, agencies, and contractors one calm place to create
              customers, prepare polished quotations, record PO approvals, convert to invoices, and
              track payments — without ERP complexity.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-primary button-lg"
                href={session ? "/start" : "/signup"}
              >
                {session ? "Open your workspace" : "Start free — 30 days"}
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link className="button button-secondary button-lg" href="/pricing">
                View pricing plans
              </Link>
            </div>
            <ul className="hero-proof" aria-label="Key features">
              <li>
                <Check aria-hidden="true" size={16} /> Professional PDFs
              </li>
              <li>
                <Check aria-hidden="true" size={16} /> Saudi VAT, UAE VAT & GST ready
              </li>
              <li>
                <Check aria-hidden="true" size={16} /> No credit card required
              </li>
            </ul>
          </div>

          <div className="quote-demo" aria-label="Example quotation preview">
            <div className="demo-top">
              <div>
                <span className="demo-logo">NORTHSTAR CREATIVE</span>
                <span className="demo-sub">RIYADH · DUBAI</span>
              </div>
              <div className="demo-status-badge">
                <span className="status status-sent">Sent & Approved</span>
              </div>
            </div>
            <div className="demo-meta">
              <span>Prepared for</span>
              <strong>Acme Studio & Co.</strong>
              <span>Ref: Q-2026-0042 · Valid for 30 days</span>
            </div>
            <div className="demo-lines-container">
              <div className="demo-line">
                <div>
                  <strong>Brand Strategy & Visual Identity</strong>
                  <small>Discovery workshops, guidelines & asset kit</small>
                </div>
                <strong>SAR 12,000.00</strong>
              </div>
              <div className="demo-line">
                <div>
                  <strong>Next.js Web Portal Development</strong>
                  <small>Design system implementation & API integration</small>
                </div>
                <strong>SAR 18,500.00</strong>
              </div>
            </div>
            <div className="demo-calc">
              <div className="demo-calc-row">
                <span>Subtotal</span>
                <span>SAR 30,500.00</span>
              </div>
              <div className="demo-calc-row">
                <span>VAT (15%)</span>
                <span>SAR 4,575.00</span>
              </div>
            </div>
            <div className="demo-total">
              <span>Total Amount</span>
              <strong>SAR 35,075.00</strong>
            </div>
          </div>
        </section>

        {/* WORKFLOW TIMELINE SECTION */}
        <section id="workflow" className="marketing-section section-alt">
          <div className="section-container">
            <div className="section-header-center">
              <span className="eyebrow">Seamless Business Flow</span>
              <h2>How bizOS accelerates your revenue cycle</h2>
              <p>
                From initial client proposal to paid invoice, eliminate manual spreadsheets and
                double data entry.
              </p>
            </div>

            <div className="workflow-grid">
              <div className="workflow-card">
                <div className="workflow-step-num">1</div>
                <div className="workflow-icon-box">
                  <Users size={24} />
                </div>
                <h3>1. Add Customer & Quote</h3>
                <p>
                  Store client contact and tax details. Build customized quotations with automated
                  tax calculations and multi-currency formatting.
                </p>
              </div>

              <div className="workflow-card">
                <div className="workflow-step-num">2</div>
                <div className="workflow-icon-box">
                  <Receipt size={24} />
                </div>
                <h3>2. Record PO & Approval</h3>
                <p>
                  Attach client purchase order numbers and upload sign-off documents directly for
                  clear audit trails before billing.
                </p>
              </div>

              <div className="workflow-card">
                <div className="workflow-step-num">3</div>
                <div className="workflow-icon-box">
                  <FileText size={24} />
                </div>
                <h3>3. 1-Click Invoice</h3>
                <p>
                  Convert approved quotations straight into formal tax invoices. Send formatted PDF
                  copies directly to client inboxes.
                </p>
              </div>

              <div className="workflow-card">
                <div className="workflow-step-num">4</div>
                <div className="workflow-icon-box">
                  <Wallet size={24} />
                </div>
                <h3>4. Record & Track Payment</h3>
                <p>
                  Log inbound bank transfers, allocate amounts to open invoices, and monitor
                  outstanding balances in real-time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES GRID */}
        <section id="features" className="marketing-section">
          <div className="section-container">
            <div className="section-header-center">
              <span className="eyebrow">Enterprise-Grade Simplicity</span>
              <h2>Everything your service business needs</h2>
              <p>
                Designed for consultants, creative agencies, IT services, and field contractors.
              </p>
            </div>

            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <FileSpreadsheet size={22} />
                </div>
                <h3>Exact Decimal Calculations</h3>
                <p>
                  Zero floating point rounding errors. Integer minor units ensure every quotation
                  and tax invoice matches banking standards exactly.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <Globe size={22} />
                </div>
                <h3>Regional Tax & Currencies</h3>
                <p>
                  Built for Saudi Arabia (ZATCA 15% VAT), UAE (5% VAT), India (18% GST), UK (20%
                  VAT), and USD markets with localized numbering.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <FileCheck size={22} />
                </div>
                <h3>Purchase Order Verification</h3>
                <p>
                  Prevent unauthorized billing. Ensure invoices are only generated when required
                  customer PO approvals and attachments are logged.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <Wallet size={22} />
                </div>
                <h3>Payment Allocations</h3>
                <p>
                  Track partial payments, advance deposits, and multi-invoice allocations with clean
                  reconciliation and receipt references.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <Sparkles size={22} />
                </div>
                <h3>Guided ERP Customization</h3>
                <p>
                  Choose between the streamlined Default bizOS ERP or run our 2-minute wizard to
                  tailor modules and stages to your industry.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <ShieldCheck size={22} />
                </div>
                <h3>Tenant Isolation & Security</h3>
                <p>
                  Complete organizational separation, granular Casbin authorization policies, and
                  immutable audit logging for total peace of mind.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* REGIONAL COMPLIANCE HIGHLIGHT */}
        <section className="marketing-section section-alt">
          <div className="section-container">
            <div className="compliance-banner">
              <div className="compliance-content">
                <span className="eyebrow">Local Tax Compliant</span>
                <h2>Built for the Middle East, South Asia & Global Markets</h2>
                <p>
                  Whether you operate in Riyadh, Dubai, Mumbai, London, or remotely, bizOS provides
                  the exact tax rates, timezones, and currency scales required for your local
                  compliance.
                </p>
                <div className="compliance-tags">
                  <div className="tag-item">
                    <CheckCircle2 size={16} /> Saudi Arabia (ZATCA VAT 15%)
                  </div>
                  <div className="tag-item">
                    <CheckCircle2 size={16} /> UAE (FTA VAT 5%)
                  </div>
                  <div className="tag-item">
                    <CheckCircle2 size={16} /> India (GST 18%)
                  </div>
                  <div className="tag-item">
                    <CheckCircle2 size={16} /> UK & Europe (VAT 20%)
                  </div>
                  <div className="tag-item">
                    <CheckCircle2 size={16} /> United States & Global (USD)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="marketing-section">
          <div className="section-container">
            <div className="cta-box">
              <h2>Start sending better quotations today.</h2>
              <p>
                Set up your business in under 60 seconds. Free 30-day trial with full feature
                access.
              </p>
              <div className="cta-actions">
                <Link
                  className="button button-primary button-lg"
                  href={session ? "/start" : "/signup"}
                >
                  {session ? "Go to your workspace" : "Get started free — 30 days"}
                  <ArrowRight aria-hidden="true" size={18} />
                </Link>
                <Link className="button button-secondary button-lg" href="/contact">
                  Talk to our team
                </Link>
              </div>
              <small className="cta-note">
                No credit card required · Cancel anytime · Instant activation
              </small>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

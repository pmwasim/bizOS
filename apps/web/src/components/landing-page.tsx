import { ArrowRight } from "lucide-react";
import Link from "next/link";

const JOURNEY = [
  { label: "Offer", detail: "Send a clear price the customer can accept" },
  { label: "Order", detail: "Turn acceptance into work you can deliver" },
  { label: "Invoice", detail: "Issue a compliant invoice from finished work" },
  { label: "Payment", detail: "Record what came in — without chasing spreadsheets" },
  { label: "Statement", detail: "Show what is owed, in language anyone can read" },
] as const;

const PLAIN_WORDS = [
  { formal: "Quotation", plain: "Offer" },
  { formal: "Accounts receivable", plain: "Money customers owe" },
  { formal: "Accounts payable", plain: "Bills to pay" },
  { formal: "Statement of account", plain: "Account statement" },
  { formal: "Posting", plain: "Finalize" },
] as const;

const CAPABILITIES = [
  {
    title: "Customers & contacts",
    body: "Keep people, companies, and history in one place your team can search.",
  },
  {
    title: "Offers that look finished",
    body: "Create, revise, approve, and email polished PDFs — not half-written Word docs.",
  },
  {
    title: "Invoices with a paper trail",
    body: "Turn approved work into invoices your country pack can stand behind.",
  },
  {
    title: "Purchase orders",
    body: "Order from suppliers with the same calm workflow you use for customers.",
  },
  {
    title: "Payments you record",
    body: "Log received and made payments with audit evidence. Online collection stays later.",
  },
  {
    title: "Statements & ledger truth",
    body: "See balances in plain language, with the ERP ledger available when you need it.",
  },
] as const;

const MARKETS = [
  {
    region: "Saudi Arabia",
    note: "English by default, shared Modern Standard Arabic UI, tax-aware documents.",
  },
  {
    region: "United Arab Emirates",
    note: "Same Arabic interface as Saudi Arabia — not a dialect fork — plus local tax labels.",
  },
  {
    region: "India",
    note: "English launch with Unicode-safe names, addresses, and money formatting.",
  },
] as const;

export function LandingPage({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <>
      <section className="mkt-hero" aria-labelledby="mkt-hero-brand">
        <div className="mkt-hero-atmosphere" aria-hidden="true">
          <div className="mkt-hero-grid" />
          <div className="mkt-hero-wash" />
          <div className="mkt-hero-ribbon">
            <span>Offer</span>
            <span className="mkt-hero-ribbon-rule" />
            <span>Order</span>
            <span className="mkt-hero-ribbon-rule" />
            <span>Invoice</span>
            <span className="mkt-hero-ribbon-rule" />
            <span>Paid</span>
          </div>
        </div>
        <div className="mkt-hero-copy">
          <p className="mkt-hero-brand" id="mkt-hero-brand">
            bizOS
          </p>
          <h1 className="mkt-hero-title">Run the business in plain language.</h1>
          <p className="mkt-hero-lede">
            A Business Operating System for service companies — from first offer to paid invoice —
            with a proper ERP underneath and none of the jargon in the way.
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

      <section className="mkt-section mkt-journey" aria-labelledby="mkt-journey-title">
        <div className="mkt-section-inner">
          <p className="mkt-kicker">The proof journey</p>
          <h2 id="mkt-journey-title">
            One path from “here is our price” to “here is what you owe.”
          </h2>
          <p className="mkt-section-lede">
            bizOS is built around the work small service businesses already do — not around ERP
            module names.
          </p>
          <ol className="mkt-journey-list">
            {JOURNEY.map((step, index) => (
              <li key={step.label} className="mkt-journey-step">
                <span className="mkt-journey-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.label}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-section mkt-words" aria-labelledby="mkt-words-title">
        <div className="mkt-section-inner mkt-words-grid">
          <div>
            <p className="mkt-kicker">Business language first</p>
            <h2 id="mkt-words-title">
              Say what you mean. Keep the formal terms for when they matter.
            </h2>
            <p className="mkt-section-lede">
              The workspace uses the words your team already speaks. Accounting labels stay
              available in help, exports, and country documents — not as the default UI.
            </p>
          </div>
          <dl className="mkt-glossary">
            {PLAIN_WORDS.map((row) => (
              <div key={row.formal} className="mkt-glossary-row">
                <dt>{row.formal}</dt>
                <dd>{row.plain}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mkt-section mkt-capabilities" aria-labelledby="mkt-cap-title">
        <div className="mkt-section-inner">
          <p className="mkt-kicker">What you can do</p>
          <h2 id="mkt-cap-title">
            Everything you need to get paid — without learning an ERP first.
          </h2>
          <ul className="mkt-cap-list">
            {CAPABILITIES.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-section mkt-markets" aria-labelledby="mkt-markets-title">
        <div className="mkt-section-inner">
          <p className="mkt-kicker">Launch markets</p>
          <h2 id="mkt-markets-title">Designed for how you actually work in the region.</h2>
          <p className="mkt-section-lede">
            Country packs own tax terminology and document labels. One shared Arabic interface for
            Saudi Arabia and the UAE — India launches in English.
          </p>
          <ul className="mkt-market-list">
            {MARKETS.map((market) => (
              <li key={market.region}>
                <h3>{market.region}</h3>
                <p>{market.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-section mkt-promise" aria-labelledby="mkt-promise-title">
        <div className="mkt-section-inner mkt-promise-panel">
          <p className="mkt-kicker">Start today</p>
          <h2 id="mkt-promise-title">Create a business and begin working immediately.</h2>
          <p>
            Self-serve signup, a free 30-day trial, and optional assisted setup when you want help
            with packs, migration, or training. Customization is optional — never a prerequisite.
          </p>
          <div className="mkt-hero-actions">
            <Link className="mkt-btn mkt-btn-primary" href={ctaHref}>
              {ctaLabel}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="mkt-btn mkt-btn-ghost" href="/contact">
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

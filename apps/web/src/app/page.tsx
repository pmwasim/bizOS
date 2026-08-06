import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <main>
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="brand" href="/">
          bizOS
        </Link>
        <Link className="button button-quiet" href={session ? "/start" : "/signin"}>
          {session ? "Open workspace" : "Sign in"}
        </Link>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            Private beta · Quotation to invoice, without the paperwork
          </span>
          <h1>From new customer to sent invoice in minutes.</h1>
          <p>
            bizOS gives service businesses one calm place to create customers, prepare polished
            quotations, record approvals, and turn them into invoices they can send.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={session ? "/start" : "/signup"}>
              {session ? "Continue to bizOS" : "Join the private beta"}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <ul className="hero-proof" aria-label="Included">
            <li>
              <Check aria-hidden="true" size={16} /> Quotations and invoices
            </li>
            <li>
              <Check aria-hidden="true" size={16} /> Professional PDF
            </li>
            <li>
              <Check aria-hidden="true" size={16} /> Ready to email
            </li>
          </ul>
        </div>
        <div className="quote-demo" aria-label="Example quotation preview">
          <div className="demo-top">
            <span className="demo-logo">NORTHSTAR</span>
            <strong>QUOTATION</strong>
          </div>
          <div className="demo-meta">
            <span>Prepared for</span>
            <strong>Acme Studio</strong>
            <span>Q-0024 · Valid 30 days</span>
          </div>
          <div className="demo-line">
            <span>Brand strategy workshop</span>
            <strong>SAR 4,500.00</strong>
          </div>
          <div className="demo-line">
            <span>Visual identity system</span>
            <strong>SAR 8,000.00</strong>
          </div>
          <div className="demo-total">
            <span>Total</span>
            <strong>SAR 14,375.00</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

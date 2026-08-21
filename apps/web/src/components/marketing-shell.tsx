import Link from "next/link";
import type { ReactNode } from "react";

import { marketingFontClassName } from "@/lib/marketing-fonts";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/marketing";

type NavKey = "home" | "product" | "pricing" | "subscribe" | "contact" | "none";

export function MarketingShell({
  children,
  active = "none",
  sessionHref,
  sessionLabel,
}: {
  children?: ReactNode;
  active?: NavKey;
  sessionHref: string;
  sessionLabel: string;
}) {
  return (
    <div className={`marketing-site ${marketingFontClassName}`}>
      <nav className="mkt-nav" aria-label="Main navigation">
        <Link className="mkt-nav-brand" href="/">
          bizOS
        </Link>
        <div className="mkt-nav-links">
          <Link
            className={`mkt-nav-link${active === "product" ? " is-active" : ""}`}
            href="/product"
          >
            Product
          </Link>
          <Link
            className={`mkt-nav-link${active === "pricing" ? " is-active" : ""}`}
            href="/pricing"
          >
            Pricing
          </Link>
          <Link
            className={`mkt-nav-link${active === "subscribe" ? " is-active" : ""}`}
            href="/subscribe"
          >
            Subscribe
          </Link>
          <Link
            className={`mkt-nav-link${active === "contact" ? " is-active" : ""}`}
            href="/contact"
          >
            Contact
          </Link>
          <Link className="mkt-nav-session" href={sessionHref}>
            {sessionLabel}
          </Link>
        </div>
      </nav>
      {children}
      <footer className="mkt-footer">
        <div className="mkt-footer-inner">
          <div className="mkt-footer-top">
            <p className="mkt-footer-brand">bizOS</p>
            <p className="mkt-footer-tag">
              The Business Operating System for service companies — offers, invoices, payments, and
              ledgers in plain language. Built for Saudi Arabia, the UAE, and India.
            </p>
          </div>
          <div className="mkt-footer-links">
            <Link href="/product">Product</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/subscribe">Subscribe</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

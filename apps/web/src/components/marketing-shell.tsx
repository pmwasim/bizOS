import Link from "next/link";
import type { ReactNode } from "react";

import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/marketing";

type NavKey = "home" | "pricing" | "subscribe" | "contact" | "none";

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
    <>
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="brand" href="/">
          bizOS
        </Link>
        <div className="nav-links">
          <Link className={`nav-link${active === "pricing" ? " active" : ""}`} href="/pricing">
            Pricing
          </Link>
          <Link className={`nav-link${active === "subscribe" ? " active" : ""}`} href="/subscribe">
            Subscribe
          </Link>
          <Link className={`nav-link${active === "contact" ? " active" : ""}`} href="/contact">
            Contact
          </Link>
          <Link className="button button-quiet" href={sessionHref}>
            {sessionLabel}
          </Link>
        </div>
      </nav>
      {children}
      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <p className="marketing-footer-brand">bizOS</p>
          <p className="marketing-footer-tag">
            Quotations, invoices, and ledgers for service businesses in Saudi Arabia, the UAE, and
            India.
          </p>
          <div className="marketing-footer-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/subscribe">Subscribe</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </footer>
    </>
  );
}

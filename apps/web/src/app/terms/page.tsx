import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { MarketingShell } from "@/components/marketing-shell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using bizOS, including trials, paid plans, and acceptable use.",
};

export default async function TermsPage() {
  const session = await auth();

  return (
    <main className="legal-page">
      <MarketingShell
        sessionHref={session ? "/start" : "/signin"}
        sessionLabel={session ? "Open workspace" : "Sign in"}
      >
        <article className="legal-article">
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: 21 August 2026</p>
          <p>
            These terms govern use of bizOS at <Link href="/">bizos.qloudihub.com</Link>. By
            creating an account or using the service you agree to them.
          </p>

          <h2>The service</h2>
          <p>
            bizOS helps service businesses create customers, quotations, invoices, and related
            financial records. Features marked <strong>beta</strong> on the{" "}
            <Link href="/pricing">pricing page</Link> are usable but may change, and you should not
            rely on them alone for decisions you cannot re-check from source documents.
          </p>

          <h2>Accounts and trials</h2>
          <ul>
            <li>
              You must provide accurate account information and keep credentials confidential.
            </li>
            <li>
              New accounts may use a free trial as described on the pricing page. We may end or
              change trial terms with notice on the site.
            </li>
            <li>
              You are responsible for activity under your account and businesses you administer.
            </li>
          </ul>

          <h2>Paid plans</h2>
          <p>
            List prices on the pricing page are per business. Subscriptions purchased through our
            billing partners (including RevenueCat) are also subject to that partner’s terms. Seat
            and document allowances shown on pricing are published commercial terms; automated
            enforcement may lag publication — we will give advance notice before cutting access for
            overage.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Do not misuse the service, attempt unauthorized access, disrupt other customers, or use
            bizOS for unlawful activity. We may suspend accounts that violate these terms.
          </p>

          <h2>Your data</h2>
          <p>
            You own the business content you enter. You grant us a limited licence to host and
            process it to provide the service. See the <Link href="/privacy">Privacy Policy</Link>.
          </p>

          <h2>Compliance features</h2>
          <p>
            Country tax helpers (including Saudi ZATCA QR / UBL export) assist your compliance work;
            they are not a substitute for advice from a qualified tax professional or for regulator
            clearance where Phase 2 integration is required.
          </p>

          <h2>Disclaimer and liability</h2>
          <p>
            The service is provided “as is”. To the fullest extent permitted by law we disclaim
            warranties of uninterrupted availability and fitness for a particular purpose, and limit
            liability to fees you paid us for the service in the three months before a claim.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms by posting a new version on this page. Continued use after the
            update date constitutes acceptance.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> or our{" "}
            <Link href="/contact">contact page</Link>.
          </p>
        </article>
      </MarketingShell>
    </main>
  );
}

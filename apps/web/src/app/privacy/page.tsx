import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { MarketingShell } from "@/components/marketing-shell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How bizOS collects, uses, and retains business and account data.",
};

export default async function PrivacyPage() {
  const session = await auth();

  return (
    <main className="legal-page">
      <MarketingShell
        sessionHref={session ? "/start" : "/signin"}
        sessionLabel={session ? "Open workspace" : "Sign in"}
      >
        <article className="legal-article">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: 21 August 2026</p>
          <p>
            bizOS (“we”, “us”) is operated by Qloudi Hub. This policy explains what we collect when
            you use <Link href="/">bizos.qloudihub.com</Link>, why we use it, and how long we keep
            it.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>Account details you provide: name, email address, and password (stored hashed).</li>
            <li>
              Business records you create: customers, quotations, invoices, payments, and related
              documents needed to run your books.
            </li>
            <li>
              Technical logs needed to operate the service securely (IP address, timestamps, error
              diagnostics). We do not sell advertising profiles.
            </li>
            <li>
              If you subscribe through RevenueCat / our billing partner, purchase and entitlement
              identifiers needed to unlock paid features.
            </li>
          </ul>

          <h2>How we use data</h2>
          <ul>
            <li>To provide, secure, and improve the product you signed up for.</li>
            <li>
              To send transactional email (for example password resets and document delivery).
            </li>
            <li>To respond when you contact {SUPPORT_EMAIL}.</li>
          </ul>

          <h2>Processors and hosting</h2>
          <p>
            The application runs on infrastructure we control, with Cloudflare in front of the
            public site. Email delivery uses our configured SMTP provider. Paid subscriptions may be
            processed by RevenueCat and its payment partners (for example Stripe) under their own
            terms.
          </p>

          <h2>Retention</h2>
          <p>
            We keep account and business records for as long as your account is active and as
            required for legal, tax, and audit obligations after closure. You may request export or
            deletion by emailing <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>
              Update account details from your signed-in workspace where the product allows it.
            </li>
            <li>Request access, correction, or deletion of personal data via {SUPPORT_EMAIL}.</li>
            <li>
              Stop using the service and cancel a paid subscription through the billing portal when
              available.
            </li>
          </ul>

          <h2>Contact</h2>
          <p>
            Privacy questions: <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>. See also our{" "}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </article>
      </MarketingShell>
    </main>
  );
}

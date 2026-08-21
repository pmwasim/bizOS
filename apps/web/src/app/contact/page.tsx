import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { MarketingShell } from "@/components/marketing-shell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the bizOS team about trials, pricing, onboarding, or support.",
};

export default async function ContactPage() {
  const session = await auth();

  return (
    <main className="legal-page">
      <MarketingShell
        active="contact"
        sessionHref={session ? "/start" : "/signin"}
        sessionLabel={session ? "Open workspace" : "Sign in"}
      >
        <article className="legal-article">
          <h1>Contact</h1>
          <p>
            Questions about a trial, a paid plan, or onboarding? Email us and we will reply within
            one business day.
          </p>
          <p>
            <a className="button button-primary" href={SUPPORT_MAILTO}>
              Email {SUPPORT_EMAIL}
            </a>
          </p>
          <h2>What to include</h2>
          <ul>
            <li>Your business name and country (Saudi Arabia, UAE, or India)</li>
            <li>Whether you need a trial, a paid plan, or help with an existing account</li>
            <li>Any compliance need (for example ZATCA e-invoicing in Saudi Arabia)</li>
          </ul>
          <p>
            Prefer self-serve? <Link href="/signup">Create an account</Link> and start a free trial,
            or see <Link href="/pricing">pricing</Link>.
          </p>
        </article>
      </MarketingShell>
    </main>
  );
}

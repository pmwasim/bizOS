import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { MarketingShell } from "@/components/marketing-shell";
import { QloudiProSubscriptionPanel } from "@/components/qloudi-pro-subscription";
import { SITE_URL } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Subscribe to Qloudi Pro with RevenueCat Web Billing.",
  alternates: { canonical: `${SITE_URL}/subscribe` },
};

export default async function SubscribePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="subscribe-page">
        <MarketingShell
          active="subscribe"
          sessionHref="/signin?callbackUrl=/subscribe"
          sessionLabel="Sign in"
        >
          <header className="subscribe-header">
            <h1>Subscribe to Qloudi Pro</h1>
            <p>
              Sign in to purchase or manage your subscription. New here? Create a free account
              first.
            </p>
            <div className="pricing-cta-actions">
              <Link className="button button-primary" href="/signin?callbackUrl=/subscribe">
                Sign in to continue
              </Link>
              <Link className="button button-quiet" href="/signup">
                Create an account
              </Link>
            </div>
          </header>
        </MarketingShell>
      </main>
    );
  }

  return (
    <main className="subscribe-page">
      <MarketingShell active="subscribe" sessionHref="/start" sessionLabel="Open workspace">
        <header className="subscribe-header">
          <h1>Qloudi Pro</h1>
          <p>
            Unlock advanced workflows with Monthly, Yearly, or Lifetime access. Purchases sync
            through RevenueCat entitlements.
          </p>
        </header>

        <QloudiProSubscriptionPanel
          appUserId={session.user.id}
          {...(session.user.email ? { customerEmail: session.user.email } : {})}
        />
      </MarketingShell>
    </main>
  );
}

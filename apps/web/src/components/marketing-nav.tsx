import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";

export async function MarketingNav() {
  const session = await auth();

  return (
    <header className="marketing-header">
      <div className="marketing-nav-container">
        <Link className="brand" href="/" aria-label="bizOS home">
          bizOS
        </Link>
        <nav className="marketing-nav-links" aria-label="Main Navigation">
          <Link href="/#features" className="nav-link">
            Features
          </Link>
          <Link href="/#workflow" className="nav-link">
            How it works
          </Link>
          <Link href="/pricing" className="nav-link">
            Pricing
          </Link>
          <Link href="/contact" className="nav-link">
            Contact
          </Link>
        </nav>
        <div className="marketing-nav-actions">
          {session ? (
            <Link className="button button-primary" href="/start">
              Open workspace
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : (
            <>
              <Link className="button button-quiet" href="/signin">
                Sign in
              </Link>
              <Link className="button button-primary" href="/signup">
                Start free trial
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

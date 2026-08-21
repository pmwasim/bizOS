import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="marketing-footer" aria-label="Site Footer">
      <div className="marketing-footer-container">
        <div className="marketing-footer-grid">
          <div className="marketing-footer-brand">
            <Link className="brand" href="/">
              bizOS
            </Link>
            <p className="footer-tagline">
              The modern Business Operating System for service businesses, agencies, and
              contractors. From quotation to received payment with zero unnecessary complexity.
            </p>
            <div className="footer-badge">
              <span className="pulse-dot" />
              <span>Private Beta · Saudi Arabia, UAE, India & Global</span>
            </div>
          </div>

          <div className="marketing-footer-col">
            <h3>Product</h3>
            <ul>
              <li>
                <Link href="/#features">Core Features</Link>
              </li>
              <li>
                <Link href="/#workflow">How It Works</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing Plans</Link>
              </li>
              <li>
                <Link href="/subscribe">Subscription</Link>
              </li>
              <li>
                <Link href="/signup">Start Free Trial</Link>
              </li>
            </ul>
          </div>

          <div className="marketing-footer-col">
            <h3>Regional Ready</h3>
            <ul>
              <li>
                <span>Saudi Arabia (ZATCA VAT 15%)</span>
              </li>
              <li>
                <span>UAE (FTA VAT 5%)</span>
              </li>
              <li>
                <span>India (GST 18%)</span>
              </li>
              <li>
                <span>UK & US (Multi-Currency)</span>
              </li>
              <li>
                <span>Custom ERP Workflows</span>
              </li>
            </ul>
          </div>

          <div className="marketing-footer-col">
            <h3>Company & Legal</h3>
            <ul>
              <li>
                <Link href="/contact">Contact Support</Link>
              </li>
              <li>
                <Link href="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/signin">Workspace Sign In</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="marketing-footer-bottom">
          <p>© {new Date().getFullYear()} bizOS. All rights reserved.</p>
          <p className="footer-subtext">
            Built with extreme precision, strict tenant isolation, and zero hidden lock-in.
          </p>
        </div>
      </div>
    </footer>
  );
}

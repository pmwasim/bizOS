import { Compass, Home } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Page not found · bizOS" };

export default function NotFound() {
  return (
    <main className="setup-page">
      <section className="setup-panel text-center" style={{ maxWidth: "480px" }}>
        <div
          style={{
            background: "var(--surface-subtle)",
            color: "var(--primary)",
            borderRadius: "50%",
            width: "56px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <Compass size={28} aria-hidden="true" />
        </div>
        <div className="page-heading compact">
          <span className="eyebrow">404 Error</span>
          <h1>We couldn’t find that page</h1>
          <p>The link may be outdated, or the resource may have moved.</p>
        </div>
        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
          <Link href="/" className="button button-primary">
            <Home size={16} aria-hidden="true" /> Return to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}

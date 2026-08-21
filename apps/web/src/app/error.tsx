"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="setup-page">
      <section className="setup-panel text-center" style={{ maxWidth: "480px" }}>
        <div
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger)",
            borderRadius: "50%",
            width: "56px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <AlertTriangle size={28} aria-hidden="true" />
        </div>
        <div className="page-heading compact">
          <h1>Something went wrong</h1>
          <p>
            An unexpected error occurred while loading this page. Nothing you saved has been lost.
          </p>
          {error.digest ? (
            <small
              style={{ color: "var(--muted-foreground)", display: "block", marginTop: "0.5rem" }}
            >
              Error Reference: <code>{error.digest}</code>
            </small>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            marginTop: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <button type="button" className="button button-primary" onClick={reset}>
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
          <Link href="/" className="button button-secondary">
            <Home size={16} aria-hidden="true" /> Return home
          </Link>
        </div>
      </section>
    </main>
  );
}

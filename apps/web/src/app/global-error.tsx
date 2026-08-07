"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="setup-page">
          <section className="setup-panel">
            <div className="page-heading compact">
              <h1>Application Error</h1>
              <p>An unhandled error occurred. Please try reloading the page.</p>
            </div>
            <button type="button" onClick={() => reset()}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

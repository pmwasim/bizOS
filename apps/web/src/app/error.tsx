"use client";

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="setup-page">
      <section className="setup-panel">
        <div className="page-heading compact">
          <h1>Something went wrong</h1>
          <p>This page didn’t load. Nothing you saved has been lost.</p>
        </div>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}

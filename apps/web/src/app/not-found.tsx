import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="setup-page">
      <section className="setup-panel">
        <div className="page-heading compact">
          <h1>We couldn’t find that page</h1>
          <p>The link may be out of date, or the page may have moved.</p>
        </div>
        <Link href="/">Go to your workspace</Link>
      </section>
    </main>
  );
}

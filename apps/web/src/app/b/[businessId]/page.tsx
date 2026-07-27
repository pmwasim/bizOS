import { ArrowRight, FileText, Users } from "lucide-react";
import Link from "next/link";

import { type Customer } from "@bizo/contracts/customers";
import { type Quotation } from "@bizo/contracts/quotations";

import { apiJson } from "@/lib/api";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [customers, quotations] = await Promise.all([
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<Quotation[]>(`/businesses/${businessId}/quotations`),
  ]);
  const firstStep = customers.length === 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Workspace</span>
          <h1>{firstStep ? "Let’s send your first quotation" : "Good to see you"}</h1>
          <p>
            {firstStep
              ? "Start with the customer you’re preparing it for."
              : "Everything you need is one click away."}
          </p>
        </div>
        <Link
          className="button button-primary"
          href={`/b/${businessId}/${firstStep ? "customers/new" : "quotations/new"}`}
        >
          {firstStep ? "Add your first customer" : "New quotation"}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </header>

      <section className="stats" aria-label="Workspace summary">
        <Link href={`/b/${businessId}/customers`}>
          <Users aria-hidden="true" />
          <span>Customers</span>
          <strong>{customers.length}</strong>
        </Link>
        <Link href={`/b/${businessId}/quotations`}>
          <FileText aria-hidden="true" />
          <span>Quotations</span>
          <strong>{quotations.length}</strong>
        </Link>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <h2>Recent quotations</h2>
          {quotations.length ? <Link href={`/b/${businessId}/quotations`}>View all</Link> : null}
        </div>
        {quotations.length ? (
          <div className="data-list">
            {quotations.slice(0, 5).map((quotation) => (
              <Link
                key={quotation.id}
                href={`/b/${businessId}/quotations/${quotation.id}`}
                className="data-row"
              >
                <span>
                  <strong>{quotation.number}</strong>
                  <small>{quotation.customer.name}</small>
                </span>
                <span className={`status status-${quotation.status.toLowerCase()}`}>
                  {quotation.status === "SENT" ? "Sent" : "Draft"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FileText aria-hidden="true" size={28} />
            <h3>No quotations yet</h3>
            <p>Your first one is only a few steps away.</p>
          </div>
        )}
      </section>
    </div>
  );
}

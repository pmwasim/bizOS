import {
  ArrowRight,
  FilePlus,
  FileText,
  Plus,
  ScrollText,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { type Customer } from "@bizo/contracts/customers";
import { type Invoice, invoiceStatusLabel } from "@bizo/contracts/invoices";
import { type Payment } from "@bizo/contracts/payments";
import { type Quotation } from "@bizo/contracts/quotations";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [customers, quotations, invoices, payments] = await Promise.all([
    apiJson<Customer[]>(`/businesses/${businessId}/customers`).catch(() => [] as Customer[]),
    apiJson<Quotation[]>(`/businesses/${businessId}/quotations`).catch(() => [] as Quotation[]),
    apiJson<Invoice[]>(`/businesses/${businessId}/invoices`).catch(() => [] as Invoice[]),
    apiJson<Payment[]>(`/businesses/${businessId}/payments`).catch(() => [] as Payment[]),
  ]);

  const isBrandNew = customers.length === 0 && quotations.length === 0;

  const totalPaidMinor = payments
    .filter((p) => p.type === "INBOUND" && p.status === "COMPLETED")
    .reduce((acc, p) => acc + BigInt(p.amountMinor), 0n);

  const currencyCode = quotations[0]?.currencyCode ?? invoices[0]?.currencyCode ?? "SAR";
  const currencyScale = quotations[0]?.currencyScale ?? invoices[0]?.currencyScale ?? 2;

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Workspace Overview</span>
          <h1>{isBrandNew ? "Welcome to your new workspace" : "Operational Dashboard"}</h1>
          <p>
            {isBrandNew
              ? "Follow the quick start guide below to prepare your first commercial quotation."
              : "Track quotations, billable milestones, and received payments in real-time."}
          </p>
        </div>
        <div className="header-actions">
          <Link
            className="button button-primary"
            href={`/b/${businessId}/${customers.length === 0 ? "customers/new" : "quotations/new"}`}
          >
            {customers.length === 0 ? (
              <>
                <UserPlus aria-hidden="true" size={18} /> Add first customer
              </>
            ) : (
              <>
                <Plus aria-hidden="true" size={18} /> New quotation
              </>
            )}
          </Link>
        </div>
      </header>

      {/* QUICK ACTIONS ROW */}
      <section className="quick-actions-bar" aria-label="Quick Actions">
        <Link className="quick-action-pill" href={`/b/${businessId}/quotations/new`}>
          <FilePlus size={16} />
          <span>Create Quote</span>
        </Link>
        <Link className="quick-action-pill" href={`/b/${businessId}/customers/new`}>
          <UserPlus size={16} />
          <span>Add Customer</span>
        </Link>
        <Link className="quick-action-pill" href={`/b/${businessId}/payments/new`}>
          <Wallet size={16} />
          <span>Record Payment</span>
        </Link>
        <Link className="quick-action-pill" href={`/b/${businessId}/settings/setup`}>
          <Sparkles size={16} />
          <span>Customize Workflow</span>
        </Link>
      </section>

      {/* METRICS SUMMARY GRID */}
      <section className="stats dashboard-stats" aria-label="Workspace metrics">
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
        <Link href={`/b/${businessId}/invoices`}>
          <ScrollText aria-hidden="true" />
          <span>Invoices</span>
          <strong>{invoices.length}</strong>
        </Link>
        <Link href={`/b/${businessId}/payments`}>
          <Wallet aria-hidden="true" />
          <span>Total Collected</span>
          <strong className="text-success">
            {formatMoney(totalPaidMinor.toString(), currencyCode, currencyScale)}
          </strong>
        </Link>
      </section>

      {/* GETTING STARTED ONBOARDING CARD FOR NEW USERS */}
      {isBrandNew && (
        <section className="onboarding-guide-card">
          <div className="onboarding-guide-header">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h3>Get Started in 3 Simple Steps</h3>
              <p>Everything you need to issue your first professional invoice:</p>
            </div>
          </div>
          <div className="onboarding-steps-list">
            <Link className="onboarding-step-item" href={`/b/${businessId}/customers/new`}>
              <div className="step-badge">1</div>
              <div>
                <strong>Add a client or company</strong>
                <small>Store client contact info and billing address.</small>
              </div>
              <ArrowRight size={16} />
            </Link>
            <Link className="onboarding-step-item" href={`/b/${businessId}/quotations/new`}>
              <div className="step-badge">2</div>
              <div>
                <strong>Prepare & send a quotation</strong>
                <small>Select currency, tax rules, and generate clean PDFs.</small>
              </div>
              <ArrowRight size={16} />
            </Link>
            <Link className="onboarding-step-item" href={`/b/${businessId}/settings/setup`}>
              <div className="step-badge">3</div>
              <div>
                <strong>Customize your ERP setup</strong>
                <small>Run our guided questionnaire to configure stages.</small>
              </div>
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* RECENT ACTIVITY & SECTION LISTS */}
      <div className="dashboard-grid">
        {/* RECENT QUOTATIONS */}
        <section className="recent-section">
          <div className="section-heading">
            <h2>Recent Quotations</h2>
            {quotations.length > 0 ? (
              <Link className="text-link" href={`/b/${businessId}/quotations`}>
                View all ({quotations.length})
              </Link>
            ) : null}
          </div>
          {quotations.length > 0 ? (
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
                  <span className="row-date">{quotation.issueDate}</span>
                  <strong>
                    {formatMoney(
                      quotation.totalMinor,
                      quotation.currencyCode,
                      quotation.currencyScale,
                    )}
                  </strong>
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
              <p>Prepare your first client proposal.</p>
              <Link
                className="button button-primary"
                style={{ marginTop: "0.75rem" }}
                href={`/b/${businessId}/quotations/new`}
              >
                Create quote
              </Link>
            </div>
          )}
        </section>

        {/* RECENT INVOICES */}
        <section className="recent-section">
          <div className="section-heading">
            <h2>Recent Invoices</h2>
            {invoices.length > 0 ? (
              <Link className="text-link" href={`/b/${businessId}/invoices`}>
                View all ({invoices.length})
              </Link>
            ) : null}
          </div>
          {invoices.length > 0 ? (
            <div className="data-list">
              {invoices.slice(0, 5).map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/b/${businessId}/invoices/${invoice.id}`}
                  className="data-row"
                >
                  <span>
                    <strong>{invoice.number}</strong>
                    <small>{invoice.customer.name}</small>
                  </span>
                  <span className="row-date">{invoice.issueDate}</span>
                  <strong>
                    {formatMoney(invoice.totalMinor, invoice.currencyCode, invoice.currencyScale)}
                  </strong>
                  <span className={`status status-${invoice.status.toLowerCase()}`}>
                    {invoiceStatusLabel(invoice.status)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ScrollText aria-hidden="true" size={28} />
              <h3>No invoices yet</h3>
              <p>Invoices are generated directly from approved quotations.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

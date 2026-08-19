import { AlertTriangle, CheckCircle2, Download } from "lucide-react";

import { type Customer } from "@bizo/contracts/customers";
import { type CustomerStatement, type ReceivablesSummary } from "@bizo/contracts/statements";

import { apiJson } from "@/lib/api";
import { CustomerStatementPanel } from "@/components/customer-statement";
import { ReceivablesSummaryPanel } from "@/components/receivables-summary";
import { SendStatementForm } from "@/components/send-statement-form";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads one search parameter, ignoring repeated and malformed values rather than guessing. */
function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  pattern?: RegExp,
): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  if (pattern && !pattern.test(value)) return undefined;
  return value;
}

/**
 * Money customers owe.
 *
 * Everything on this page is rendered on the server from the API response. There is deliberately no
 * client-side fetch and no fallback data: if a query fails the page reports the failure, because a
 * plausible-looking substitute is worse than an outage on a surface a business uses to decide who
 * to chase (ADR-0024).
 */
export default async function StatementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { businessId } = await params;
  const query = await searchParams;

  const customerId = readParam(query, "customerId");
  const startDate = readParam(query, "startDate", DATE_ONLY);
  const endDate = readParam(query, "endDate", DATE_ONLY);
  const justSent = readParam(query, "sent") === "1";

  const statementQuery = new URLSearchParams();
  if (startDate) statementQuery.set("startDate", startDate);
  if (endDate) statementQuery.set("endDate", endDate);
  const statementSuffix = statementQuery.size ? `?${statementQuery.toString()}` : "";

  const [customers, summary, statement] = await Promise.all([
    apiJson<Customer[]>(`/businesses/${businessId}/customers`).catch(() => null),
    apiJson<ReceivablesSummary>(
      `/businesses/${businessId}/statements/receivables${endDate ? `?asOf=${endDate}` : ""}`,
    ).catch(() => null),
    customerId
      ? apiJson<CustomerStatement>(
          `/businesses/${businessId}/statements/customers/${customerId}${statementSuffix}`,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Money customers owe</h1>
          <p>
            Who owes you, how much, and how late it is — from the invoices, payments, and credit
            notes recorded in this business.
          </p>
        </div>
      </header>

      <form className="form-stack wide" method="get">
        <div className="field-grid">
          <label className="field">
            <span>Customer statement</span>
            <select name="customerId" defaultValue={customerId ?? ""}>
              <option value="">No customer selected</option>
              {(customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <input type="date" name="startDate" defaultValue={startDate ?? ""} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" name="endDate" defaultValue={endDate ?? ""} />
          </label>
        </div>
        <button className="button button-primary" type="submit">
          Show
        </button>
      </form>

      {summary ? (
        <ReceivablesSummaryPanel businessId={businessId} summary={summary} />
      ) : (
        <div className="empty-state" role="alert">
          <AlertTriangle aria-hidden="true" size={30} />
          <h2>We could not load what you are owed</h2>
          <p>
            The receivables figures are unavailable right now. Nothing is shown in their place —
            please try again in a moment.
          </p>
        </div>
      )}

      {customerId ? (
        statement ? (
          (() => {
            const pdfQuery = new URLSearchParams();
            if (startDate) pdfQuery.set("startDate", startDate);
            if (endDate) pdfQuery.set("endDate", endDate);
            const pdfBase = `/api/businesses/${businessId}/statements/customers/${customerId}/pdf`;
            const pdfSuffix = pdfQuery.size ? `?${pdfQuery.toString()}&download=1` : "?download=1";
            const selected = (customers ?? []).find((customer) => customer.id === customerId);
            return (
              <>
                {justSent ? (
                  <div className="success-banner" role="status">
                    <CheckCircle2 aria-hidden="true" />
                    <span>
                      <strong>Statement sent</strong>A PDF copy was emailed to the customer.
                    </span>
                  </div>
                ) : null}
                <div className="section-heading" style={{ gap: "0.75rem" }}>
                  <a className="button button-secondary" href={`${pdfBase}${pdfSuffix}`}>
                    <Download aria-hidden="true" size={17} /> Download PDF
                  </a>
                </div>
                <CustomerStatementPanel statement={statement} />
                <SendStatementForm
                  businessId={businessId}
                  customerId={customerId}
                  customerName={statement.customerName}
                  customerEmail={selected?.email ?? null}
                  startDate={startDate}
                  endDate={endDate}
                />
              </>
            );
          })()
        ) : (
          <div className="empty-state" role="alert">
            <AlertTriangle aria-hidden="true" size={30} />
            <h2>We could not load that statement</h2>
            <p>
              That customer&apos;s account statement is unavailable right now. Please try again in a
              moment.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}

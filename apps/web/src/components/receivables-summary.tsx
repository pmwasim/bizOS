import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { ageingBucketLabels, type ReceivablesSummary } from "@bizo/contracts/statements";

import { formatMoney } from "@/lib/display";

const BUCKET_KEYS = [
  "notDueMinor",
  "days1To30Minor",
  "days31To60Minor",
  "days61To90Minor",
  "daysOver90Minor",
] as const;

/**
 * What the business is owed, and how late it is.
 *
 * Every figure here arrives from the API already derived from issued invoices and what has been
 * applied against them. Nothing on this surface is computed from a proportion of another number,
 * and there is no fallback branch: when the summary cannot be loaded the page says so (ADR-0024).
 */
export function ReceivablesSummaryPanel({
  businessId,
  summary,
}: {
  businessId: string;
  summary: ReceivablesSummary;
}) {
  const { currency, currencyScale } = summary;
  const money = (amountMinor: number) => formatMoney(String(amountMinor), currency, currencyScale);

  if (summary.totalOutstandingMinor === 0) {
    return (
      <div className="empty-state">
        <CheckCircle2 aria-hidden="true" size={30} />
        <h2>Nothing outstanding</h2>
        <p>
          Every invoice you have sent is settled as of {summary.asOf}. Amounts are shown in{" "}
          {currency}.
        </p>
      </div>
    );
  }

  return (
    <section className="recent-section" aria-labelledby="receivables-heading">
      <div className="section-heading">
        <h2 id="receivables-heading">Money customers owe</h2>
        <small>
          {money(summary.totalOutstandingMinor)} outstanding, of which{" "}
          {money(summary.totalOverdueMinor)} is late — as of {summary.asOf}
        </small>
      </div>

      <dl className="data-list" aria-label="Ageing breakdown">
        {BUCKET_KEYS.map((key) => (
          <div className="data-row" key={key}>
            <dt className="grow">{ageingBucketLabels[key]}</dt>
            <dd>
              <strong>{money(summary.buckets[key])}</strong>
            </dd>
          </div>
        ))}
      </dl>

      <div className="data-list">
        <div className="data-row">
          <span className="grow">
            <strong>Customer</strong>
          </span>
          <span>
            <strong>Late</strong>
          </span>
          <span>
            <strong>Outstanding</strong>
          </span>
        </div>
        {summary.customers.map((customer) => (
          <div className="data-row" key={customer.customerId}>
            <span className="grow">
              <strong>{customer.customerName}</strong>
              <small>
                {customer.openInvoiceCount === 1
                  ? "1 unpaid invoice"
                  : `${customer.openInvoiceCount} unpaid invoices`}
                {customer.oldestDueDate ? `, oldest due ${customer.oldestDueDate}` : ""}
              </small>
            </span>
            <span>{customer.overdueMinor > 0 ? money(customer.overdueMinor) : "—"}</span>
            <span>
              <strong>{money(customer.outstandingMinor)}</strong>
            </span>
            <Link
              className="text-link"
              href={`/b/${businessId}/statements?customerId=${customer.customerId}`}
            >
              View statement
            </Link>
          </div>
        ))}
      </div>

      {summary.otherCurrencies.length > 0 ? (
        <p role="note">
          These totals cover {currency} only. This business also has invoices in{" "}
          {summary.otherCurrencies.join(", ")}, which are not included — bizOS does not convert
          between currencies yet.
        </p>
      ) : null}
    </section>
  );
}

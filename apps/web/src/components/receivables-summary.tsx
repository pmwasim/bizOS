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
  const money = (amountMinor: string) => formatMoney(amountMinor, currency, currencyScale);

  if (BigInt(summary.totalOutstandingMinor) === 0n) {
    // A zero base-currency total does not mean the business is owed nothing — invoices in other
    // currencies are excluded from it. Claiming "all settled" here would hide that foreign-currency
    // debt, so the exclusion warning still shows and the copy is scoped to the base currency.
    const hasExcludedCurrencies = summary.otherCurrencies.length > 0;
    return (
      <div className="empty-state">
        <CheckCircle2 aria-hidden="true" size={30} />
        <h2>
          {hasExcludedCurrencies ? `Nothing outstanding in ${currency}` : "Nothing outstanding"}
        </h2>
        <p>
          Every {currency} invoice you have sent is settled as of {summary.asOf}.
        </p>
        {hasExcludedCurrencies ? (
          <p role="note">
            This business also has invoices in {summary.otherCurrencies.join(", ")}, which are not
            included in this total — bizOS does not convert between currencies yet, so it cannot say
            whether those are settled.
          </p>
        ) : null}
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
            <span>{BigInt(customer.overdueMinor) > 0n ? money(customer.overdueMinor) : "—"}</span>
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

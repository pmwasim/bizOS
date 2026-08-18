import { CheckCircle2 } from "lucide-react";

import { ageingBucketLabels, type PayablesSummary } from "@bizo/contracts/statements";

import { formatMoney } from "@/lib/display";

const BUCKET_KEYS = [
  "notDueMinor",
  "days1To30Minor",
  "days31To60Minor",
  "days61To90Minor",
  "daysOver90Minor",
] as const;

/**
 * What the business owes its suppliers, and how late it is.
 *
 * Every figure arrives from the API already derived from approved supplier bills. There is no
 * fallback branch: when the summary cannot be loaded the page says so rather than substituting a
 * plausible number (ADR-0024, MMF-2).
 */
export function PayablesSummaryPanel({ summary }: { summary: PayablesSummary }) {
  const { currency, currencyScale } = summary;
  const money = (amountMinor: string) => formatMoney(amountMinor, currency, currencyScale);

  if (BigInt(summary.totalOutstandingMinor) === 0n) {
    return (
      <div className="empty-state">
        <CheckCircle2 aria-hidden="true" size={30} />
        <h2>Nothing outstanding</h2>
        <p>
          No approved supplier bill is unpaid as of {summary.asOf}. Amounts are shown in {currency}.
        </p>
      </div>
    );
  }

  return (
    <section className="recent-section" aria-labelledby="payables-heading">
      <div className="section-heading">
        <h2 id="payables-heading">Money you owe suppliers</h2>
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
            <strong>Supplier</strong>
          </span>
          <span>
            <strong>Late</strong>
          </span>
          <span>
            <strong>Outstanding</strong>
          </span>
        </div>
        {summary.suppliers.map((supplier) => (
          <div className="data-row" key={supplier.supplierId}>
            <span className="grow">
              <strong>{supplier.supplierName}</strong>
              <small>
                {supplier.openBillCount === 1
                  ? "1 unpaid bill"
                  : `${supplier.openBillCount} unpaid bills`}
                {supplier.oldestDueDate ? `, oldest due ${supplier.oldestDueDate}` : ""}
              </small>
            </span>
            <span>{BigInt(supplier.overdueMinor) > 0n ? money(supplier.overdueMinor) : "—"}</span>
            <span>
              <strong>{money(supplier.outstandingMinor)}</strong>
            </span>
          </div>
        ))}
      </div>

      <p role="note">
        A supplier bill counts as outstanding in full or settled in full. bizOS does not record
        supplier payments yet, so these totals do not account for part-payments you have already
        made.
      </p>

      {summary.otherCurrencies.length > 0 ? (
        <p role="note">
          These totals cover {currency} only. This business also has bills in{" "}
          {summary.otherCurrencies.join(", ")}, which are not included — bizOS does not convert
          between currencies yet.
        </p>
      ) : null}
    </section>
  );
}

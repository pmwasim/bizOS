import { type TaxCurrencySummary, type TaxReturnAudit } from "@bizo/contracts/tax";

import { formatMoney } from "@/lib/display";

/** Human copy for a currency's net position. */
const NET_POSITION_LABEL: Record<TaxCurrencySummary["netPosition"], string> = {
  PAYABLE: "payable to the authority",
  REFUNDABLE: "refundable to you",
  NIL: "nil — nothing to pay or reclaim",
};

function ratePercent(ratePpm: number): string {
  // ppm → percent, trimming a trailing ".0" so 150000 reads "15%" not "15.0%".
  return `${(ratePpm / 10_000).toFixed(1).replace(/\.0$/, "")}%`;
}

/**
 * The VAT/GST return preview.
 *
 * Every figure is derived on read from SENT invoices and APPROVED supplier bills; the net for each
 * currency is output tax minus input tax. Currencies are reported as separate blocks and never
 * blended — there is no single cross-currency total, because bizOS has no exchange-rate source
 * (ADR-0024). Nothing is fabricated: when there is no data a currency simply does not appear.
 */
export function TaxReturnPanel({ audit }: { audit: TaxReturnAudit }) {
  const { summary } = audit;

  return (
    <section className="recent-section" aria-labelledby="tax-return-heading">
      <div className="section-heading">
        <h2 id="tax-return-heading">
          {summary.countryName} {summary.returnName}
        </h2>
        <small>
          {summary.taxSystem} administered by {summary.taxAuthority} — standard rate{" "}
          {ratePercent(summary.standardRatePpm)}
          {summary.periodStart || summary.periodEnd
            ? `, period ${summary.periodStart ?? "start"} to ${summary.periodEnd ?? "latest"}`
            : ", all recorded documents"}
        </small>
      </div>

      {summary.currencies.length === 0 ? (
        <p role="note">
          No SENT invoices or APPROVED supplier bills were found for this period, so there is
          nothing to report.
        </p>
      ) : (
        summary.currencies.map((entry) => (
          <CurrencyBlock key={entry.currency} entry={entry} taxSystem={summary.taxSystem} />
        ))
      )}

      <p role="note">
        Each currency is reported on its own. bizOS does not convert between currencies, so there is
        no blended total — a return is filed per currency.
      </p>
    </section>
  );
}

function CurrencyBlock({
  entry,
  taxSystem,
}: {
  entry: TaxCurrencySummary;
  taxSystem: TaxReturnAudit["summary"]["taxSystem"];
}) {
  const money = (amountMinor: string) =>
    formatMoney(amountMinor, entry.currency, entry.currencyScale);
  const netAbsolute = entry.netTaxMinor.startsWith("-")
    ? entry.netTaxMinor.slice(1)
    : entry.netTaxMinor;

  return (
    <div className="data-list" aria-label={`${entry.currency} return`}>
      <div className="data-row">
        <span className="grow">
          <strong>
            {entry.currency}
            {entry.isBaseCurrency ? " (base currency)" : ""}
          </strong>
          <small>
            {entry.salesCount} sales, {entry.purchaseCount} purchases
          </small>
        </span>
      </div>

      {entry.boxes.map((box) => (
        <div className="data-row" key={box.code}>
          <span className="grow">
            {box.label} <small>Box {box.code}</small>
          </span>
          <span>
            <strong>{money(box.amountMinor)}</strong>
          </span>
        </div>
      ))}

      <div className="data-row">
        <span className="grow">
          <strong>Net {taxSystem}</strong>
        </span>
        <span>
          <strong>{money(netAbsolute)}</strong> {NET_POSITION_LABEL[entry.netPosition]}
        </span>
      </div>
    </div>
  );
}

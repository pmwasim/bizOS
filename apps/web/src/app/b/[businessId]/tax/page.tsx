import { AlertTriangle, Download } from "lucide-react";

import { type TaxReturnAudit } from "@bizo/contracts/tax";

import { apiJson } from "@/lib/api";
import { TaxReturnPanel } from "@/components/tax-return-summary";

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
 * Country tax summary & VAT/GST return preview (MVP Module 9).
 *
 * The whole page is rendered on the server from the API response — derived on read from SENT
 * invoices and APPROVED supplier bills, per currency, fail-closed. There is deliberately no
 * client-side fetch and no fallback data: a tax return that quietly substituted a plausible figure
 * would be worse than an outage on a surface a business files from (ADR-0024).
 */
export default async function TaxReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { businessId } = await params;
  const query = await searchParams;

  const startDate = readParam(query, "startDate", DATE_ONLY);
  const endDate = readParam(query, "endDate", DATE_ONLY);

  const period = new URLSearchParams();
  if (startDate) period.set("startDate", startDate);
  if (endDate) period.set("endDate", endDate);
  const suffix = period.size ? `?${period.toString()}` : "";

  const audit = await apiJson<TaxReturnAudit>(
    `/businesses/${businessId}/tax/return${suffix}`,
  ).catch(() => null);

  const exportBase = `/api/businesses/${businessId}/tax/return/export`;
  const exportHref = (kind: "summary" | "detail", format: "csv" | "json") =>
    `${exportBase}?${new URLSearchParams({ ...Object.fromEntries(period), kind, format }).toString()}`;
  const summaryCsvHref = exportHref("summary", "csv");
  const summaryJsonHref = exportHref("summary", "json");
  const detailCsvHref = exportHref("detail", "csv");
  const detailJsonHref = exportHref("detail", "json");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Tax return</h1>
          <p>
            Your VAT/GST position for a period — output tax on the invoices you have sent, less
            input tax on the supplier bills you have approved, netted per currency from the
            documents recorded in this business.
          </p>
        </div>
      </header>

      <form className="form-stack wide" method="get">
        <div className="field-grid">
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

      {audit ? (
        <>
          <div className="section-heading" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <a className="button button-secondary" href={summaryCsvHref}>
              <Download aria-hidden="true" size={17} /> Return summary (CSV)
            </a>
            <a className="button button-secondary" href={summaryJsonHref}>
              <Download aria-hidden="true" size={17} /> Return summary (JSON)
            </a>
            <a className="button button-secondary" href={detailCsvHref}>
              <Download aria-hidden="true" size={17} /> Audit detail (CSV)
            </a>
            <a className="button button-secondary" href={detailJsonHref}>
              <Download aria-hidden="true" size={17} /> Audit detail (JSON)
            </a>
          </div>
          <TaxReturnPanel audit={audit} />
        </>
      ) : (
        <div className="empty-state" role="alert">
          <AlertTriangle aria-hidden="true" size={30} />
          <h2>We could not load your tax return</h2>
          <p>
            The tax figures are unavailable right now. Nothing is shown in their place — please try
            again in a moment.
          </p>
        </div>
      )}
    </div>
  );
}

import {
  type TaxReturnAudit,
  type TaxReturnDocument,
  type TaxReturnSummary,
} from "@bizo/contracts/tax";

/**
 * Serialise the documents behind a return to CSV — the audit trail a preparer reconciles against.
 *
 * One row per source document, in the order the summary lists them, with the money left as the exact
 * minor-unit integers the documents carry (ADR-0008). A cell is quoted only when it needs to be, and
 * embedded quotes are doubled, so a supplier name with a comma or quote in it cannot shift columns.
 */
const HEADER = [
  "direction",
  "documentType",
  "number",
  "issueDate",
  "partyName",
  "currency",
  "currencyScale",
  "subtotalMinor",
  "taxMinor",
  "totalMinor",
] as const;

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function documentRow(document: TaxReturnDocument): string {
  return [
    document.direction,
    document.documentType,
    document.number,
    document.issueDate,
    document.partyName,
    document.currency,
    String(document.currencyScale),
    document.subtotalMinor,
    document.taxMinor,
    document.totalMinor,
  ]
    .map(csvCell)
    .join(",");
}

export function toAuditCsv(documents: readonly TaxReturnDocument[]): string {
  const lines = [HEADER.join(","), ...documents.map(documentRow)];
  // A trailing newline keeps POSIX tools (and a re-import) from treating the last row as truncated.
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Serialise the return itself — the country pack's boxes, per currency — to CSV.
 *
 * This is the return-summary export: the filing figures a preparer copies onto the authority's form,
 * as opposed to the line-level `toAuditCsv` dump behind them. It is country-specific by construction:
 * the `returnName`, box `code`, and box `label` are the SA/AE/IN pack's own labels (a ZATCA "VAT
 * Return" box "14 Net VAT due" versus a GSTN "GSTR-3B Summary" box "5.1 Net GST payable"), and the
 * amounts are the exact minor-unit integers the aggregation produced (ADR-0008) — never re-derived
 * here, so the file always reconciles to the tax service. One row per currency per box; the
 * base-currency block leads, exactly as the summary orders it, and currencies are never summed
 * across (ADR-0024).
 */
const SUMMARY_HEADER = [
  "countryCode",
  "returnName",
  "currency",
  "currencyScale",
  "isBaseCurrency",
  "boxCode",
  "boxLabel",
  "boxSource",
  "amountMinor",
  "netPosition",
] as const;

function summaryRows(summary: TaxReturnSummary): string[] {
  const rows: string[] = [];
  for (const entry of summary.currencies) {
    for (const box of entry.boxes) {
      rows.push(
        [
          summary.countryCode,
          summary.returnName,
          entry.currency,
          String(entry.currencyScale),
          String(entry.isBaseCurrency),
          box.code,
          box.label,
          box.source,
          box.amountMinor,
          entry.netPosition,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return rows;
}

export function toReturnSummaryCsv(summary: TaxReturnSummary): string {
  const lines = [SUMMARY_HEADER.join(","), ...summaryRows(summary)];
  // A trailing newline keeps POSIX tools (and a re-import) from treating the last row as truncated.
  return `${lines.join("\r\n")}\r\n`;
}

/** The `-2026-01-01_2026-03-31` period suffix a filename carries, or "" when the return is unbounded. */
function periodSuffix(summary: TaxReturnAudit["summary"]): string {
  const { periodStart, periodEnd } = summary;
  return periodStart || periodEnd ? `-${periodStart ?? "start"}_${periodEnd ?? "end"}` : "";
}

/**
 * A stable, filesystem-safe filename for a period's line-level detail export, e.g.
 * `tax-return-SA-2026-01-01_2026-03-31.csv`.
 */
export function auditExportFilename(audit: TaxReturnAudit, format: "csv" | "json"): string {
  return `tax-return-${audit.summary.countryCode}${periodSuffix(audit.summary)}.${format}`;
}

/**
 * A stable, filesystem-safe filename for a period's return-summary export, e.g.
 * `tax-return-summary-SA-2026-01-01_2026-03-31.csv`.
 */
export function returnSummaryFilename(audit: TaxReturnAudit, format: "csv" | "json"): string {
  return `tax-return-summary-${audit.summary.countryCode}${periodSuffix(audit.summary)}.${format}`;
}

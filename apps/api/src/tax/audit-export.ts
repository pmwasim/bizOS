import { type TaxReturnAudit, type TaxReturnDocument } from "@bizo/contracts/tax";

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

/** A stable, filesystem-safe filename for a period's export, e.g. `tax-return-SA-2026-01-01_2026-03-31.csv`. */
export function auditExportFilename(audit: TaxReturnAudit, format: "csv" | "json"): string {
  const { countryCode, periodStart, periodEnd } = audit.summary;
  const period = periodStart || periodEnd ? `-${periodStart ?? "start"}_${periodEnd ?? "end"}` : "";
  return `tax-return-${countryCode}${period}.${format}`;
}

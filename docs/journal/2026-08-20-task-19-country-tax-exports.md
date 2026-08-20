# TASK-19 country tax exports

Date: 2026-08-20

Agent: sprint5-task19

Scope: apps/api/src/tax, packages/contracts/src/tax.ts, apps/web .../tax

Status: Done

Related: Sprint 3 tax module (country tax summary), ADR-0008 (minor units), ADR-0024 (per-currency
fail-closed)

## Context

Sprint 3 shipped the tax module: `TaxSummaryService.taxReturn` derives a VAT/GST return on read from
SENT invoices (output tax) and APPROVED supplier bills (input tax), per currency, fail-closed, with
SA/AE/IN country packs in `packages/contracts/src/tax.ts`. `apps/api/src/tax/audit-export.ts`
already emitted a **line-level detail** export — `toAuditCsv(documents)` (one row per contributing
document) plus `auditExportFilename` — served by the `GET return/export` controller endpoint in CSV
(`toAuditCsv`) or JSON (the full audit), and a web BFF proxy route + two download links on
`b/[businessId]/tax`. What did **not** exist was a **return-summary** export (the VAT/GST return
boxes themselves). TASK-19 adds that.

## What changed

- **`packages/contracts/src/tax.ts`** — added `taxExportKindSchema` / `TaxExportKind`
  (`"detail" | "summary"`) and a `kind` field (default `"detail"`, so the pre-existing export link
  keeps its meaning) on `taxExportQuerySchema`.
- **`apps/api/src/tax/audit-export.ts`** — added `toReturnSummaryCsv(summary)` (the return-form
  boxes, one row per currency per box, country-specific by construction: `countryCode`,
  `returnName`, box `code`/`label` come straight from the SA/AE/IN pack; amounts are the exact
  minor-unit integers the aggregation produced, never re-derived) and `returnSummaryFilename`
  (`tax-return-summary-<CC>-<period>.<ext>`). Factored a shared `periodSuffix` helper; the existing
  `auditExportFilename` (`tax-return-<CC>-...`) is unchanged.
- **`apps/api/src/tax/tax.controller.ts`** — `GET return/export` now branches on `kind`: summary →
  `toReturnSummaryCsv` / `audit.summary`; detail → existing `toAuditCsv` / full `audit`. Filenames
  and both formats stream as attachments. Authorization is unchanged (the invoices/tax read
  capability is asserted inside `TaxSummaryService.taxReturn`).
- **`apps/web/.../tax/return/export/route.ts`** — forwards a validated `kind` (`summary`, else
  `detail`) alongside period + format.
- **`apps/web/b/[businessId]/tax/page.tsx`** — four download buttons now: Return summary (CSV/JSON)
  and Audit detail (CSV/JSON).
- Tests: `audit-export.spec.ts` (+summary CSV header/escaping/rows-per-country + filename),
  `tax.service.spec.ts` (+summary CSV reconciles to service figures), new `route.spec.ts` (web proxy
  streams attachment, forwards kind, drops malformed dates, passes upstream failures through).

## Decisions and trade-offs

- Extended the single `return/export` endpoint with a `kind` query param rather than adding a second
  route — mirrors the existing `format` switch, keeps one BFF proxy, and defaults to `detail` for
  backward compatibility (no ADR needed; presentation-only).
- Summary CSV is a flat, self-describing table (country + return name repeated per row) so every row
  reconciles standalone; the box `code`/`label` are the per-pack country-format specifics.
- No cross-currency summing anywhere; each currency is its own block, base currency first
  (ADR-0024).

## Verification

```text
pnpm --filter @bizo/contracts build            # passed (exit 0)
pnpm --filter @bizo/api typecheck              # passed (exit 0)
pnpm --filter @bizo/web typecheck              # passed (exit 0)
pnpm --filter @bizo/api exec vitest run        # see final report (full api suite, 0 failures)
pnpm --filter @bizo/web exec vitest run        # see final report (full web suite)
eslint + prettier on all changed files         # passed (exit 0)
```

## Follow-ups

None blocking. A future ADR could formalise place-of-supply (CGST/SGST vs IGST) for the IN pack, but
that is unchanged from Sprint 3 and out of scope here.

## Handoff notes

The summary export reads `audit.summary` produced by `TaxSummaryService.taxReturn`; it never
recomputes, so it always reconciles to the preview and the detail rows. `kind` defaults to `detail`
to preserve the old link. Claim `clm_0e855cdf` held during the session; released at handoff.

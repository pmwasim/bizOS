# Country compliance delivery plan

Status: Proposed; requires qualified local review before any compliance claim

Last updated: 2026-07-28

## Control model

Each country is a versioned, effective-dated pack. A pack owns tax identifiers, rates and
treatments, currency and rounding, mandatory invoice fields, language and format, document
retention, filing periods, authority integration, and evidence. Only the platform team may publish a
pack version.

## Saudi Arabia

- English and Modern Standard Arabic UI with RTL support.
- Arabic VAT invoice content and required VAT details.
- ZATCA/FATOORAH Phase One e-invoice generation.
- ZATCA/FATOORAH Phase Two integration enabled only for businesses in a required onboarding wave.
- VAT return calculation, reconciliation, owner or accountant approval, evidence retention, and
  authorized submission support.

## United Arab Emirates

- English and Modern Standard Arabic UI with RTL support.
- VAT invoice requirements, Tax Registration Number handling, AED presentation, and line-level
  rounding rules.
- VAT return calculation, reconciliation, owner or accountant approval, evidence retention, and
  authorized EmaraTax submission support.

## India

- English-only UI at launch.
- GSTIN, state-aware CGST/SGST/IGST, invoice and credit/debit-note handling.
- E-invoice integration only when the business is within the applicable mandate.
- GST return calculation, reconciliation, owner or accountant approval, evidence retention, and
  authorized GST portal or approved-provider submission support.

## Non-negotiable filing controls

1. Source transactions remain traceable to every return amount.
2. A filed return is an immutable snapshot with preparer, approver, filing time, confirmation, and
   supporting documents.
3. The product never silently files or pays an authority.
4. A correction creates a new version or amendment workflow; it never rewrites history.
5. A compliance update has legal review, migration assessment, automated regression checks, customer
   notice, and a controlled effective date.

## Validation before market release

For each country, validate the pack against current authority specifications, use representative
test scenarios, verify document rendering and language, conduct an upgrade rehearsal, and obtain
written review from a qualified local tax or accounting adviser. Do not call a pack compliant before
these gates are complete.

# Document templates — design gap analysis and staged plan

Status: Proposed for product-owner decision. Not an approved scope.

Date: 2026-08-06

Design reviewed: `Saudi ERP Document Templates.html` (bilingual print-preview prototype)

## Summary

The design is a **bilingual Arabic/English print system covering 13 document types**, not a branding
configuration screen. Most of what it renders does not exist in the bizOS domain model yet, so this
cannot be delivered as a print-format change. It is a domain project with a print layer on top.

This document maps the gap and proposes stages. It does not assume approval for any of them.

## What the design contains

Thirteen A4 templates, each fully bilingual with RTL Arabic beside English:

| #   | Document               | Arabic        | Exists in bizOS?                |
| --- | ---------------------- | ------------- | ------------------------------- |
| 1   | Quotation              | عرض سعر       | Yes                             |
| 2   | Sales Order            | أمر بيع       | No                              |
| 3   | Tax Invoice            | فاتورة ضريبية | Partly — no ZATCA fields        |
| 4   | Simplified Tax Invoice | فاتورة مبسطة  | No                              |
| 5   | Credit Note            | إشعار دائن    | No                              |
| 6   | Debit Note             | إشعار مدين    | No                              |
| 7   | Purchase Order         | أمر شراء      | Yes                             |
| 8   | Goods Receipt Note     | إشعار استلام  | No                              |
| 9   | Delivery Note          | إشعار تسليم   | No                              |
| 10  | Payment Receipt        | إيصال سداد    | Payments model added 2026-08-06 |
| 11  | Receipt Voucher        | سند قبض       | Partly — via payments           |
| 12  | Payment Voucher        | سند صرف       | Partly — via payments           |
| 13  | Statement of Account   | كشف حساب      | No                              |

Beyond the document list, the design also assumes:

- **ZATCA Phase-1 TLV QR** on tax invoices. The prototype states plainly that it is Phase 1 only and
  does not implement Phase 2 clearance, signing, or XML.
- **VAT categories per line** — standard rated, zero rated, exempt, out of scope — with a VAT
  summary table grouped by category and rate. bizOS has a single `taxRatePpm` per line and no
  category concept.
- **Line discounts, header discount, charges, and a rounding adjustment row.** bizOS has none of
  these.
- **Commercial Registration (C.R.) number** alongside the VAT number. bizOS stores only
  `taxRegistrationNumber`.
- **Bilingual party records** — Arabic and English name and address for both seller and customer.
  bizOS stores one name and one address.
- **Amount in words**, bank details block, signature blocks, and aging buckets for the statement.

## The two structural blockers

### 1. There is no Arabic anywhere in bizOS

`layout.tsx` hardcodes `<html lang="en">` with no `dir`, no i18n library is installed in any
workspace, and UI strings are inline literals across the component tree. This was already logged as
OPEN-6 in the 2026-08-06 evaluation. Every template in this design is bilingual, so this is now on
the critical path rather than a future concern.

### 2. PDFKit corrupts Arabic — measured, not assumed

Stage 0 was run. Both candidate renderers were given the same strings and the output inspected
visually. Evidence PDFs are in `docs/spikes/`.

**PDFKit with an embedded Arabic font (`docs/spikes/arabic-pdfkit-failure.pdf`)**

Glyph shaping actually works — fontkit applies the OpenType joining rules, so letters connect
correctly. Ordering does not:

| Test                                | Result                                            |
| ----------------------------------- | ------------------------------------------------- |
| Arabic-Indic digits in an address   | **Reversed.** Source `١٢٢١١` rendered as `١١٢١١`  |
| Arabic text with Latin digits       | **Corrupted.** VAT number rendered as tofu blocks |
| Word spacing                        | Spaces dropped between some words                 |
| Naive string reversal as a fallback | Breaks shaping entirely, as expected              |

A reversed VAT registration number or invoice total on a tax document is a compliance failure, not a
cosmetic defect. **PDFKit is not viable for these documents**, and no amount of layout work fixes
it, because the defect is in text ordering rather than drawing.

**Headless Chromium via `page.pdf()` (`docs/spikes/arabic-bilingual-invoice-proof.pdf`)**

Every case correct: digit order preserved, mixed Arabic/Latin runs correct, RTL table columns with
LTR tabular numerals, bilingual cells with an English sub-label. Render time **706 ms** for a
complete invoice.

### Stage 0 outcome — recommendation

**Render documents as HTML and print with headless Chromium.** It is the only option measured to
produce correct Saudi tax documents, and it makes the design's CSS directly reusable rather than
rebuilt as drawing primitives.

The cost is honest and should be weighed: a Chromium binary is **~190 MB** (headless shell) to
**~350 MB** (full), which is significant for the free-tier Render services described in the
production runbook. PDFs are also larger — 107 KB versus 9.5 KB from PDFKit — because fonts are
subset and embedded.

Two alternatives remain open if that footprint is unacceptable:

- Keep PDFKit but pre-shape and reorder text with a bidi library plus an Arabic shaper. This must
  reproduce the Unicode Bidirectional Algorithm correctly for mixed number runs, which is exactly
  where the naive approaches above failed.
- Hand document rendering to the ERPNext print-format engine per ADR-0021, which already solves
  Arabic and keeps bizOS out of the rendering business entirely. This is the most consistent with
  the ERP-foundation direction and deserves serious consideration before building anything bespoke.

## End-to-end proof

`docs/spikes/arabic-bilingual-invoice-proof.pdf` is a complete bilingual Saudi tax invoice built
from **live bizOS API data** — a business, customer, and two-line quotation created over HTTP
against the running API — rendered through the browser path, carrying a ZATCA Phase-1 QR produced by
the encoder described below.

The QR payload was decoded independently and cross-checked against the server totals:

| TLV tag | Value                   | Source                                    |
| ------- | ----------------------- | ----------------------------------------- |
| 1       | `شركة حلول نجد التقنية` | Seller Arabic legal name (39 UTF-8 bytes) |
| 2       | `300123456700003`       | VAT registration number                   |
| 3       | `2026-08-06T16:08:26Z`  | Invoice timestamp, UTC                    |
| 4       | `9200.00`               | API `totalMinor` 920000 ÷ 10²             |
| 5       | `1200.00`               | API `taxMinor` 120000 ÷ 10²               |

Money on the rendered document also reconciles: `5,000.00 × 1` and `250.00 × 12` give a subtotal of
`8,000.00`, VAT of `1,200.00`, and `SAR 9,200.00` including VAT — matching the server exactly.

This proves the pipeline end to end: bizOS data → bilingual layout → correct Arabic → compliant QR.
It does **not** mean the feature is built; it means the approach is known to work.

## What was delivered in this pass

Two pieces that are useful under any of the options above, both verified.

### ZATCA Phase-1 QR encoder — `packages/contracts/src/zatca.ts`

The base64 TLV payload for Phase 1 e-invoicing: tags 1–5 (seller name, VAT number, timestamp, total
with VAT, VAT total), UTF-8 encoded with single-byte lengths.

- Amounts are formatted straight from **minor units** with no float step, so a halala cannot be lost
  to binary rounding on a tax document. Verified to hold precision past `Number.MAX_SAFE_INTEGER`.
- Timestamps normalise to ISO 8601 UTC at second precision.
- Arabic seller names use UTF-8 **byte** length, not character count — the most common way a
  hand-rolled TLV encoder produces a QR that scanners reject.
- UTF-8 and base64 are implemented in-package because `@bizo/contracts` is transport-neutral and
  must not depend on Node or DOM globals.
- 13 tests, including an independent decoder so the test does not validate the implementation
  against itself.

**Scope boundary, stated in the source:** Phase 1 generation only. No cryptographic stamp, no
UUID/hash chaining, no signed XML, no Fatoora clearance. A Phase 1 QR does not satisfy Phase 2 where
Phase 2 applies. Confirm with a Saudi tax adviser which phase each customer falls under.

### Template-driven PDF rendering — `apps/api/src/documents/pdf.service.ts`

Accent colour, header wordmark, tax-registration visibility, and footer text moved out of hardcoded
constants into a `DocumentTemplate` passed per render. Defaults reproduce today's output exactly, so
nothing changes until a template is supplied. Total-block text colour is now chosen by WCAG relative
luminance, so a light accent no longer renders white-on-white. Contract in
`packages/contracts/src/document-templates.ts`, 7 tests.

Deliberately **not** done: no `DocumentTemplate` table or migration. Persisting per-business
branding was speculative once the design turned out to be about the documents themselves, so the
schema was left untouched.

## Proposed stages

Each stage is independently shippable and ordered so the expensive decision comes first.

| Stage | Scope                                                                                                                                                                                          | Depends on |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0     | Decide the Arabic rendering strategy (shaping vs headless browser vs ERPNext print formats). Prototype one bilingual invoice end to end to prove it.                                           | —          |
| 1     | Domain fields the design needs regardless of layout: C.R. number, bilingual party names and addresses, per-line VAT category, line/header discounts, charges. Migration plus contract changes. | —          |
| 2     | Tax Invoice and Simplified Tax Invoice with the ZATCA QR wired to the encoder already built, VAT summary by category, amount in words.                                                         | 0, 1       |
| 3     | Credit Note and Debit Note. Needs a decision on whether they adjust the original document or stand alone.                                                                                      | 2          |
| 4     | Delivery Note and Goods Receipt Note. New domain concepts — fulfilment, not billing.                                                                                                           | 1          |
| 5     | Receipt Voucher, Payment Voucher, Payment Receipt on the new payments model.                                                                                                                   | 1          |
| 6     | Statement of Account with aging buckets. Needs a ledger view that does not exist yet.                                                                                                          | 5          |
| 7     | Sales Order. Overlaps the quotation→invoice flow; confirm it is wanted before building.                                                                                                        | 1          |

## Recommendation

Stage 0 is done and the answer is clear: PDFKit cannot produce correct Saudi tax documents, and the
browser path can. The open question is no longer _whether_ it works but _where it should live_ —
inside bizOS with a Chromium dependency, or in the ERPNext print-format engine under ADR-0021.

That is a product and infrastructure decision rather than a technical one, and it should be recorded
in a decision record before Stage 1 begins. The ~190–350 MB Chromium footprint against free-tier
hosting is the deciding constraint.

Stage 1 is safe to start regardless of that outcome. The domain fields the design needs — C.R.
number, bilingual party records, per-line VAT category, discounts, charges — are required under
every rendering option.

Stages 4, 6, and 7 introduce genuinely new domain areas — fulfilment, ledger, and sales orders — and
should each get a decision record before implementation rather than arriving as a side effect of a
print-template project.

## Reproducing the spike

The spike ran outside the repository, in `/tmp/arabic-spike`, so the workspace lockfile was never
touched. It used the system font `/System/Library/Fonts/SFArabic.ttf` for the PDFKit case and the
Chromium already installed for Playwright for the browser case. Nothing from the spike was added to
the repository except the two evidence PDFs in `docs/spikes/`.

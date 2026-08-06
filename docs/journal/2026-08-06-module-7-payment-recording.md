# Module 7 Payment Recording

Date: 2026-08-06

Agent: c0d88fc3-7c6c-444b-b0db-afbe4013189f

Scope: apps/api/src/payments, packages/contracts/src/payments.ts,
apps/web/src/app/b/[businessId]/payments

Status: Completed

Related: none

## Context

Started with user's request to complete the development of bizOS, focusing on Module 7 (Payment
Recording). The repository lacked a payment module to record inbound and outbound payments or
allocate them to invoices and purchase orders.

## What changed

- Added `Payment` and `PaymentAllocation` models to `packages/database/prisma/schema.prisma` and
  applied database migrations.
- Created DTOs for `Payment`, `PaymentAllocation` in `@bizo/contracts`.
- Created `PaymentsModule`, `PaymentsController`, `PaymentsService` in `apps/api/src/payments`.
- Added authorization configurations for the new `payments` resource in `BusinessAccessService`.
- Created `PaymentsPage` (`apps/web/src/app/b/[businessId]/payments/page.tsx`) and detailed
  `PaymentDetailPage` (`[paymentId]/page.tsx`).
- Updated `InvoiceDetailPage` (`apps/web/src/app/b/[businessId]/invoices/[invoiceId]/page.tsx`) to
  show payment status and compute amount due.

## Decisions and trade-offs

- Calculated payment totals on the Web UI client component for invoices (`apiJson<Payment[]>`)
  instead of modifying the invoice API response. This aligns with MVP constraints and avoids a large
  migration on `Invoice` schema.
- Re-used `apiJson` for internal API calls on page load.
- Exported Prisma `PaymentStatus` and `PaymentType` directly from `@bizo/database/src/index.ts`.

## Verification

```text
pnpm --filter @bizo/database prisma:migrate:dev --name payments # result: Success
pnpm --filter @bizo/api build      # result: Success (Nest build)
pnpm --filter @bizo/web typecheck  # result: Success (tsc --noEmit)
pnpm --filter @bizo/api test       # result: Success
```

## Follow-ups

- Future enhancement: Allow linking a payment directly to an invoice via the Payments API when a
  payment is created.
- Consider paginating the `/payments` API endpoint when business activity scales.

## Handoff notes

- The `payments` resource is fully available in Casbin roles and tests are passing.
- The web app has a known nextjs global build issue (`pnpm build` / `pnpm check`), so we relied on
  `typecheck` for web as outlined in `AGENTS.md`.

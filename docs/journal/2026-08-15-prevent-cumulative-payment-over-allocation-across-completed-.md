# Prevent cumulative payment over-allocation across completed payments (Issue #59)

Date: 2026-08-15

Agent: antigravity

Scope: apps/api/src/payments

Status: Done

Related: [Issue #59](https://github.com/pmwasim/bizOS/issues/59),
[ADR-0023](../decisions/0023-invoice-settlement-is-derived.md)

## Context

Issue #59 identified that while the payment service validated that allocations within a single
payment did not exceed that payment's amount, `markAsCompleted` did not verify whether the
cumulative completed payment allocations on a target document (invoice) or purchase order exceeded
the document's total. As a result, multiple individually valid payments could cumulatively overpay
an invoice or purchase order without rejection.

## What changed

1. **`apps/api/src/payments/payments.service.ts`**:
   - In `markAsCompleted`, added remaining balance verification for each allocation before marking
     the payment `COMPLETED`.
   - For invoice allocations (`documentId`): computed the sum of all existing `COMPLETED` payment
     allocations for that document (excluding the current payment) and enforced
     `priorPaidMinor + newAllocMinor <= docTotalMinor`. If exceeded, thrown `BadRequestException`
     with exact amount and document number.
   - For purchase order allocations (`purchaseOrderId`): computed the sum of all existing
     `COMPLETED` payment allocations for that PO and enforced
     `priorPaidMinor + newAllocMinor <= poTotalMinor`.
2. **`apps/api/src/payments/payments.service.spec.ts`**:
   - Added unit test asserting rejection when a payment completion causes cumulative allocations to
     exceed the invoice remaining balance.
   - Added unit test asserting successful completion when payment allocation matches or is within
     the invoice remaining balance.

## Decisions and trade-offs

- Follows ADR-0023 where invoice settlement remains derived from payment allocations.
- Enforces remaining balance strictly in the database transaction on payment completion, preventing
  cumulative over-allocation while preserving exact minor-unit integer arithmetic.

## Verification

```text
pnpm lint          # passed (0 errors, 0 warnings)
pnpm typecheck     # passed (18/18 packages)
pnpm format:check  # passed (All matched files use Prettier code style)
pnpm test          # passed (18/18 packages, 655 tests passed)
```

## Follow-ups

- Closed Issue #59 on GitHub.

## Handoff notes

- Cumulative allocation balance check is now enforced on `markAsCompleted` for all invoice and
  purchase order payment allocations.

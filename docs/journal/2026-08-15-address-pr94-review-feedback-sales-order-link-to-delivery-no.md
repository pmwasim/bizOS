# Address PR94 review feedback: sales-order link to delivery notes, supplier deactivation, and minor-unit forms

Date: 2026-08-15

Agent: antigravity

Scope: apps/web

Status: Complete

Related: PR #94, `2026-08-15-branch-audit-recover-unmerged-phase-1-work-and-fix-three-bro.md`

## Context

PR #94 restored the phase-1 web routes and components that were recovered during the branch audit.
Automated and inline code reviews on PR #94 flagged two functional gaps:

1. "Create delivery" link from sales order did not preserve the sales order ID (`sourceDocumentId`),
   causing created delivery notes to drop their linked sales order association.
2. `SupplierActions` (deactivate supplier form) was not rendered on the supplier detail page,
   leaving active suppliers without a UI deactivation path.
3. Leads and opportunity amount fields collected decimal inputs without converting them to minor
   integer units based on the business's `currencyScale`.

## What changed

### `apps/web/src/app/actions.ts`

- Added `toMinorUnits(formData, field)` helper using `parseDecimalToScaledInteger` and
  `currencyScale` from `formData`.
- Converted `estimatedValue` in `createLeadAction` and `amount` / `amountMinor` in
  `createOpportunityAction` to minor units string.
- Extracted and forwarded `salesOrderId` from `formData` in `createDeliveryNoteAction` to
  `@bizo/contracts/delivery-notes` payload.

### `apps/web/src/components/delivery-note-form.tsx` & `apps/web/src/app/b/[businessId]/delivery-notes/new/page.tsx`

- Accepted `salesOrderId` / `order` query parameter in `NewDeliveryNotePage` and forwarded
  `defaultSalesOrderId` to `DeliveryNoteForm`.
- Rendered `<input type="hidden" name="salesOrderId" value={defaultSalesOrderId} />` when present.
- Updated sales order detail page "Create delivery" link to pass
  `?customer=${order.customer.id}&salesOrderId=${order.id}`.

### `apps/web/src/app/b/[businessId]/suppliers/[supplierId]/page.tsx`

- Imported `SupplierActions` and rendered it when `supplier.isActive` is true, enabling direct
  supplier deactivation from the UI.

### `apps/web/src/app/b/[businessId]/leads/new/page.tsx` & `apps/web/src/app/b/[businessId]/opportunities/new/page.tsx`

- Fetched business settings via `GET /businesses/${businessId}/settings` and passed
  `currencyScale={settings.currencyScale}` to `LeadForm` and `OpportunityForm`.
- Included hidden `currencyScale` input in `LeadForm` and `OpportunityForm`.

## Decisions and trade-offs

- **Reused `parseDecimalToScaledInteger` from `@bizo/contracts/money`** rather than manual
  arithmetic or float parsing, ensuring consistent decimal parsing and scale enforcement across
  monorepo boundaries.
- **Rendered deactivation action only when `supplier.isActive` is true** to avoid confusing
  double-deactivation submissions.

## Verification

```text
pnpm lint          pass (eslint .)
pnpm format:check  pass (prettier --check .)
pnpm typecheck     pass (turbo run typecheck, all 9 packages / 18 tasks)
pnpm test          pass (all 18 tasks, 653 unit & integration tests)
pnpm graph         written (.agent/graph.md)
pnpm agent:verify  pass (graph, journal, and claims verified)
```

## Follow-ups

- Merge PR #94 once CI completes and monitor branch protection requirements.
- Review and triage remaining Dependabot branches.

## Handoff notes

- All claims released.
- PR #94 review feedback fully addressed and verified locally.

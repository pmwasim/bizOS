# Configuration-aware invoice readiness — checkpoint

**Branch:** `cursor/config-driven-invoice-readiness-ccc4`  
**Date:** 2026-07-28  
**Base:** `main` @ `16f48ef` (PR #31 Default ERP foundation)

## Outcome

Default ERP businesses can create an invoice from a **sent quotation** without a customer PO.
Service PO & Approval businesses keep the `READY_TO_INVOICE` gate.

## Verified locally

- `pnpm format:check`, `docs:check`, `lint`, `typecheck`, `test`, `db:validate`, `build` — green
- `security:local-services` skipped here (no Docker in cloud agent); CI runs it
- API unit tests: 143 passed (includes Default ERP create-without-PO case)

## Admin approval packet — production

PR #31 (`16f48ef`) is on `main` but **not yet production-deployed**. Last production deploy was
`bf91c76` (invoice slice). This readiness PR also needs a controlled deploy after merge.

Suggested sequence (explicit Admin approval required):

1. Confirm Render Postgres recovery point / backup.
2. Run production deploy workflow for `main` including:
   - schema migration `configuration_foundation`
   - seed (`pnpm db:seed` / deploy seed step)
   - backfill `backfill_configuration_assignments`
   - dry-run report: no unassigned businesses
3. Merge and deploy this readiness PR (no new migrations).
4. Smoke: Default ERP business — send quotation → create invoice without PO.
5. Smoke: Service PO business — still blocked until READY_TO_INVOICE.

**Zero-cost:** no new paid services or npm dependencies.

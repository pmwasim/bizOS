# TASK-01 API contracts for BFF write actions

Date: 2026-08-18

Agent: jim

Scope: apps/api/src/inventory, apps/api/src/projects, apps/api/src/credit-notes,
packages/contracts/src

Status: Complete

Related: ADR / issue / previous journal entry, or none

## Context

God requested confirmation that the BFF write actions had real API targets for inventory item,
project, and credit-note creation. The three NestJS controllers, services, and shared Zod contracts
were already present on main; this session verified their registration, global route prefix, request
schemas, and response mappings. No API or contract implementation was missing.

## What changed

No application source changes were needed. Confirmed:

- `InventoryController.create` is `POST /api/v1/businesses/:businessId/inventory`, using
  `createInventoryItemRequestSchema`/`CreateInventoryItemRequest`, returning `InventoryItem`.
- `ProjectsController.create` is `POST /api/v1/businesses/:businessId/projects`, using
  `createProjectRequestSchema`/`CreateProjectRequest`, returning `Project`.
- `CreditNotesController.create` is `POST /api/v1/businesses/:businessId/credit-notes`, using
  `createCreditNoteRequestSchema`/`CreateCreditNoteRequest`, returning `CreditNote`.

`AppModule` imports all three modules, and `main.ts` supplies `/api` plus URI version `v1`. The
contracts package already exposes the three schemas through its `./inventory`, `./projects`, and
`./credit-notes` subpath exports. Sent the exact signatures and auth handoff to Pam via the hive
outbox.

## Decisions and trade-offs

Kept the existing subpath contract imports; adding duplicate root exports or web-side route handlers
would have exceeded this API/contracts-only scope. Server Actions should call the existing
`apiJson`/`apiFetch` boundary so the internal-auth assertion, business headers, and cold-start retry
behavior remain intact.

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm --filter @bizo/contracts test --run                                      # passed, 16 files / 120 tests
pnpm --filter @bizo/api test --run src/inventory/inventory.service.spec.ts src/projects/projects.service.spec.ts src/credit-notes/credit-notes.service.spec.ts  # passed, 3 files / 10 tests
pnpm --filter @bizo/contracts typecheck && pnpm --filter @bizo/api typecheck # passed
pnpm --filter @bizo/api exec eslint src/inventory src/projects src/credit-notes # passed
pnpm --filter @bizo/contracts lint                                            # passed
pnpm --filter @bizo/api lint -- --no-warn-ignored src/inventory src/projects src/credit-notes # failed: pnpm forwarded the extra `--` to eslint, which treated `--no-warn-ignored` as a path; rerun above passed with `pnpm exec eslint`.
```

## Follow-ups

No API/contracts follow-up remains for TASK-01. Pam still needs to wire the web Server Actions; the
endpoint contracts were sent to her. No release blocker found in these scopes.

## Handoff notes

Routes require the normal authenticated API call: `/api/v1` is the externally visible prefix, while
the web `apiJson` helper is passed paths without that prefix and builds the configured internal URL.
Request bodies are strict Zod objects; decimal money fields are decimal strings, not numbers.
Credit-note creation returns a `DRAFT` note (the separate
`POST .../credit-notes/:creditNoteId/issue` endpoint changes lifecycle state). Claim `clm_f5d3685c`
remains active until release.

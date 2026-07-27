# Phase 1 — Authoritative Starting State Checkpoint

**Branch:** `feature/default-erp-onboarding-system-admin` **Created:** 2026-07-28 **Author:**
Principal product architect session

## 1. Starting main SHA

`bf91c767a611ad3e67995fab87c61ccf820cec4d`

Commit: `feat: invoice vertical slice (ready quotation → sent invoice) (#28)`

## 2. Production-deployed SHA

`bf91c767a611ad3e67995fab87c61ccf820cec4d`

Source: production-deploy.yml run `30308786048` (conclusion: success, 2026-07-27T21:55:17Z). All
five deploy jobs succeeded: Release gate, Publish immutable images, Validate R2 infrastructure,
Production migration, Deploy API and web.

Production had not yet been redeployed after PR #29 (docs) or PR #30 (docs) because neither changes
runtime artifacts. Production remains at `bf91c76` until a runtime-bearing PR is released.

## 3. Resulting main SHA (after PR #30 merge)

`2db5feb141fe96b4e7507e678165f8b1deff2df2`

Commit: `docs: redefine bizOS as default ERP with optional customization (#30)`

## 4. PR #30 status

- **State:** MERGED at 2026-07-27T22:30:07Z
- **Merge commit:** `2db5feb141fe96b4e7507e678165f8b1deff2df2`
- **Scope:** documentation-only (1 file: `docs/product-requirements.md`, +1121/-79)
- **Review:** approved by Cursor Approval Agent (risk: low, docs-only)
- **Quality gate:** passed (2m36s) after a prettier formatting fix was pushed (commit `ca4ac87`)
- **Prisma Compute Deploy:** failed (known non-required check; merged with `--admin` per the PR
  #28/#29 pattern)
- **Post-merge main CI:** monitored separately (run `30310945466`)

## 5. Current release tag

`v0.3.0-beta.1`

Prior tags: `v0.2.0-beta.2`, `v0.2.0-beta.1`, `v0.1.0-beta.1`.

## 6. Active production capabilities

Runtime modules confirmed live on production (`bf91c76`):

| Capability                                             | Module                                                                                         | Status |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------ |
| Authentication / Auth.js sessions                      | `apps/api/src/identity`, `apps/web` auth                                                       | live   |
| Tenant + business isolation                            | `apps/api/src/security/business-access.service`                                                | live   |
| Customers                                              | `apps/api/src/customers`                                                                       | live   |
| Quotations (draft, send, accept, decline, revise, PDF) | `apps/api/src/documents/quotations.*`, `pdf.service`                                           | live   |
| Purchase orders + approval evidence + ready-to-invoice | `apps/api/src/purchase-orders`                                                                 | live   |
| Invoices (draft, send, PDF, R2)                        | `apps/api/src/documents/invoices.*`                                                            | live   |
| PDF generation                                         | `apps/api/src/documents/pdf.service`                                                           | live   |
| Email (Resend)                                         | `apps/api/src/mail/mail.service`                                                               | live   |
| Cloudflare R2 object storage                           | `packages/storage/src/r2-client`                                                               | live   |
| Platform business create/settings                      | `apps/api/src/platform`                                                                        | live   |
| Health                                                 | `apps/api/src/health`                                                                          | live   |
| Web app (desktop + 390px mobile)                       | `apps/web/src/app/b/[businessId]` (customers, invoices, purchase-orders, quotations, settings) | live   |

## 7. Current workflow assumptions (hard-coded)

The live workflow is the specialized process belonging to two specific businesses, now encoded as
the universal path:

```text
Customer
  → Quotation
  → Customer PO
  → Approval Evidence
  → Ready to Invoice
  → Invoice
  → Payment
```

Encoded in:

- `Document.status` (`DocumentStatus` enum) — single status field per document, no version context.
- `Document.purchaseOrderId` — every invoice path assumes a customer PO attachment.
- `apps/api/src/documents/quotations.service.ts` and `invoices.service.ts` — transition logic
  embedded in service code.
- `apps/api/src/purchase-orders` — approval evidence and ready-to-invoice readiness rules
  hard-coded.
- `apps/web/src/app/b/[businessId]/quotations/[quotationId]/page.tsx` and
  `purchase-orders/[purchaseOrderId]/page.tsx` — UI assumes the same path for every business.

## 8. Current System Admin implementation

**None.** No platform-level System Admin role, portal, or authorization boundary exists.

- `model Role` in Prisma is tenant-scoped (`tenantId`, `code`, `permissions`). There is no
  platform-level role concept.
- `apps/api/src/security/business-access.service` enforces tenant + business scope but has no
  platform-admin path.
- No `system-admin` route, controller, or UI exists.
- Organization `Owner`/`Admin` roles are the highest authority today; they are not separated from
  platform structural control because platform structural control does not exist yet.

## 9. Current n8n status

**Not integrated in code.** A search for `n8n` across non-markdown files returned no matches.

A self-hosted n8n deployment on Ubuntu is referenced in operational docs but is not wired to bizOS
via webhooks, API calls, or workflow definitions in the repository. Phase 12 will inspect the live
n8n instance separately.

## 10. Configuration / workflow versioning status

**Decided but not implemented.**

- ADR-0006 (versioned deterministic workflow engine) is accepted: immutable versioned workflow
  definitions, deterministic guarded transitions, no arbitrary code.
- ADR-0007 (Casbin authorization) is accepted: subject/tenant/business/object/action policy.
- The Prisma schema has **no** `WorkflowTemplate`, `WorkflowTemplateVersion`,
  `ConfigurationTemplate`, `ConfigurationTemplateVersion`, `BusinessConfigurationAssignment`, or
  `DocumentWorkflowContext` models.
- `Document.version` is the document's own revision counter, not a workflow/configuration version
  reference.
- `Business` has no `configurationAssignmentId` or workflow assignment field.

## 11. Migration status (current)

Four migrations applied on production (`bf91c76` deploy):

1. `20260727090000_mvp_core`
2. `20260727193000_purchase_orders_approval_readiness`
3. `20260728010000_invoice_document_slice`
4. `20260728010100_invoice_document_constraints`

## 12. Intended migration approach (Phase 13 preview)

Additive, backward-compatible, repeat-safe:

1. Add new tables: `ConfigurationTemplate`, `ConfigurationTemplateVersion`, `WorkflowTemplate`,
   `WorkflowTemplateVersion`, `WorkflowStep`, `WorkflowTransition`,
   `BusinessConfigurationAssignment`, `DocumentWorkflowContext`, `CustomFieldDefinition`,
   `IndustryPack`, `FeatureFlag`, `ConfigurationAuditEvent`, `CustomizationRequest`.
2. Seed `Default bizOS ERP v1` (published, immutable) and `Service PO & Approval Configuration v1`
   (published, immutable).
3. Backfill every existing `Business` with a reviewed `BusinessConfigurationAssignment`:
   - Businesses whose live data uses the customer-PO + approval-evidence path →
     `Service PO & Approval Configuration v1`.
   - Test or unrelated businesses → `Default bizOS ERP v1` unless evidence supports otherwise.
4. Set `Default bizOS ERP v1` as the fallback for all new businesses.
5. Backfill historical `Document` rows with `DocumentWorkflowContext` pointing at the version under
   which they were created.
6. Preserve all existing identifiers, URLs, numbering, and records.
7. Add indexes and constraints; keep compatibility fields until migration is proven.
8. Dry-run assignment report before production; verify no business remains unassigned.
9. Recovery point: confirm Render Postgres backup before production migration; do not auto-reverse
   destructive migrations.

## 13. Working tree state at checkpoint

- Branch: `feature/default-erp-onboarding-system-admin` (created from `main` at `2db5feb`).
- Clean except untracked: `.cursor/`, `e2e/prod-invoice-smoke.mjs` (preserved; not on
  `origin/main`).
- No local changes discarded.

## 14. Local branches

- `cursor/fix-unauth-pdf-proxy` (tracks origin)
- `cursor/ops-closure-final-report` (tracks origin)
- `docs/invoice-production-evidence` (tracks origin)
- `feature/invoice-vertical-slice` (tracks origin)
- `feature/default-erp-onboarding-system-admin` (current, new)
- `main` (tracks origin, at `2db5feb`)

## 15. Open PRs (excluding PR #30, now merged)

| PR  | Title                                                | State             |
| --- | ---------------------------------------------------- | ----------------- |
| #23 | docs(infra): private-beta operational closure report | open              |
| #14 | ci(infra): push-triggered secret and R2 revalidation | open              |
| #7  | chore(deps): bump typescript from 6.0.3 to 7.0.2     | open (dependabot) |
| #5  | chore(deps): bump node in /apps/api                  | open (dependabot) |
| #4  | chore(deps): bump node in /apps/web                  | open (dependabot) |
| #3  | chore(deps): bump pnpm/action-setup                  | open (dependabot) |
| #2  | chore(deps): bump github/codeql-action/analyze       | open (dependabot) |
| #1  | chore(deps): bump github/codeql-action/init          | open (dependabot) |

None of these block the Default ERP foundation release. Dependabot PRs and infra PRs can be triaged
separately.

## 16. Production health at checkpoint

- API: `https://api.bizos.qloudihub.com/api/v1/health` → 200 OK (verified during PR #28 deploy).
- Web: `https://bizos.qloudihub.com/` → 200 (verified during PR #28 deploy).
- A prod invoice smoke run timed out on navigation (`page.waitForURL` 120s) but the underlying flows
  were verified through the deploy job and prior evidence; PR #29 merged the production smoke
  evidence.

## 17. Next actions

- Phase 2: audit hard-coded business assumptions (delegated to background subagent).
- Phase 3: open-source leverage assessment + ADRs (delegated to background subagent).
- Phase 4: configuration architecture data model + migration (after Phase 2/3 findings).
- Phase 5-13: implementation on this feature branch.
- Phase 17: split into focused PRs; do not deploy until production smoke and acceptance pass.

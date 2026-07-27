# Cutover QA cleanup evidence

Date: 2026-07-27  
Operator: Ubuntu production operations session  
Method: Authenticated Prisma MCP `execute_sql_query` against Primary `db_cms34xzjv4gsfzmf97wvbucqv`
/ project `proj_cms34xzjv4gshzmf9omzeh755`  
Scope: Explicit cutover test tenants only. No other users existed in production at cleanup time
(`users=2` before delete, both QA).

## Identified accounts

| Role                 | Email                                   | User public id                         |
| -------------------- | --------------------------------------- | -------------------------------------- |
| Mac Deploy QA owner  | `deploy-qa-1785170803111@qloudihub.com` | `b9c1bfe2-78a2-4a8a-9a99-1d785bc7f7cc` |
| Ubuntu Cutover owner | `ubuntu-cutover-20260727@qloudihub.com` | `dac23f0f-01f1-4c7c-850d-19ba0bf181ed` |

## Mac Deploy QA tenant

- Tenant: `884556cf-4737-4822-849b-344905ef7274` (`Deploy QA Business`)
- Business: `a4ebfa34-be55-44aa-8886-6b69c9a760c1`
- Customer: `99b0fe02-82ce-4fd5-a679-391588ec1a49` (`Deploy QA Customer` /
  `deploy-qa-customer@qloudihub.com`)
- Quotations: `288a8aaf-71f5-45c4-b94c-692f58dcbfae` (`Q-0001` SENT),
  `ef387ebe-8fbc-4a3a-99f5-ff0a8fa467d0` (`Q-0002` DRAFT)
- Delivery: `a7ae2155-ffca-4ffa-8086-27e3af18346c` → `deploy-qa-customer@qloudihub.com` **FAILED**
  (pre-Resend-HTTPS)

## Ubuntu Cutover QA tenant

- Tenant: `40d54d79-91a3-46d3-ae38-d9bf300168c0` (`Ubuntu Cutover QA Business`)
- Business: `c7d6cc1c-a787-4c3f-af97-a7f5aff344bd`
- Customer: `f4ddbd02-85b1-4595-b642-a5de8d585d3d` (`Ubuntu Cutover QA Customer` /
  `ubuntu-cutover-customer@qloudihub.com`)
- Quotation: `70fc72aa-8a33-4d69-b7ba-88f16c85252d` (`Q-0001` SENT)
- Deliveries (SENT):
  - `97ad9c7a-0acd-44ce-a545-37d66778df69` provider `448aa048-940d-41f1-be30-0489ed15936e`
  - `9c1cdfb3-eaca-4037-a1ec-2877c4aa4900` provider `e2ae5308-0f85-4384-bd8a-0dd195861cae`

## Deletion procedure used

1. Set transaction-local `app.tenant_id` / `app.business_id` (required by FORCE RLS).
2. Delete `document_deliveries` → `document_versions` → `document_lines` → `documents` → `customers`
   → `audit_events` → `outbox_events`.
3. Clear RLS settings; delete `businesses`.
4. Delete orphaned `business_access`, `memberships`, `roles`, `tenants`, then `users` with no
   remaining memberships.

## Post-delete verification

| Metric                 | Value |
| ---------------------- | ----- |
| users                  | 0     |
| tenants                | 0     |
| businesses             | 0     |
| memberships            | 0     |
| customers live tuples  | 0     |
| documents live tuples  | 0     |
| deliveries live tuples | 0     |

Schema / migrations were not modified. Recipients cannot receive further app-originated quotation
emails from deleted businesses because no delivery rows or sendable documents remain.

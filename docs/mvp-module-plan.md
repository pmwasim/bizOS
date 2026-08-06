# MVP module delivery plan

Status: Proposed for product-owner approval

Last updated: 2026-07-28

## Rule of delivery

Deliver a module only when its user workflow, authorization, audit trail, integration contract,
recovery behavior, and applicable country-pack checks are proven. A UI alone is not a release.

## Delivery sequence

| Order | Module                       | Outcome                                                                                                       | Release gate                                                                                    |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0     | ERP foundation seam          | ERPNext/Frappe runs as an upgradeable core; bizOS uses supported APIs rather than direct database writes.     | Upgrade rehearsal preserves a configured business.                                              |
| 1     | Identity and business access | A user registers, selects an active business, and requests or approves access without cross-business leakage. | Tenant and business isolation, role checks, and audit tests pass.                               |
| 2     | Country and experience packs | A business receives a Saudi, UAE, or India pack and uses guided bizOS or standard ERPNext.                    | Versioning, rollback, RTL, and pack applicability pass.                                         |
| 3     | Contacts                     | A permitted user manages customers and suppliers.                                                             | Business scope, duplicates, audit, and import tests pass.                                       |
| 4     | Quotations                   | A permitted user creates, revises, approves, sends, and exports a quotation.                                  | Exact money, numbering, PDF reproducibility, approval, and audit pass.                          |
| 5     | Customer invoices            | A permitted user creates a country-appropriate invoice from commercial work.                                  | Mandatory fields, tax, document lifecycle, e-invoice capability boundary, and PDF tests pass.   |
| 6     | Purchase orders              | A permitted user creates and approves purchase orders.                                                        | Supplier scope, approval, change history, and authorization pass.                               |
| 7     | Payment recording            | A permitted user records received and made payments without gateway collection.                               | Allocation, reversal, audit, statement effect, and no-payment-credential tests pass.            |
| 8     | Statements and ledger        | A business views customer and supplier statements plus role-authorized ledger evidence.                       | Reconciliation, date range, export, read-only auditor access, and correct balances pass.        |
| 9     | Tax filing                   | A business prepares, reviews, approves, and retains country-specific tax-return evidence.                     | Authority-format validation, explicit approval, filing evidence, and no silent submission pass. |

## Pilot definition

A pilot business must complete this workflow: register; choose a country and experience pack; add a
customer; create and send a quotation; issue a compliant invoice; record a payment; view its
statement and ledger evidence; and prepare the relevant return. Pilot feedback can improve UX but
cannot bypass financial, privacy, or compliance gates.

## Deferred modules

Online payment collection, inventory, manufacturing, full CRM, projects, native mobile, desktop,
plugins, marketplace, and AI are later modules. They must not delay the MVP sequence.

# Product overview

Status: Accepted product direction

## Who bizOS serves

The primary customer is a small business or service company with an owner, operators, sales or
delivery staff, and optionally a finance specialist. A single user may operate several legally or
operationally distinct businesses.

## Foundation and product boundary

ERPNext/Frappe provides the underlying ERP foundation. bizOS is the product customers buy: a
configurable, branded, guided experience that uses ordinary business language and reveals ERP
complexity only when it is useful. bizOS does not rebuild accounting, inventory, or ERP record
keeping that ERPNext already provides safely.

During registration, the business administrator chooses a default: a versioned bizOS experience pack
(custom UI and workflow) or standard ERPNext mode. It does not lock users into that default. A user
may belong to multiple businesses and, for each active business where their role permits it, choose
the guided bizOS workspace or the standard ERPNext interface. Business membership, role,
capabilities, and data access remain separate for every business; switching business or interface
does not change the shared ERP records, permissions, or audit trail.

The bizOS system-administrator team governs the reusable country, industry, UI, and workflow packs.
Business administrators customize only the settings and workflows their assigned pack permits. Both
types of changes are versioned and audited.

## Onboarding model

bizOS uses a hybrid onboarding model. A small business can complete self-service registration and
guided setup on its own. At any point it can request assisted setup from the bizOS team for pack
selection, configuration, migration, or training. Assisted setup extends the same registration
record and configuration model; it is not a separate product or a manual data path.

Onboarding supports two paths: a clean start for a new business, or a controlled import of existing
customers, quotations, invoices, and opening balances. Imports use validated templates, a preview,
an explicit business approval, and an immutable migration record that identifies the source and
import time. Imported historical documents must not be represented as invoices issued through bizOS
or as newly cleared government e-invoices.

Migration sources include another digital platform, spreadsheets, and manual or paper-based records.
For manual records, bizOS provides simple guided entry or an assisted-entry service; it must record
which values were supplied by the business rather than implying independent verification of the
history.

## Launch language policy

English is the default application language in every launch market. Saudi Arabia and the UAE also
receive one shared Modern Standard Arabic interface, including right-to-left layout. Country packs
own legal wording, document labels, tax terminology, and any required local variants; do not create
separate Saudi and Emirati dialect interfaces for the first release. India launches in English only.

All customer-entered names, addresses, documents, and data must support Unicode independently of the
chosen interface language. New languages are country-pack additions, not forks of the product.

## First proof journey

The first application connects:

```text
Offer → Customer order → Supplier order → Work/invoice review
      → Customer invoice → Payment → Account statement
```

The UI uses customer language:

| Formal concept       | Default UI language                     |
| -------------------- | --------------------------------------- |
| Quotation            | Offer                                   |
| Accounts receivable  | Money customers owe                     |
| Accounts payable     | Bills to pay                            |
| Debit / credit       | Increase / decrease with an explanation |
| Statement of account | Account statement                       |
| Posting              | Finalize                                |
| Void                 | Cancel and keep a record                |

Formal labels remain discoverable in help text, exports, and country-specific documents.

## Minimum release capabilities

The first releasable bizOS product must let an authorized business user:

1. create and manage customers;
2. create, revise, approve, and send quotations;
3. create compliant customer invoices from approved commercial work;
4. create and manage purchase orders;
5. record received and made payments without collecting payment online;
6. view a customer or supplier statement of account; and
7. access the underlying ERP ledger and its audit evidence through an appropriate role-aware
   experience.

ERPNext remains the accounting and ledger foundation. bizOS presents these capabilities in plain
language, while preserving the formal records required for the country pack and authorized finance
users.

## Product surfaces

- **Today**: prioritized work and exceptions.
- **Work**: offers, orders, approvals, invoices, payments, and statements.
- **Contacts**: customers, suppliers, and their people.
- **Reports**: operational and financial views expressed as questions.
- **Automations**: visible rules and their recent outcomes.
- **Settings**: business identity, team, numbering, currencies, tax, integrations, and modules.

## Platform boundary

ERPNext remains authoritative for enabled ERP records, permissions, audit, and accounting controls.
bizOS uses supported APIs and governed extensions; it must not write ERP data directly or conceal
formal accounting truth. Country-specific statutory claims still require dedicated controls and
specialist acceptance.

## Progressive capability

The default experience shows one business, one base currency, a simple tax choice, and a small role
set. Advanced tax rules, custom workflows, formulas, cross-business reporting, plugins, and API
credentials appear only after explicit enablement and permission.

## Payments at launch

bizOS creates compliant invoices and records customer payments, including operational status and
audit evidence. It does not collect money, host payment links, store payment credentials, or connect
to payment gateways in the launch release. Those capabilities remain a later, separately governed
integration.

## Commercial model

Each registered business can start with a free access level. Paid subscriptions provide ongoing
access to selected plans, modules, capacities, or support, while credits cover defined usage-based
or premium actions. The exact limits, prices, credit events, trials, upgrades, refunds, and tax
treatment require a separate commercial-policy decision. Product access must be controlled by clear
entitlements and audit evidence, not by ad-hoc manual changes.

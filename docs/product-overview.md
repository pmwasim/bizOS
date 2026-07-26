# Product overview

Status: Accepted Phase 0 scope

## Who bizOS serves

The primary customer is a small business or service company with an owner, operators, sales or
delivery staff, and optionally a finance specialist. A single user may operate several legally or
operationally distinct businesses.

## First product journey

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

## Product surfaces

- **Today**: prioritized work and exceptions.
- **Work**: offers, orders, approvals, invoices, payments, and statements.
- **Contacts**: customers, suppliers, and their people.
- **Reports**: operational and financial views expressed as questions.
- **Automations**: visible rules and their recent outcomes.
- **Settings**: business identity, team, numbering, currencies, tax, integrations, and modules.

## Platform boundary

bizOS is not an accounting ledger in the first release. It records commercial documents and their
operational payment state, and will integrate with or later add a governed ledger module. It must
never imply that an operational status is statutory accounting truth unless the relevant module and
country controls provide that guarantee.

## Progressive capability

The default experience shows one business, one base currency, a simple tax choice, and a small role
set. Advanced tax rules, custom workflows, formulas, cross-business reporting, plugins, and API
credentials appear only after explicit enablement and permission.

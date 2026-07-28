# Domain model

Status: Quotation MVP schema approved

## Core scopes

- **Tenant**: security and commercial account boundary.
- **Business**: an operating/legal entity within a tenant.
- **Membership**: a person's access relationship to a tenant and selected businesses.
- **Person**: an authenticated human identity; not duplicated per business.
- **Party**: a customer, supplier, or other organization/person known to a business.

Every business record has `tenant_id` and `business_id`. Tenant scope is derived from the
authenticated membership and cannot be selected freely by request input.

## Work and documents

- **Work item**: actionable unit with owner, state, due time, and reason.
- **Document**: versioned commercial record with number, parties, dates, currency, totals, and
  lifecycle.
- **Document version**: immutable facts used to reproduce an issued representation.
- **Line**: quantity, description, unit measure, price components, discount, and tax treatment.
- **Approval request**: decision required under a policy, with evidence and result.
- **Payment**: observed movement of money.
- **Allocation**: amount of a payment applied to a document or balance.
- **Statement**: point-in-time generated view over document and payment facts.
- **Attachment / stored object**: metadata for a private object outside the application web root.
- **Purchase order**: inbound customer PO linked to at most one quotation, with approval status and
  evidence files (ADR-0016). Not a `DocumentType`.

A quotation uses the shared document facts and its own application service and lifecycle. Purchase
orders are a separate aggregate with derived invoice readiness. Invoice, payment, and workflow
engine states remain out of the live schema until their ADRs are accepted.

## Value objects

- Money: signed integer minor units, ISO currency code, and explicit scale.
- Quantity: decimal value plus unit.
- Exchange rate: decimal ratio, source, observed/effective time, and direction.
- Tax component: jurisdiction, rule version, base, rate, amount, and rounding explanation.
- Address: structured fields plus country-specific extensions.
- Document number: business-scoped display identifier, separate from public object ID.
- Effective period: half-open `[from, until)` time range.

## Identity and time

- Internal database keys may optimize joins but never appear as public authorization evidence.
- Public identifiers are random UUIDs or equivalent high-entropy values.
- Business dates are stored as dates; events are UTC instants; display uses the business or user
  time zone.
- Created, changed, finalized, cancelled, and effective times have distinct meaning.

## Lifecycle invariants

- Issued document facts are immutable; corrections create a new version or explicit reversal.
- Money always carries currency and cannot be summed across currencies without a recorded rate.
- A payment allocation cannot exceed the usable payment amount.
- Workflow state changes are commands with guarded transitions, not direct status writes.
- Derived totals can be recomputed from versioned inputs.
- Deletion is reserved for legally safe drafts; durable business records use cancellation or
  retention workflows.

## Events and audit

Domain events are facts in past tense, written to an outbox in the same transaction as state. Audit
records capture actor type and ID, tenant/business, action, target, before/after summary, reason,
source, request/correlation ID, and time. Audit data is not the event bus and cannot be edited
through product APIs.

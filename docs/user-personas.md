# User personas

Status: Accepted research hypotheses

Personas guide trade-offs; they are hypotheses until validated with research. Teams must not turn
them into stereotypes or use them as a substitute for accessibility testing.

## Owner-operator: Amina

- Runs one or two service businesses and approves high-impact work.
- Thinks in customers, jobs, cash, and commitments rather than ledger categories.
- Often works from a phone between other tasks.
- Needs: a trusted summary, exceptions first, clear commitments, and safe delegation.
- Failure: dashboards that demand interpretation or settings that expose implementation detail.

## Operations coordinator: Daniel

- Keeps documents and hand-offs moving across sales, delivery, suppliers, and customers.
- Handles high volume and frequent exceptions.
- Needs: queues, bulk-safe actions, assignments, reminders, and visible responsibility.
- Failure: status names that do not explain the next action.

## Approver: Noor

- Reviews only selected purchases, invoices, or discounts.
- Uses bizOS intermittently and has little tolerance for navigation.
- Needs: what changed, why approval is needed, evidence, impact, and one decision surface.
- Failure: approval by ambiguous email link or unexplained totals.

## Finance specialist: Ravi

- Validates tax, numbering, reconciliation, and exports.
- Accepts precision and detail but needs it separated from everyday flows.
- Needs: explainable calculations, immutable issued facts, controlled corrections, and audit export.
- Failure: friendly labels that conceal the formal meaning or prevent reconciliation.

## External contact: Customer or supplier

- Receives a link or document without being a regular product user.
- Needs: identity confidence, mobile access, clear amount/date/action, and minimal data exposure.
- Failure: requiring an account for a simple view or exposing unrelated business data.

## Integration developer

- Connects CRM, payment, tax, or industry tools.
- Needs: stable contracts, sandboxing, idempotency, webhooks, scoped credentials, and trace IDs.
- Failure: undocumented behavior or UI-only capabilities.

## Agent operator

- Delegates bounded work to an AI assistant.
- Needs: visible scope, preview, evidence, approval, and revocation.
- Failure: agents acting under platform authority or silently changing business records.

## Research plan

Before a product workflow moves from discovery to build, validate terminology, task sequence, error
recovery, mobile use, and permission expectations with at least one owner, operator, intermittent
approver, and finance specialist from the target market.

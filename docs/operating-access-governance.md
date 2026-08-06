# Operating and access governance

Status: Proposed for product-owner approval

Last updated: 2026-07-28

## Business privacy

Each business is a private scope. A user's membership, role, data visibility, and allowed UI are
evaluated inside that scope. Membership in one business grants no access to another business.

## Access request workflow

1. An accountant, partner, auditor, or bizOS support member requests access to a named business.
2. The request declares a role, purpose, scope, and expiry.
3. A business owner or business administrator approves or denies it.
4. The platform records the request, decision, actor, time, and resulting grant.
5. Access expires automatically unless renewed.

## Role defaults

| Role                   | Default authority                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Owner                  | Full control of their business, including administrators and sensitive financial actions.    |
| Business Administrator | Team, permitted settings, workflows, and normal operations; no platform-wide administration. |
| Staff                  | Only assigned operational modules and records.                                               |
| Accountant             | Financial records, ledger, statements, tax preparation, and permitted payment work.          |
| External Auditor       | Read-only evidence, records, and exports for the approved business scope.                    |
| System Administrator   | Platform packs, operations, and commercial entitlements; no routine customer-data access.    |

## Commercial overrides

System Administrators may grant a business complimentary access, a negotiated discount, fixed
contract price, included service, tailored package, or credit grant. Every agreement must record the
normal price, agreed terms, reason, approver, currency, start, expiry or review date, and audit
trail. It must not weaken compliance, authorization, or data-isolation rules.

## Incident support

When support needs customer-data access, use a time-limited grant approved by the business unless an
applicable emergency process authorizes otherwise. Record the justification, actions, and closure.
Never use a standing administrator backdoor as routine support access.

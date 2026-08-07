# Harden payment state-transition authorization

Date: 2026-08-07

Agent: chatgpt-gpt-5.6-thinking

Scope: apps/api/src/payments, apps/api/src/security

Status: Complete — GitHub CI verified

Related:
[2026-08-07 — Harden payment boundary and runtime artifact handling](./2026-08-07-harden-payment-boundary-and-runtime-artifacts.md)

## Context

A post-merge independent review of payment authorization found that `markAsCompleted` and `reverse`
used the generic `payments:update` action. Because MEMBER and STAFF roles legitimately have update
access for editable draft payment records, the same permission also allowed them to finalize and
reverse financial state transitions.

## What changed

- Added explicit `complete` and `reverse` authorization actions.
- Added `payments:complete` and `payments:reverse` only to OWNER and ADMIN policies.
- Changed payment completion and reversal service paths to require those dedicated actions.
- Added authorization-policy tests proving MEMBER, STAFF, and ACCOUNTANT cannot complete or reverse
  payments while OWNER and ADMIN can.
- Added payment-service tests proving the correct transition-specific actions are requested.

## Decision

Draft editing and financial finalization are separate capabilities. MEMBER and STAFF keep existing
payment create/read/update access, but completion and reversal require OWNER or ADMIN authority.
This is a least-privilege change and does not expand any role.

## Verification

GitHub Actions validated the implementation at review head
`f27a403716670174cc1d4d56c4968c4a695fdbea`.

```text
Dependency review run 31133327176       # passed
CodeQL run 31133327157                  # passed — TypeScript analysis
Container build run 31133327702         # passed — API image and web image
CI run 31133327118                      # passed
  dependency audit                      # no known vulnerabilities
  database migrations                   # all 10 applied; schema up to date
  pnpm check                            # passed
    formatting and documentation links  # passed
    tracked runtime artifact guard      # passed
    local service security checks       # passed
    lint and TypeScript                  # passed
    unit and integration tests          # passed
    Prisma validation and builds        # passed
  Playwright desktop/mobile journeys    # passed
```

The final branch diff was also reviewed after removal of the temporary metadata workflow. It
contains only the two authorization/service files, their tests, and journal metadata.

## Follow-ups

1. Track transaction-safe cumulative allocation limits in
   [issue #59](https://github.com/pmwasim/bizOS/issues/59) before treating payment settlement as a
   full accounting-control boundary.
2. Revisit role policy only when product requirements explicitly authorize additional roles to
   complete or reverse financial movements.

## Handoff notes

Working branch: `agent/payment-state-transition-authz`, pull request #58. The implementation is
validated and ready for review/merge. No production deployment, secret change, data mutation outside
CI, or history rewrite was performed.

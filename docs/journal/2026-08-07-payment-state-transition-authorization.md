# Harden payment state-transition authorization

Date: 2026-08-07

Agent: chatgpt-gpt-5.6-thinking

Scope: apps/api/src/payments, apps/api/src/security

Status: In progress — GitHub CI pending

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

```text
GitHub CI pending
```

## Follow-ups

1. Validate formatting, lint, TypeScript, tests, builds, CodeQL, and Playwright in GitHub Actions.
2. Review transaction-safe cumulative allocation limits before treating payment settlement as a full
   accounting-control boundary.

## Handoff notes

Working branch: `agent/payment-state-transition-authz`. Do not merge until CI is green. No
production deployment, secret change, data mutation, or history rewrite was performed.

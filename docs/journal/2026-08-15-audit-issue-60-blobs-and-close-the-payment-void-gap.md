# Audit issue 60 blobs and close the payment void gap

Date: 2026-08-15

Agent: claude-cowork

Scope: apps/web/src

Status: Complete

Related: issue #60, PR #96, PR #97, PR #95,
`2026-08-15-close-the-two-open-pr94-findings-and-record-a-production-res.md`

## Context

With the release stable and no open PRs, I picked the two highest-value things that could be done
safely: the only open issue, and a search for more instances of the bug patterns that had already
produced three production defects this week.

## What changed

### Issue #60 — audited, no purge recommended (PR #96)

#60 tracks historical runtime object-store blobs still reachable from old commits, and states that a
history rewrite is deliberately **not** authorised by the issue itself. So the deliverable was the
inventory and classification, not the rewrite.

Three distinct blobs, about 5 KB total, reachable from `7f286d4` and `c242eb2`. Not reachable from
`origin/main` or from any of the four release tags.

They are end-to-end test output, on two independent lines of evidence: the visible text carries
`PO Services` — the business name `e2e/po-approval-readiness.spec.ts` generates — and the only email
addresses are on `example.test`, an IANA-reserved domain; and neither tenant nor business public ID
in the paths exists in the production database. No tax IDs, postal addresses, signature wording,
phone numbers, credentials, or secrets.

Recommended closing without a rewrite. `filter-repo` across all refs, a coordinated force update to
a protected branch, and invalidating every clone and fork is disproportionate to three test files
containing nothing personal. Posted the finding on the issue and **left it open** — the issue says
execution requires an explicit maintenance decision, and that decision is the owner's, not mine.

The classification script printed verdicts rather than document text, so recording the audit does
not republish whatever the blobs contain.

### A payment could not be undone (PR #97)

Swept for the shape behind #95 — component, action and route all present but nothing rendering the
component. Three components are unrendered; one is a real defect.

`VoidPaymentButton`, `voidPaymentAction` and `PATCH :paymentId/status/reverse` all existed, and the
payment detail page had no void UI of any kind. A mis-keyed payment stayed on the customer's balance
permanently with no route to reverse it short of a database edit. Now rendered, gated on
`COMPLETED`, which is the transition the API actually permits.

The form also collected a "Reason" field that `voidPaymentAction` deliberately never sends, because
the API stores no reason. Replaced with a line explaining what voiding does — asking for a reason
that is silently discarded is worse than not asking.

## Decisions and trade-offs

**Audited but did not purge, and did not close the issue.** The evidence is strong enough that I was
confident in the recommendation, but a public-history rewrite changes every commit identity and
breaks every clone and fork, and #60 explicitly reserves that call. Doing the analysis and handing
over the decision is the whole value here; making the call myself would have been the one
irreversible step in an otherwise reversible session.

**Recorded the audit's own false positive.** A first coarse pass reported "20 plausible phone
numbers" per invoice; the regex had fallen back to scanning raw PDF bytes and was matching object
offsets. Against rendered text the count is zero. That correction is in the document rather than
quietly dropped — a sensitivity audit that hides its own misfires is not worth trusting.

**Left two unrendered components alone.** `CustomFieldsRenderer` and `TemplateMigrationDiffPreview`
came out of the same sweep. Neither has an obvious intended home, and wiring a configuration or
admin surface on a guess is a product decision, not a bug fix. Reported, untouched.

## Verification

```text
pnpm lint                                  pass
pnpm --filter @bizo/web exec tsc --noEmit  pass
pnpm --filter @bizo/web build              payments/[paymentId] emitted
pnpm docs:check                            all local Markdown links resolve
```

Blob classification used `pdftotext` against blobs extracted to `/tmp`, deleted afterwards. Tenant
and business existence was checked read-only against the production database.

**The payment void has no e2e coverage.** Reaching a `COMPLETED` payment needs a full quotation →
invoice → send → record-payment chain the suite does not have; the existing journeys stop at the
invoice. Stated plainly on the PR rather than left implied.

## Follow-ups

- **Issue #60 is awaiting your decision**, not blocked on more analysis.
- **No e2e reaches a recorded payment.** That chain is the single biggest coverage gap left in the
  suite, and it covers the most revenue-sensitive path in the product.
- `CustomFieldsRenderer` and `TemplateMigrationDiffPreview` are unrendered; decide whether they have
  a home or should be deleted.
- Unchanged from earlier entries: `valid_until` should not be NOT NULL for non-quotation documents,
  the `as unknown as` casts across the phase-1 services defeat type checking, ADR-0022 is used
  twice, three module headings do not match their nav labels, `/opportunities` has no nav entry, and
  Prisma Compute Deploy fails on every PR without being a required check.

## Handoff notes

Claims released.

- A sweep worth repeating after any feature lands: list every exported component under
  `apps/web/src/components` and grep for uses elsewhere. Two real production defects this week were
  a component, an action and a route that all existed and were never connected, and both were
  invisible to typecheck, lint, and the whole test suite.

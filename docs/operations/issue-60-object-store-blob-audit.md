# Issue #60 — historical object-store blob audit

**Date:** 2026-08-15 **Scope:** audit and classification only. No history was rewritten and none is
recommended. **Verdict:** the historical blobs are automated end-to-end test artifacts. **No purge
required.**

Issue #60 asks for an inventory and sensitivity classification of the runtime object-store blobs
that remain reachable from older commits, and states explicitly that a history rewrite is _not_
authorised by the issue itself. This document is that inventory and classification.

## Inventory

Three distinct blobs, reachable from two commits on `origin`:

| Commit    | Date       | Subject                                                                |
| --------- | ---------- | ---------------------------------------------------------------------- |
| `7f286d4` | 2026-08-06 | feat(repo): implement payment module, keep-warm middleware, …          |
| `c242eb2` | 2026-08-07 | fix(payments): enforce authorization and block runtime artifacts (#55) |

| Blob      | Bytes | Path (under `apps/api/.data/object-store/…`)           |
| --------- | ----- | ------------------------------------------------------ |
| `48d86e1` | 2 509 | `tenants/26aae814…/…/invoices/…/invoice.pdf`           |
| `4f22216` | 2 507 | `tenants/a67a043d…/…/invoices/…/invoice.pdf`           |
| `cc9c5e0` | 45    | `tenants/26aae814…/…/approval-evidence/…/approval.pdf` |

Reachability today:

- `origin/main` — **0** such paths.
- All four release tags (`v0.1.0-beta.1` … `v0.3.0-beta.1`) — **0** each.
- Reachable only by walking to the two commits above.

Current-tree prevention is already in place and was verified: `.gitignore` line 28 ignores
`apps/api/.data/`, and `scripts/check-tracked-runtime-artifacts.mjs` fails the `pnpm check` gate if
any such file is ever tracked again.

## Classification

Text was extracted with `pdftotext` and matched against category patterns. Only verdicts were
recorded — no document text was printed into any log, commit message, or issue comment.

| Signal                       | invoice A                   | invoice B      | approval         |
| ---------------------------- | --------------------------- | -------------- | ---------------- |
| Visible text                 | 408 chars                   | 406 chars      | none (45 B stub) |
| Email addresses              | 1                           | 1              | 0                |
| **Email domain**             | `example.test`              | `example.test` | —                |
| Phone numbers                | 0                           | 0              | 0                |
| Tax / VAT / registration IDs | 0                           | 0              | 0                |
| Postal address wording       | no                          | no             | no               |
| Signature wording            | no                          | no             | no               |
| Monetary amounts             | 3                           | 3              | 0                |
| Fixture names present        | "PO Services", "Consulting" | same           | —                |

Two independent lines of evidence say these are test output, not customer documents:

1. **The content is fixture data.** "PO Services" is the business name
   `e2e/po-approval-readiness.spec.ts` generates (`PO Services ${runId}`), and the only email
   addresses are on `example.test` — an IANA-reserved domain that cannot route to a real person.
2. **The subjects do not exist.** Neither tenant public ID (`26aae814…`, `a67a043d…`) nor either
   business public ID (`6d1e9613…`, `f70ace9e…`) is present in the production database. They came
   from an ephemeral environment, not from a live customer.

An earlier coarse pass flagged "20 plausible phone numbers" per invoice. That was a false positive:
the regex had fallen back to scanning raw PDF bytes and was matching object offsets. Against the
actual rendered text the count is zero. Recorded here because a sensitivity audit that quietly drops
its own false positives is not worth trusting.

## Recommendation: do not rewrite history

The remediation issue #60 contemplates — `git filter-repo` across all refs, coordinated force
updates to a protected branch, invalidating clones and forks — is disproportionate to three
test-generated files totalling about 5 KB that contain no personal, customer, tax, signature, or
financial information.

A rewrite on a public repository has real costs: every existing clone and fork breaks, every commit
identity below the rewrite point changes, and open branches have to be recreated. Those costs buy
nothing here.

**Recommended disposition:** close #60 as audited, with this document as the record. Reopen only if
the classification is later shown to be wrong.

If a purge is nonetheless wanted as a matter of policy, the prerequisites in the issue still stand —
back up first, record the pre-rewrite reference map (the two commits above), coordinate the
protected-branch update, and re-verify `main`, tags, open PR branches, and CI afterwards.

## What was not found

No credentials, tokens, or secrets. The audit looked for them; nothing surfaced, so no rotation is
required.

## Reproducing this audit

```bash
# Which commits carry the path
git log --oneline --remotes=origin -- "apps/api/.data/object-store/**"

# The distinct blobs and their sizes
for c in $(git rev-list --remotes=origin); do
  git ls-tree -r --long "$c" -- "apps/api/.data/object-store" 2>/dev/null
done | sort -u -k3,3

# Extract text for classification (do not commit the output)
git cat-file blob <blob> > /tmp/blob.pdf && pdftotext /tmp/blob.pdf -
```

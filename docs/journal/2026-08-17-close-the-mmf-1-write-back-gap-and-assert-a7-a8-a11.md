# Close the MMF-1 write-back gap and assert A7, A8, A11

Date: 2026-08-17

Agent: claude-cowork

Scope: docs, apps/api/src/statements

Status: Ready for review

Related: [MMF](../mmf.md),
[ADR-0024](../decisions/0024-receivables-and-statements-are-derived-per-currency.md), previous entry
[define the MMF and deliver "Money customers owe"](2026-08-17-define-the-mmf-and-deliver-money-customers-owe.md)

## Context

The request was, again, to define an MMF for bizOS and implement it. That work already existed:
`docs/mmf.md` defines the term and records MMF-1, and the previous entry delivered it. So this
session audited what was actually on disk instead of rebuilding it.

Two gaps turned up, both created by the way the previous session finished. It ran against a sandbox
clone and wrote the files back afterwards, and its own handoff notes flagged that the working tree
had never been gate-verified in place.

## What changed

**The write-back was incomplete.** `git apply --check --reverse mmf-1-money-customers-owe.patch`
failed on one path: the patch deletes `apps/web/src/components/statements-client-view.tsx`, and the
file was still present. Every other hunk had landed. The component was orphaned — nothing imported
it — but it still held the 40/30/15/10 percentage ageing, `INV-1001 / 150000`, and
`BILL-2001 / 85000`. That is the exact artefact MMF-1's in-scope item 5 exists to remove, sitting in
the tree while the document claimed it was gone. Deleted with `git rm`; the patch now reverses
cleanly, so the tree and the recorded change agree.

**Three acceptance criteria were claimed but not asserted.** `docs/mmf.md` said A1–A10 were covered
by `statements.service.spec.ts`. Grepping the suite for `reversed`, `void`, `split`, and `share`
returned nothing, and the only `payments:read` assertion was against `customer()`.

- **A7** — a reversed payment settles nothing. `load()` filters `payment: { status: "COMPLETED" }`
  and a comment says so, but nothing asserted it. Added a test on `receivables()` asserting the
  filter, so removing it fails the suite rather than silently hiding a real debt.
- **A8** — a split payment credits only its share. Added a test with one receipt of 50000 spread
  20000/30000 across two invoices in different ageing buckets, asserting each invoice keeps its own
  remainder and lands in its own bucket.
- **A11** — `payments:read` on the business-wide view. `authorize()` is called by both methods, but
  only `customer()` was asserted. Added the matching assertion for `receivables()`.

`apps/api/src/statements/` goes from 26 tests to 29.

**Documentation.** `docs/mmf.md` Verification now reads A1–A11, states why A12 has no test (the
surface is server-rendered, so no client error path exists in which substitute data could be
returned), and records that a criterion claimed but unasserted is the same class of defect as a
fabricated number on screen.

## Decisions and trade-offs

- **Deleted the orphaned component rather than leaving it unreferenced.** It was already unreachable
  and would not have changed behaviour. But test 4 of the MMF definition is about what the
  repository contains, not only what renders: the next agent to need a statements view would have
  found a plausible-looking one and reused it. No ADR — this implements ADR-0024, it does not change
  it.
- **Asserted A7 through the query filter, not through a reversed-payment fixture.** `buildService`
  mocks `findMany` to return whatever it is handed, so feeding it a REVERSED row would prove nothing
  — the mock has no `where` semantics. The filter is the actual control, so the filter is what the
  test pins. Noted here because the fixture shape invites the other approach.
- **Did not touch the four other fabricated-data surfaces.** `inventory-client-view.tsx`,
  `projects-client-view.tsx`, `credit-notes-client-view.tsx`, and the CRM activity feed still carry
  the same pattern. They are outside MMF-1's claim and each needs its own slice; sweeping them here
  would have made this change unreviewable. Carried forward below.

## Verification

Run in the working tree at `0025523` with the MMF-1 changes applied, `NODE_ENV` unset.

```text
git apply --check --reverse mmf-1-money-customers-owe.patch   # passed after the deletion
pnpm check                                                    # passed, exit 0
pnpm test --force                                             # passed, uncached, 18/18 tasks
pnpm --filter @bizo/api exec vitest run src/statements/       # passed, 29 tests, 2 files
```

The first `pnpm check` reported `FULL TURBO` from cache, so it was re-run with `--force` to confirm
the suite actually executed against these files rather than replaying a hit. `Error: smtp down` in
the API test output is an expected error-path assertion, not a failure.

Not run: the Playwright e2e suite, and anything needing PostgreSQL, Redis, or SMTP.

Not verified: behaviour against real data in a deployed environment. Unchanged from the previous
entry — the acceptance criteria are proven as logic against mocked rows, not as evidence.

## Follow-ups

- **Release blocker, unchanged and still open.** The Starter plan sells "statements" as shipped. It
  is honest only once MMF-1 is verified against real data in a deployed environment. Until that
  evidence exists the claim should read as beta scope.
- **`mmf-1-money-customers-owe.patch` is untracked in the repository root.** It is a scratch
  artefact of the sandbox round trip and should not be committed. It was useful here precisely
  because it caught the missing deletion, so delete it only once this change is committed.
- The four remaining fabricated-data surfaces named above, as one audit pass.
- ADR-0023 and ADR-0024 are both `Proposed`. Marking an ADR `Accepted` needs a human.
- Nothing here is committed. This session edited the working tree directly; `main` is still at
  `0025523` and the MMF-1 change plus this one are staged and unstaged work on top of it.

## Handoff notes

- Start by reading the previous entry; this one only closes gaps in it and does not restate the
  slice.
- The gate passes and the tree now reverses cleanly against the patch, so what is on disk and what
  the previous entry describes finally agree. That was not true before this session.
- `buildService` in `statements.service.spec.ts` mocks `findMany` without `where` semantics. Any
  criterion about which rows are _selected_ has to be asserted on the query arguments; only criteria
  about how selected rows are _combined_ can be asserted through returned data. Both styles are now
  in the file next to each other.
- No claim was taken with `pnpm agent:claim`; this ran as a single-agent session against the working
  tree. Claim first if another agent may be active.

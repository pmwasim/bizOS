# Catch up production, activate autodeploy, require PR on main

Date: 2026-09-02

Agent: composer-main-gap

Scope: docs

Status: Complete

Related: [ADR-0027](../decisions/0027-autonomous-gated-production-deploy.md),
[ADR-0014](../decisions/0014-single-maintainer-branch-protection.md),
[2026-09-02 autonomous deploy](2026-09-02-autonomous-deploy-with-kill-switch.md), board `b_faa0e250`
/ `b_64340629`

## Context

`bizos-production` had diverged from `origin/main` (ahead 1 orphan banner SHA / behind 14).
Autodeploy was installed and ticking but deliberately not activated — `activate` refuses while the
gap exceeds `MAX_AUTO_COMMITS=5`. An evidence audit confirmed the gap (docs still said 11), additive
migrations only, and a commit-protection gap: eight tip commits had landed as direct pushes with no
PR gate. Owner board decisions (`b_faa0e250`, `b_64340629`) plus instruction to do what is best for
bizOS: catch up then activate, and require PRs on `main` with zero required approvals (ADR-0014
solo).

## What changed

Host / GitHub (already applied before this docs PR):

- Manual catch-up:
  `scripts/ops/deploy-production.sh --sha 7c2c3ccee127a032b8141d61b256f2232bb52d8a --confirm` — four
  additive Prisma migrations applied, api/web restarted, release-readiness 14/14.
- `scripts/ops/deploy-kill-switch.sh activate` — autonomous timer armed; prod gap 0.
- GitHub `main` protection: require pull request before merging,
  `required_approving_review_count: 0`; existing required checks / linear history / no force-push /
  conversation resolution preserved. `enforce_admins` left off.

In this PR: runbook activation section, ADR-0027 → Accepted, ADR-0014 / github-governance wording
aligned with the live require-PR setting, journal index.

## Decisions and trade-offs

- Chose catch-up + activate over “catch-up only” because the manual deploy already exercised the
  full engine; leaving autonomy off only reintroduces delay ADR-0027 rejected.
- Did not raise `MAX_AUTO_COMMITS` to swallow the backlog.
- Tip GH Quality gate can still be red on `pnpm security:audit` (mysql2 via Prisma CLI; runtime is
  PostgreSQL). Local deploy gate is `pnpm check` and passed; audit cleanup is a follow-up.

## Verification

```text
deploy-production.sh --sha 7c2c3cc… --confirm   # success; 14/14 release-readiness
git -C bizos-production rev-list --count HEAD..origin/main   # 0
deploy-kill-switch.sh activate / status          # activated
curl https://bizos.qloudihub.com/                # 200
gh api …/branches/main/protection                # reviews count 0, PR required, 5 checks
```

## Follow-ups

- Clear tip `pnpm security:audit` red (mysql2 / qs / fast-uri).
- Optional later: `enforce_admins` on main.
- Circuit-breaker trip path still never observed end-to-end.
- Stale “Database restoration” section in the production runbook still needs investigation.

## Handoff notes

- Autodeploy is live; tip moves on `main` within 5 commits deploy unattended.
- Kill switch: `scripts/ops/deploy-kill-switch.sh on`.
- Direct pushes to `main` should be rejected; use a PR (0 approvals required).
- Claim `clm_d7b1e579` (docs) — release after this PR lands.

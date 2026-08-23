# Repair recurring production health false failures

Date: 2026-08-23

Agent: codex-prod-health-20260823

Scope: .github/workflows

Status: Complete

Related: `2026-08-15-merge-pr81-and-cut-production-over-to-the-production-build.md`

## Context

The scheduled `Production health` workflow failed repeatedly on `main`. GitHub Actions logs for runs
32620449049 and 32619191916 showed the API probe passing and every web probe returning HTTP 403.
Local checks showed the API and web services healthy, while the public hostname is served through an
edge path that denies the GitHub runner.

## What changed

- `.github/workflows/production-health.yml` now loads the `production` environment and probes the
  configured `WEB_ORIGIN_HOST` as the authoritative web check. It also records a public-host 403 as
  a warning while failing on other public-edge errors.
- `docs/operations/monitoring.md` documents the origin/public-edge split and the requirement to keep
  `WEB_ORIGIN_HOST` aligned with production ingress.

## Decisions and trade-offs

The workflow does not treat the known GitHub-datacenter 403 as an application outage, because the
origin probe succeeds and the same public URL is reachable from ordinary clients. A direct DNS/WAF
or tunnel repair was not performed in this repository change; the diagnostic warning keeps that
external issue visible. No ADR is needed because this changes monitoring implementation, not system
architecture.

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm exec prettier --check .github/workflows/production-health.yml docs/operations/monitoring.md docs/journal/2026-08-23-repair-recurring-production-health-false-failures.md docs/journal/README.md
# passed
pnpm docs:check
# passed: all local Markdown links resolve
pnpm agent:verify
# passed: graph current and journal valid; an old duplicate claim still needs release
curl checks against the configured web origin and public URL
# passed from this host: origin HTTP 200 and public HTTP 200
gh run view 32620449049 --log-failed
# passed investigation: API step passed; web step returned HTTP 403 on all five attempts
pnpm check
# failed at format:check on 48 pre-existing/unrelated files; scoped files were formatted
pnpm lint
# failed on pre-existing AI and graphify-obsidian changes (7 errors)
pnpm typecheck
# failed on pre-existing AI test changes: RequestInfo is undefined in zero-budget-ai.provider.spec.ts
PR #120 CI Quality gate (run 32621675939)
# failed in unrelated existing E2E baseline: 8 desktop/mobile tests timed out waiting for the old
# onboarding heading; 2 tests passed. Focused build, TypeScript, CodeQL, dependency, and container
# checks passed.
```

## Follow-ups

Work this session deliberately left open, each with enough detail to be actionable by someone who
was not here. Mark anything that blocks a release.

- The public edge still returns HTTP 403 to GitHub datacenter runners in recorded workflow runs. The
  new workflow warns on that known condition and fails on other public-edge errors. Repair the
  DNS/WAF/tunnel path separately if GitHub-runner public reachability is required.
- The production environment's `WEB_ORIGIN_HOST` must remain aligned with the actual production
  ingress.
- PR #120 is open but merge-blocked by the required Quality gate's unrelated E2E failures. Do not
  bypass the gate; repair the onboarding/E2E baseline separately, then rerun the PR checks.

## Handoff notes

The authoritative web probe now reads `vars.WEB_ORIGIN_HOST` from the `production` environment. Do
not remove the public-edge diagnostic without replacing its visibility elsewhere. The scoped claim
is still held until the final handoff is complete.

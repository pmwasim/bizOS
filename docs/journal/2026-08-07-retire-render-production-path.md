# Retire obsolete Render production path

Date: 2026-08-07

Agent: chatgpt-gpt-5.6-thinking

Scope: production deployment workflow, Ubuntu operations documentation, hosting ADR, environment
documentation

Status: In progress — repository correction implemented; final CI pending

Related:
[Issue #56 — Production `/signin` returns a stale Next.js 404](https://github.com/pmwasim/bizOS/issues/56)

## Context

While investigating a production `/signin` 404, historical repository documentation and the active
`production-deploy.yml` workflow indicated that bizOS production ran on Render. That led the agent
to follow the obsolete Render deployment path.

The product owner then explicitly corrected the hosting state: **current bizOS production runs on an
Ubuntu desktop and is not using Render**.

Further source review confirmed that `/signin` already exists at
`apps/web/src/app/(auth)/signin/page.tsx`, including in an older beta release. The live 404 is
therefore a production Ubuntu runtime/origin drift problem rather than a missing source page.

## What changed

- Removed the active Render-specific `.github/workflows/production-deploy.yml` from the branch.
- Added `.github/workflows/production-release-gate.yml`, a validation-only manual gate for an exact
  Git SHA. It runs dependency audit, test-database migrations, `pnpm check`, and Playwright but has no
  production hosting credentials and performs no production deploy or production migration.
- Rewrote `docs/operations/ubuntu-cutover-handoff.md` as the current Ubuntu production handoff.
- Added ADR-0022 recording Ubuntu as the authoritative production host and Render as retired.
- Updated the ADR index.
- Marked the old Render keep-warm environment variables as legacy rather than current production
  guidance.
- Corrected issue #56 to the Ubuntu deployment model and closed duplicate issue #65.
- PR #64 was merged after all permanent checks passed, adding desktop/mobile Playwright coverage
  that requires `/signin` to return HTTP 200 and render its credential form.
- PR #67 was merged after all permanent checks passed, extending read-only release readiness to
  require `/signin`, `/signup`, and the repository custom not-found page. The current script was
  synced onto this branch so final validation covers the same tree that will result after merge.
- Closed stale draft PR #57 as superseded by #67.

## Decision

Production operations must follow the actual Ubuntu host. Historical provider configuration may
remain in Git history for audit, but a retired provider must not remain an executable production
mutation path.

When current Ubuntu runtime details are unavailable, agents must stop at read-only discovery rather
than inventing a checkout path, process manager, port, container name, or Cloudflare origin.

Repository automation may validate a release candidate but must not report it as deployed until the
actual Ubuntu runtime and public hostname are independently verified.

## Verification

Completed before final validation of this operations PR:

```text
PR #64 dependency review             # passed
PR #64 CodeQL                        # passed
PR #64 API/web container builds      # passed
PR #64 full CI and Playwright        # passed
PR #64 squash merge                  # d8c1fbf1ea1c57fd0e72ce72ccc672ecabb3c417

PR #67 dependency review             # passed — run 31136229693
PR #67 CodeQL                        # passed — run 31136229657
PR #67 API/web container builds      # passed — run 31136229630
PR #67 full CI and Playwright        # passed — run 31136229762
PR #67 squash merge                  # 809d5715be42bc0684bef6dc968d0c749f1c4de2
```

The operations retirement branch requires one final permanent-workflow pass after its generated
agent metadata and journal index are refreshed with the validation-only release-gate workflow.

Production `/signin` has **not** been declared fixed. This ChatGPT environment has no authenticated
shell/SSH execution channel to the Ubuntu production desktop, and the exact current checkout path,
process manager, local origin port, and Cloudflare origin mapping have not yet been recovered from
repository or connected-source evidence.

## Follow-ups

1. On the Ubuntu host, execute the read-only discovery steps recorded in issue #56 and the Ubuntu
   handoff.
2. Record the actual production checkout path, process manager/container names, ports, Cloudflare
   origin mapping, deployed SHA, and rollback command.
3. Run the validation-only production release gate for the exact candidate SHA before rollout.
4. Build the current approved source, update/restart the existing Ubuntu web deployment using its
   established mechanism, and run release readiness against the local origin before public
   verification.
5. Review and remove obsolete Render provider resources/secrets separately; do not expose or delete
   credentials as part of this repository correction.

## Handoff notes

Working branch: `ops/retire-render-production-path`.

Do not use Render for bizOS production. Issue #56 is the authoritative incident record. No Ubuntu
production process was restarted, no Cloudflare route was changed, and no production secret was read
or modified in this session.

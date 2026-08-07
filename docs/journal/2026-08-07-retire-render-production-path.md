# Retire obsolete Render production path

Date: 2026-08-07

Agent: chatgpt-gpt-5.6-thinking

Scope: production deployment workflow, Ubuntu operations documentation, hosting ADR, environment
documentation

Status: In progress — repository correction implemented; CI pending

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
- Rewrote `docs/operations/ubuntu-cutover-handoff.md` as the current Ubuntu production handoff.
- Added ADR-0022 recording Ubuntu as the authoritative production host and Render as retired.
- Updated the ADR index.
- Marked the old Render keep-warm environment variables as legacy rather than current production
  guidance.
- Corrected issue #56 to the Ubuntu deployment model and closed duplicate issue #65.
- Separately, PR #64 was merged after all permanent checks passed, adding desktop/mobile Playwright
  coverage that requires `/signin` to return HTTP 200 and render its credential form.

## Decision

Production operations must follow the actual Ubuntu host. Historical provider configuration may
remain in Git history for audit, but a retired provider must not remain an executable production
mutation path.

When current Ubuntu runtime details are unavailable, agents must stop at read-only discovery rather
than inventing a checkout path, process manager, port, container name, or Cloudflare origin.

## Verification

Completed before opening the operations PR:

```text
PR #64 dependency review             # passed
PR #64 CodeQL                       # passed
PR #64 API/web container builds     # passed
PR #64 full CI and Playwright       # passed
PR #64 squash merge                 # d8c1fbf1ea1c57fd0e72ce72ccc672ecabb3c417
```

The operations retirement branch still requires the repository quality gates after generated agent
metadata and the journal index are refreshed.

Production `/signin` has **not** been declared fixed. This ChatGPT environment has no authenticated
shell/SSH execution channel to the Ubuntu production desktop, and the exact current checkout path,
process manager, local origin port, and Cloudflare origin mapping have not yet been recovered from
repository or connected-source evidence.

## Follow-ups

1. On the Ubuntu host, execute the read-only discovery steps recorded in issue #56 and the Ubuntu
   handoff.
2. Record the actual production checkout path, process manager/container names, ports, Cloudflare
   origin mapping, deployed SHA, and rollback command.
3. Build the current approved source, update/restart the existing Ubuntu web deployment using its
   established mechanism, and verify `/signin` locally before public verification.
4. Complete draft PR #57 or an equivalent current change so release readiness checks `/signin`,
   `/signup`, and the custom not-found route.
5. Review and remove obsolete Render provider resources/secrets separately; do not expose or delete
   credentials as part of this documentation change.

## Handoff notes

Working branch: `ops/retire-render-production-path`.

Do not use Render for bizOS production. Issue #56 is the authoritative incident record. No Ubuntu
production process was restarted, no Cloudflare route was changed, and no production secret was read
or modified in this session.

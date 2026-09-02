# ADR-0026: Local, human-triggered production deploy script

Status: Superseded by ADR-0027  
Date: 2026-09-02  
Deciders: Product owner (acceptance pending — see Note on authority below)

**Superseded same-day**: the product owner explicitly asked for the human-approval-per-deploy
framing below to be reversed — a solo operator without deep ops expertise gets more safety from
strong, objective gates than from a person who can't meaningfully evaluate a deploy rubber-stamping
one anyway. See [ADR-0027](0027-autonomous-gated-production-deploy.md). The `--confirm` mechanism
and the deploy engine itself (`scripts/ops/deploy-production.sh`) introduced here are still in use —
only the "a human decides what ships" framing is superseded, not the gate/rollback design.

## Context

[ADR-0022](0022-ubuntu-production-hosting.md) moved production hosting to a single Ubuntu desktop
and explicitly deferred the deployment mechanism: "until the current Ubuntu runtime is inventoried,
production rollout remains a manual or externally controlled operation." Since then, every release
has been a manual sequence of `git checkout`, `pnpm build`, `prisma migrate deploy`, and
`systemctl restart`, run by hand and recorded after the fact in journal entries (see
[ubuntu-production-cutover.md](../operations/ubuntu-production-cutover.md)).

The repository has no self-hosted GitHub Actions runner, no webhook receiver, and no inbound path
from GitHub to the Ubuntu host — only the reverse (git pull from GitHub). GitHub Actions already
validates candidates (`production-release-gate.yml`) and probes the live site on a schedule
(`production-health.yml`), but cannot itself deploy here.

## Decision drivers

- A human decides what ships; the machine does the rest reliably (explicit product-owner
  instruction, 2026-09-02).
- Zero paid-API/infra cost — no new hosted runner, no new service.
- Deploys must be gated (never ship on a red quality gate) and reversible (automatic rollback on
  failed verification).
- Reuse the existing release-gate and release-readiness tooling rather than re-implementing checks.
- Memory on this box is a real, recent constraint (an OOM incident on 2026-08-30) — any new
  automation must check before it builds and abort rather than risk another one.

## Options considered

### Self-hosted GitHub Actions runner on the Ubuntu box

Rejected. Adds a persistent service with an inbound trust relationship to GitHub, a new attack
surface, and a new thing to keep patched — for a single-operator, single-host system. Not zero-cost
in complexity even though no dollars are spent.

### Fully autonomous deploy on green CI (auto-deploy on merge to `main`)

Rejected outright. Directly contradicts the instruction that a human approves what ships, and would
turn "commit to `main`" into "deploy to production," collapsing review and release into one step.

### A local script, run by hand on the host, gated by `--confirm`

Accepted. Matches the pattern already established by `~/bizos-maintenance/resume.sh` on this box.
Requires zero new infrastructure, keeps deploy authority with whoever runs the command on the box,
and composes with the existing release gate (validate on GitHub, deploy locally).

## Decision

1. `scripts/ops/deploy-production.sh` is the one production deploy/rollback mechanism for the Ubuntu
   host. It requires an explicit `--confirm` flag and is never invoked by a timer, cron, or CI job.
2. It only ships commits that are ancestors of `origin/main` (reviewed and merged), runs
   `pnpm check` as a hard pre-deploy gate, and refuses to build under memory pressure.
3. It takes a `pg_dump` before any migration, and automatically rolls back to the previous commit
   (rebuild + restart + reverify) if post-deploy verification fails.
4. Database migrations are never auto-reversed on rollback — forward repair only, per the existing
   runbook. This assumes migrations stay additive, as they have been to date.
5. `~/machine-monitor` (a pre-existing, zero-cost, rule-based watchdog on the host, outside this
   repo) is extended with a daily dependency audit and a 30-minute production-log error scan, rather
   than introducing a second monitoring system.

## Consequences

### Positive

- Fulfils the deferred item in ADR-0022: an actual, recorded checkout/restart/rollback mechanism now
  exists.
- A failed deploy self-heals to the last known-good commit without paging anyone at 3am.
- No new recurring cost, no new standing service.

### Negative / follow-ups

- Still single-host, single-operator: no protection against two people running the script at once
  (documented as an operational rule, not enforced by a lock).
- The script has not yet been run end-to-end against production in this session (see the journal
  entry for 2026-09-02) — its guard paths were exercised (bad SHA, missing `--confirm`, non-ancestor
  SHA, memory-guard arithmetic) but a full deploy was deliberately not triggered, per the
  instruction not to ship anything as a side effect of building the tooling.
- `docs/operations/production-runbook.md`'s "Database restoration" section still describes managed
  Prisma Postgres backups; production's database is now local Docker Postgres. That section predates
  this change and was not rewritten here — flagged, not fixed.

## Note on authority

AGENTS.md states agents may mark an ADR `Accepted` and deploy to production without asking.
`docs/multi-agent-protocol.md` lists both as things an agent does _not_ do. AGENTS.md declares
itself the single source of truth, but the contradiction is unresolved in the documents themselves.
This ADR is left `Proposed` rather than self-accepted, and the deploy script was built and
guard-tested but not run for a real production deploy in this session — both deliberately
conservative choices given that contradiction and the product owner's explicit "human decides what
ships" instruction. Flagged for the product owner to resolve which document governs.

## Validation and review trigger

Validate by running `scripts/ops/deploy-production.sh --sha <sha> --confirm` for a real release and
confirming: the gate blocks a deliberately broken commit, a successful deploy is verified and
recorded, and a deliberately-failing post-deploy check triggers automatic rollback. Review or
supersede this ADR if a second host/region is introduced, or if GitHub-to-Ubuntu automation becomes
desirable enough to accept the self-hosted-runner trade-off rejected above.

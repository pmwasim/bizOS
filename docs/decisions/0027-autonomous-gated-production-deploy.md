# ADR-0027: Autonomous, gated production deploy with a kill switch

Status: Proposed  
Date: 2026-09-02  
Deciders: Product owner

## Context

[ADR-0026](0026-local-gated-production-deploy-script.md) built the deploy engine
(`scripts/ops/deploy-production.sh`) around a `--confirm` flag framed as a human approval step: a
person decides what ships, the script does the rest. The product owner explicitly reversed that
framing the same day, in their own words:

> What I actually needs is a fully automated pipeline or workflow, with fully autonomous system. But
> you know a vehicle shall be driven by a human only if he got a break in it. But today humans got
> driverless vehicles, which runs on automations and AI. And that is much safer/better/advanced than
> human vehicle with human driver. What I mean is, I'm a solo individual human. I don't have much
> knowledge or capabilities on the operations running. The validations and approval gates are to be
> automated, with it's own with string tied and kill switch implemented.

The argument holds up on inspection. A human-approval gate is a safety control only if the human
approving it can meaningfully evaluate what they're approving. A solo operator without deep
operations expertise, asked to bless a deploy on the strength of "the gates passed," is not
exercising judgement — they're rubber-stamping a decision the gates already made, with the one thing
a rubber stamp adds being delay. The judgement has to live in the gates themselves, or it doesn't
exist.

## Decision drivers

- The approving human in this specific case cannot add judgement a well-built gate can't already
  encode — so the gate has to carry the real weight, not a human glancing at green checkmarks.
- Removing the human step must not remove safety. Every property the old `--confirm` step was
  informally standing in for — never ship on red, never ship an unreviewed pile of commits in one
  leap, always be able to undo, always be observable after the fact — has to be encoded explicitly
  instead of assumed.
- A runaway automated deploy loop is a worse failure mode than a slow one. Something has to stop it
  from retrying the same mistake against production repeatedly.
- There must be one obvious, fast way to stop everything, discoverable by someone who does not
  remember the internals of this system under pressure.
- Zero paid-API cost, no new standing infrastructure (still true from ADR-0026 — nothing here
  changes the "no self-hosted runner, no inbound webhook" decision, only who/what triggers the
  already-existing local engine).
- Some actions are irreversible or touch credentials/data in ways no gate can safely automate. Those
  stay out of the automated path entirely — not gated behind a person, excluded structurally.

## Options considered

### Keep the human `--confirm` gate (ADR-0026 as written)

Rejected per the direct instruction above, for the reasons given: the human step described here adds
no judgement this operator can actually apply, only delay.

### Fully autonomous, no cap, no breaker — trust the gates alone

Rejected. `pnpm check` + smoke tests catch code-quality regressions, not "someone merged eleven
commits nobody looked at together" or "the pipeline itself is broken and will keep retrying the same
failing deploy every 15 minutes forever." Gates answer "is this commit good," not "should this much
change ship in one unattended leap" or "should this keep trying." Those need their own, separate
controls.

### Autonomous with objective gates, a blast-radius cap, a circuit breaker, and a kill switch

Accepted. Four independent mechanisms, each answering a different question a human-approval step was
informally covering:

| Old human step covered                                                               | New mechanism                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Is this change safe to ship?"                                                       | `pnpm check` hard gate + post-deploy health/smoke verification, unchanged from ADR-0026                                                               |
| "Is this too much to ship at once?"                                                  | Blast-radius cap (`MAX_AUTO_COMMITS`) — a gap bigger than a handful of commits refuses to auto-deploy                                                 |
| "Should we keep trying if it's failing?"                                             | Circuit breaker — trips after 2 consecutive auto-deploy failures, stops retrying until a human clears it                                              |
| "Can I stop this if something looks wrong?"                                          | Kill switch — one file, one command, checked first every tick and again mid-deploy                                                                    |
| "Did today's 11-commit gap between `main` and production just get silently shipped?" | One-time activation gate — the autonomous timer does nothing at all until a human runs `activate`, which itself refuses while the gap exceeds the cap |

## Decision

1. `scripts/ops/autodeploy.sh`, run by `bizos-autodeploy.timer` (systemd `--user`, every 15
   minutes), polls `origin/main` and deploys automatically through the existing
   `deploy-production.sh` engine when: the kill switch is off, the timer has been activated, the
   circuit breaker is clear, and the gap to `origin/main` is within `MAX_AUTO_COMMITS` (5 — a
   starting heuristic for a solo operator's normal pace, not derived from anything; documented as
   such and easy to change).
2. **Kill switch**: `scripts/ops/deploy-kill-switch.sh on` (equivalently,
   `touch /home/wasim/bizos-backups/DEPLOY_HALT`) stops every automated deploy immediately — checked
   at the top of every script in this system, and again inside `deploy-production.sh` at its last
   safe checkpoint before touching the database or restarting a service, so flipping it mid-deploy
   stops the deploy at the next boundary rather than letting it finish. A halt is absolute for
   anything unattended; a human can still push one deliberate manual deploy through it with
   `--override-halt`.
3. **Circuit breaker**: two consecutive auto-deploy failures trip
   `/home/wasim/bizos-backups/DEPLOY_CIRCUIT_TRIPPED`, after which the timer does nothing until a
   human clears it (`deploy-kill-switch.sh reset-circuit`) or a manual deploy succeeds. A rollback
   that itself fails (production potentially down) writes the kill-switch halt file directly from
   inside `deploy-production.sh`, independent of the breaker — the strongest response for the worst
   case, not left to the wrapper's bookkeeping.
4. **Blast-radius cap and activation gate**: `MAX_AUTO_COMMITS=5`. `deploy-kill-switch.sh activate`
   is a one-time step that itself checks the gap and refuses if it's still too large — this is what
   keeps the current ~10-day/11-commit gap between `bizos-production` and `main` from being silently
   absorbed the moment this system goes live. Closing that gap remains a deliberate manual
   `deploy-production.sh --sha <sha> --confirm`, done once, by a human choosing to do it.
5. **Observability**: every deploy attempt (auto or manual) is recorded in
   `/home/wasim/bizos-backups/deploy-history.log`. `deploy-kill-switch.sh status` gives a plain-
   language summary of kill switch / circuit breaker / activation / recent deploys in one place.
   `~/machine-monitor`'s existing 30-minute status surface (`status.md`, the file that's already
   "read this first" for this box) now also reports a tripped breaker or an active halt, read-only.
6. **Kept out of the automated path entirely** (not gated behind a human — structurally excluded):
   - Destructive database operations. The pipeline only ever runs `prisma migrate deploy`
     (additive-only by project convention) and a `pg_dump` backup; nothing in it drops or truncates
     data, automated or not.
   - Credential/secret rotation. Never part of this pipeline before, still isn't.
   - Migration rollback. Documented policy stays "forward repair only" — an automated reversal of a
     schema change is exactly the kind of irreversible-if-wrong action no gate can safely green-
     light unattended.
   - Shipping past the blast-radius cap. The automation cannot do this at all, by construction, not
     because it asks and gets refused.

## Consequences

### Positive

- Routine deploys ship without anyone needing to be present, watching, or awake.
- Every safety property the old human step was informally providing now has an explicit,
  independently-testable mechanism instead of relying on a person's attention.
- A broken pipeline stops itself after two tries instead of hammering production indefinitely.
- Stopping everything is one command, documented prominently, verified to work even mid-deploy.

### Negative / follow-ups

- Four new pieces of state to reason about (halt, circuit, activation, fail-count) instead of one
  flag. Mitigated with a single `status` command that explains all of them in plain language.
- `MAX_AUTO_COMMITS=5` and `MAX_CONSECUTIVE_FAILURES=2` are both guesses, not measurements — flagged
  in the scripts themselves (`ponytail:` comments) as the first things to revisit once real usage
  gives better numbers.
- The circuit-breaker trip path (an actual auto-deploy failing) was not exercised end-to-end in this
  change — only reasoned through and code-reviewed — because doing so would mean deliberately
  breaking something against production to prove it. The kill switch, activation gate, blast-radius
  cap, and lock were all exercised for real (see the journal entry for 2026-09-02).
- This system has not yet been activated (`deploy-kill-switch.sh activate` was deliberately not run
  in this change — see Follow-ups in the journal entry). The current 11-commit gap must be closed by
  a deliberate manual deploy first.

## Note on authority

[ADR-0026](0026-local-gated-production-deploy-script.md) flagged an unresolved contradiction between
AGENTS.md (an agent may deploy to production without asking) and `docs/multi-agent-protocol.md` (an
agent does not trigger a production deploy). This ADR does not resolve that document-level
contradiction in general. What it does have is a direct, explicit, in-conversation instruction from
the product owner that routine deploys should run without a human approval step — which settles the
question for this specific class of action, from the person whose call it actually is, regardless of
which document an agent would otherwise default to. The boundaries this ADR keeps untouched
(destructive data operations, credential rotation, migration reversal) were not asked to move, and
haven't.

## Validation and review trigger

Validate by: confirming the kill switch halts a deploy already in progress (tested at a checkpoint,
not by killing the process); confirming `activate` refuses while the gap exceeds the cap (tested,
see journal entry); confirming the timer's own no-op tick is visible in `journalctl` (tested); and,
once activated, observing one real automatic deploy succeed end-to-end including its entry in
`deploy-history.log` and `machine-monitor`'s status surface. Review or supersede this ADR if the
operator's usage pattern outgrows the current caps, if a second deploy target/host is introduced, or
if the product owner's stance on unattended production changes again.

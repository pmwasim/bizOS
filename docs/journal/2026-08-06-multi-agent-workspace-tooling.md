# Multi-agent workspace tooling

Date: 2026-08-06

Agent: claude-opus

Scope: scripts/agent, docs/journal, docs/multi-agent-protocol.md, AGENTS.md, package.json

Status: Complete

Related: none — this entry establishes the journal itself

## Context

The repository had no mechanism for more than one AI agent to work in it safely. `AGENTS.md` carried
useful environment gotchas but no coordination protocol, there was no machine-readable map of the
monorepo, and nothing recorded why a previous session made the choices it made. Each new agent
started cold, crawled the tree to orient, and had no way to discover that another agent was already
editing the same area.

## What changed

Three artifacts and the tooling that maintains them.

**Repository graph** — `scripts/agent/graphify.mjs` scans the workspace members, resolves internal
dependency edges, computes dependency layers, counts source and test files per first-level source
area, resolves CODEOWNERS, indexes the decision records, and maps which handbook documents name each
workspace. It writes `.agent/graph.json` and `.agent/graph.md`. Both are committed so an agent can
orient by reading one file. The generator is deterministic — no timestamps, no git history, no
absolute paths — so `--check` can detect staleness by byte comparison.

**Work registry** — `scripts/agent/registry.mjs` holds advisory, expiring claims in
`.agent/registry.json`. Claims are refused when their path scopes overlap another agent's active
claim; overlap is prefix-based on the normalized scope root, so `apps/api/src` conflicts with
`apps/api/src/documents` but not with `apps/api/src/documents-archive`. Commands: `claim`, `check`,
`release`, `prune`, `status`.

**Development journal** — `docs/journal/` with `TEMPLATE.md`, a generated index, and
`scripts/agent/journal.mjs` (`new`, `index`, `check`, `latest`). `check` enforces the required
header fields and sections, and refuses an entry marked `Complete` that still contains a
placeholder.

Supporting changes: `docs/multi-agent-protocol.md` (rationale and full protocol), a rewritten
`AGENTS.md` front section (session protocol, claim rules, human-only boundaries), root
`package.json` scripts under the `graph:*`, `agent:*`, and `journal:*` prefixes, `.agent` added to
`.prettierignore`, and two new handbook index entries.

## Decisions and trade-offs

**Claims are advisory, not enforced.** A filesystem or git-level lock would be stronger but would
fight the tooling agents actually use, and would strand work when a session dies mid-task. An
expiring, visible, checked claim is weaker but recoverable: an abandoned session leaves a stale
claim that `prune` clears, rather than a lock nobody can break.

**The graph is committed, not generated on demand.** Generated artifacts in git cause diff churn.
The trade was accepted because the primary consumer is a cold agent that should not have to run
anything to orient, and because structural drift becomes visible in review. Determinism keeps the
churn proportional to real change.

**Agent checks are not wired into `pnpm check`.** `pnpm agent:verify` runs the graph, journal, and
registry checks together and stays opt-in. Adding journal validation to the release gate would let a
documentation lapse block a build; that is a policy decision for a human, not a default. Rejected
for now, recorded as a follow-up.

**No new dependencies.** The scripts use only `node:` builtins, plus a dynamic import of the
existing Prettier devDependency so generated Markdown cannot break `pnpm format:check`. If Prettier
cannot be loaded, the scripts fall back to raw output rather than failing.

**Git churn data was excluded from the graph.** Commit counts per path would help an agent spot
hotspots, but they change on every commit and would make the committed graph permanently stale.

## Verification

Run from the repository root.

```text
node scripts/agent/graphify.mjs            # 9 workspaces, 10 edges, 21 decision records
node scripts/agent/graphify.mjs --check    # "Repository graph is current."
node scripts/agent/registry.mjs claim ...  # claim created across two scopes
node scripts/agent/registry.mjs claim ...  # overlapping scope correctly refused, exit 1
node scripts/agent/registry.mjs check ...  # conflict reported, exit 1
node scripts/agent/registry.mjs release .. # both claims released, registry empty
node scripts/agent/journal.mjs new ...     # entry created, index rebuilt
node scripts/agent/journal.mjs check       # journal valid
pnpm docs:check                            # passed
pnpm format:check                          # passed
pnpm lint                                  # passed
```

Not run: `pnpm test`, `pnpm build`, `pnpm typecheck`. This change adds no TypeScript and no runtime
code to any app or package, and `@bizo/web#build` carries the pre-existing `/_global-error`
prerender failure documented in `AGENTS.md`.

## Follow-ups

- Decide whether `pnpm agent:verify` should join the `pnpm check` gate or run as a separate CI job.
  Wiring journal validation into the release gate is a policy call for the maintainer.
- Consider a CI job running `pnpm graph:check` on pull requests, so a stale graph is caught in
  review rather than by the next agent.
- The `governingDocs` mapping in the graph is a substring heuristic — a document that discusses a
  workspace without naming it will not be linked. Revisit if it produces misleading results.
- No ADR was raised. If the claim protocol becomes a hard requirement rather than a convention, that
  is an architecture decision and needs one.

## Handoff notes

Start with `.agent/graph.md`; it is the intended first read for any agent joining this repository.

The registry and the graph both live in `.agent/` and are both committed. `.agent/registry.json`
changes often and will conflict on merge — resolve it as a union of claims, never by overwriting
another agent's entry.

`.agent/` is in `.prettierignore` because the graph is machine-generated and Prettier would reformat
its tables on every run, producing false staleness in `graph:check`. Do not remove that entry
without also making the generator emit Prettier-formatted output.

The journal index is rebuilt from entry header fields, so an entry with a malformed `Agent:` or
`Status:` line shows as `unknown` rather than failing the build. `pnpm journal:check` catches it.

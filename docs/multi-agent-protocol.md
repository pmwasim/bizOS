# Multi-agent working protocol

Status: Accepted

This document defines how more than one AI agent — and the humans reviewing them — work on bizOS
without colliding, duplicating effort, or losing the reasoning behind a change.

The problem it solves is specific. Agents start cold. They cannot see what another session decided
an hour ago, they cannot see which files someone else is mid-way through editing, and they will
happily re-derive a rejected approach. Three shared artifacts close that gap:

| Artifact                | Answers                                          | Command             |
| ----------------------- | ------------------------------------------------ | ------------------- |
| Repository graph        | What exists, what depends on what, who owns it   | `pnpm graph`        |
| Work-in-progress claims | What another agent is editing right now          | `pnpm agent:status` |
| Development journal     | What was decided, what was rejected, what's open | `pnpm journal:*`    |

## Session protocol

Every agent session follows the same five steps.

### 1. Orient

```bash
pnpm graph            # refresh .agent/graph.json and .agent/graph.md
pnpm agent:status     # who is working where
pnpm journal:latest   # the most recent session's handoff notes
```

Read `.agent/graph.md` before reading source. It gives the workspace layout, the dependency layers,
the claimable areas, and the handbook documents that govern each workspace. Read the last two or
three journal entries before proposing an approach — the alternative you are about to suggest may
already have been tried and rejected.

### 2. Claim

Claim the paths you intend to edit before editing them.

```bash
pnpm agent:claim -- --agent <your-id> --task "Add invoice credit note" \
  --scope apps/api/src/documents --scope packages/contracts/src
```

Claims are advisory, expiring (four hours by default, twenty-four maximum), and refused when they
overlap an active claim held by another agent. Claim the narrowest scope that covers your work: a
first-level source area, not a whole app. `.agent/graph.md` lists the areas.

If a claim is refused, do not force it as a first move. Pick a non-overlapping scope, wait for
expiry, or record the coordination in your journal entry. `--force` exists for genuine emergencies
and records the overlap in the registry.

### 3. Work

Standard repository rules apply without exception — see [Coding standards](coding-standards.md),
[Testing strategy](testing-strategy.md), and [Contributing](../CONTRIBUTING.md). Notably:

- A change that invalidates a handbook statement updates that document in the same change.
- A decision with durable architectural consequences needs an ADR in
  [decisions](decisions/README.md), and implementation does not merge before it is accepted.
- Stay inside your claimed scope. If the work genuinely requires a new area, claim it rather than
  quietly reaching into it.

### 4. Record

Open the journal entry at the start of substantive work, not at the end.

```bash
pnpm journal:new -- --title "Invoice credit note groundwork" --agent <your-id> \
  --scope apps/api/src/documents
```

Fill in verification with the commands you actually ran and their real results. An entry claiming a
green gate that was never run is worse than no entry, because the next agent will trust it.

### 5. Release

```bash
pnpm journal:index    # refresh the entry index
pnpm graph            # if workspaces, docs, or decisions changed
pnpm agent:release -- --agent <your-id>
```

Leave `Status:` on your entry as `Complete` or `Handed off`. A handed-off entry must name the next
concrete step in **Handoff notes**.

## The repository graph

`.agent/graph.json` and `.agent/graph.md` are generated and committed. Committing them means an
agent can orient without running anything, and a reviewer can see structural drift in the diff.

The generator is deterministic — no timestamps, no git history, no machine paths — so the same tree
always produces the same bytes. `pnpm graph:check` fails when the committed graph is stale, which is
the signal that a workspace, handbook document, or decision record moved without the graph being
regenerated.

Never hand-edit the graph. Change the repository, then regenerate.

## The work registry

`.agent/registry.json` holds active claims. It is coordination state, so it is committed and it does
change often; treat conflicts in it as a merge, never as a reason to overwrite another agent's
claim.

Scope overlap is prefix-based: `apps/api/src` overlaps `apps/api/src/documents`, but does not
overlap `apps/api/src/documents-archive`. Trailing globs are normalized, so `apps/api/**` and
`apps/api` are the same subtree.

Expired claims are not automatically deleted — they stay visible until `pnpm agent:prune` clears
them, so an abandoned session leaves a trace rather than vanishing.

## The development journal

The [journal](journal/README.md) is append-only. One entry per session, in
`docs/journal/YYYY-MM-DD-slug.md`, following [the template](journal/TEMPLATE.md).

- Never edit or delete another agent's entry. Correct the record by writing a new entry that links
  back to the one it corrects.
- Record what was rejected, not only what was chosen. The rejected branch is the part the next agent
  cannot reconstruct from the diff.
- `pnpm journal:check` enforces that every entry has the required header fields and sections, and
  that an entry marked `Complete` has no leftover placeholder.

The journal is not a changelog and does not replace ADRs. A changelog states what shipped; an ADR
states a binding decision; the journal states how the session got there.

## Boundaries

Some things stay human. An agent may prepare the change and the evidence, but it does not:

- merge to `main`, tag, or trigger a production deploy;
- rotate, generate, or move credentials and secrets;
- run destructive database operations against any shared environment;
- mark an ADR `Accepted`;
- weaken a test, silence a rule, or delete a failing assertion to make a gate pass.

Anything on that list is escalated in the journal entry's **Follow-ups**, with the exact command or
decision the human needs to take.

## Command reference

| Command               | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `pnpm graph`          | Regenerate the repository graph                  |
| `pnpm graph:check`    | Fail if the committed graph is stale             |
| `pnpm agent:status`   | List active and expired claims                   |
| `pnpm agent:claim`    | Claim paths for the current session              |
| `pnpm agent:check`    | Test a scope for conflicts without claiming it   |
| `pnpm agent:release`  | Release claims by id or agent                    |
| `pnpm agent:prune`    | Remove expired claims                            |
| `pnpm journal:new`    | Create a journal entry from the template         |
| `pnpm journal:index`  | Rebuild the journal index                        |
| `pnpm journal:latest` | Print the most recent entry path                 |
| `pnpm journal:check`  | Validate journal entries and the index           |
| `pnpm agent:verify`   | Run graph, journal, and registry checks together |

Agent-facing operating instructions live in [AGENTS.md](../AGENTS.md); this document is the
rationale and the full protocol.

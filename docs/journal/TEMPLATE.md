# Entry title

Date: YYYY-MM-DD

Agent: agent-id

Scope: paths or areas this session touched

Status: In progress

Related: ADR / issue / previous journal entry, or none

## Context

What was the state of the repository when this session started, and what problem or request
triggered the work? Link the previous journal entry if this continues someone else's work.

## What changed

Concrete changes, grouped by area. Name files and commands, not intentions. If nothing shipped, say
so plainly and explain why.

## Decisions and trade-offs

What was decided, what alternatives were rejected, and the reason. Anything with durable
architectural consequences needs an ADR in `../decisions/` — record here that it was raised, and
link it.

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm lint          # result
pnpm typecheck     # result
pnpm test          # result
```

## Follow-ups

Work this session deliberately left open, each with enough detail to be actionable by someone who
was not here. Mark anything that blocks a release.

## Handoff notes

What the next agent needs to know before touching this area: sharp edges discovered, assumptions
made, claims released or still held, and where to start.

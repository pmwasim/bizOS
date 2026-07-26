# Workflow engine

Status: Accepted design direction

## Purpose

The workflow engine coordinates human decisions, timers, and safe automation. It is not a
general-purpose code execution system.

## Model

A versioned workflow definition contains:

- states with plain-language labels;
- commands available from each state;
- guards expressed through approved facts and permissions;
- required data and evidence;
- assignments and service-level targets;
- side effects emitted as outbox events;
- timers and escalation policies;
- terminal and correction behavior.

An instance pins the definition version used at creation. Published definitions are immutable.
Migration to a newer definition is an explicit, auditable operation.

## Transition protocol

1. Load instance in tenant and business scope.
2. Authorize the command and target object.
3. Validate input and current version.
4. Evaluate deterministic guards.
5. Write state, transition record, audit entry, and outbox messages atomically.
6. Return the committed state.
7. Dispatch asynchronous work from the outbox with idempotency.

Optimistic concurrency uses a version field. Conflicts return the current state and a recovery
message instead of silently overwriting a decision.

## Human tasks

Tasks have a subject, explanation, assignee or eligible group, due time, priority, evidence links,
and completion command. Delegation preserves the original assignment trail. A person never loses
visibility into why an item appeared.

## Automation

Automations may invoke allowlisted commands under a service principal with its own Casbin policy.
They have bounded retries, idempotency keys, rate limits, execution history, and a dead-letter path.
High-impact actions can require human confirmation even when other guards pass.

## Scale

Workflow truth remains in PostgreSQL. BullMQ schedules timers and work but is never the source of
truth. Partitioning is by tenant/business and time when measured load requires it. Workers are
stateless and horizontally scalable. Long-running orchestration may later move behind the same
command/event contracts; that change requires an ADR and migration plan.

## Definition safety

- No arbitrary JavaScript, SQL, network URL, template source, or shell command.
- Formula and condition ASTs are validated, bounded, versioned, and deterministic.
- Every external connector is registered, permission-scoped, timeout-bounded, and observable.
- Simulation is required before publishing a definition that affects existing work.

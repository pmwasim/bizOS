# ADR-0006: Use a versioned deterministic workflow engine

Status: Accepted  
Date: 2026-07-26

## Context

Document approvals and future modules need configurable states, decisions, timers, and automation
while preserving history and predictable behavior.

## Options considered

- Hard-code every flow: safe and clear but costly for country and customer variation.
- Adopt an external BPM platform immediately: mature orchestration with a second operating model and
  user experience.
- Build a constrained state-machine engine: fits product language and can later delegate long
  orchestration behind contracts.

## Decision

Implement immutable versioned workflow definitions, deterministic guarded transitions, human tasks,
PostgreSQL truth, transactional outbox, and BullMQ scheduling. No arbitrary code.

## Consequences

The engine needs simulation, definition tooling, migration policy, and strict limits. It avoids
locking early product semantics to an external BPM vocabulary.

## Validation and review trigger

Evaluate a durable orchestration provider if long-running scale, timer volume, or recovery
complexity exceeds the constrained engine while preserving public command/event contracts.

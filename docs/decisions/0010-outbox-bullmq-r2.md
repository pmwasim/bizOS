# ADR-0010: Separate durable truth, queued work, and object bytes

Status: Accepted  
Date: 2026-07-26

## Context

bizOS needs reliable asynchronous effects, scheduling, caching, and large document/file storage.

## Options considered

- Put all data in PostgreSQL: simple durability but inefficient file and work dispatch.
- Treat Redis/queue as event truth: fast but risks committed facts on loss or eviction.
- Use specialized stores with explicit responsibilities.

## Decision

PostgreSQL holds business truth and a transactional outbox. BullMQ on Redis performs at-least-once
jobs and timers; workers are idempotent. Redis caches only disposable data. Private Cloudflare R2
stores bytes using opaque tenant/business keys and signed transfer flows.

## Consequences

Outbox dispatch, reconciliation, dead-letter operations, R2 metadata consistency, and deletion need
operational tooling. Redis loss delays work but does not erase a committed transition.

## Validation and review trigger

Revisit technologies if measured queue throughput, retention, ordering, object compliance, or
regional placement cannot meet the accepted SLO and legal requirements.

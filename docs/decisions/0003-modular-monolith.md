# ADR-0003: Begin with a modular monolith

Status: Accepted  
Date: 2026-07-26

## Context

The domain is broad but the product and team boundaries are not yet proven. Document, workflow,
payment, and tax changes often require transactional consistency.

## Options considered

- Microservices now: independent scale and deployment, with distributed transactions, observability,
  versioning, and operational burden before ownership is known.
- Unstructured monolith: fastest initially but creates hidden coupling.
- Modular monolith: one deployment/database transaction boundary with enforced domain modules.

## Decision

Build a NestJS modular monolith. Modules own domain/application/persistence boundaries and
communicate through commands, queries, and outbox events. Do not read another module's tables
directly.

## Consequences

Operations and consistency remain simple. Some modules share process and database failure domains.
Extraction requires discipline now but happens only with evidence.

## Validation and review trigger

Consider extraction when independent ownership, regulatory isolation, incompatible scaling, or
measured failure containment justifies the distributed-system cost.

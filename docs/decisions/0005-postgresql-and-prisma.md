# ADR-0005: Use PostgreSQL with Prisma

Status: Accepted  
Date: 2026-07-26

## Context

bizOS needs transactional workflow changes, relational integrity, flexible reporting, migration
discipline, and a TypeScript data access tool.

## Options considered

- Document database: flexible documents but weaker fit for allocations, permissions, and
  transactional invariants.
- Direct SQL/query builder: maximum control with more mapping and migration convention work.
- PostgreSQL plus Prisma: relational capabilities, migrations, generated types, and escape hatches
  for reviewed SQL.

## Decision

PostgreSQL is the system of record. Prisma manages schema, client generation, and migrations behind
module repositories.

## Consequences

Prisma does not replace runtime validation, authorization, database constraints, query-plan review,
or real integration tests. Advanced PostgreSQL features may require reviewed SQL migrations.

## Validation and review trigger

Reassess Prisma if it blocks required constraints, performance, pooling, or zero-downtime migration
practices after measured attempts to use its supported extension points.

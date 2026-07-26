# Database strategy

Status: Accepted

## System of record

PostgreSQL is the authoritative store for transactional business state, workflow state, policies,
audit metadata, idempotency records, and the outbox. R2 stores object bytes; Redis stores disposable
cache and queue coordination only.

## Prisma boundary

Prisma owns schema and migration artifacts. Application modules access persistence through
module-owned repositories; controllers and UI code do not use Prisma directly. Raw SQL requires a
reviewed reason, parameterization, tenant-scope tests, and a repository wrapper.

## Tenant isolation

- Every business table includes non-null `tenant_id` and `business_id`.
- Unique keys include the correct scope.
- Foreign keys include or otherwise prove matching tenant/business scope.
- Repository methods require a trusted scope object.
- PostgreSQL Row-Level Security is evaluated in the first domain migration and used where pooling
  and operational constraints allow reliable session context.
- Cross-tenant negative tests run against a real PostgreSQL instance.

Application filtering alone is not accepted as proof of isolation.

## Keys and values

- Internal joins may use sortable generated keys; public IDs are high-entropy and unique.
- Money is `numeric(38,0)` minor units with currency code and explicit scale.
- Rates and quantities use bounded `numeric`, never binary floating-point.
- Events are `timestamptz`; business calendar values are `date`.
- Structured domain facts use columns first; JSONB is for versioned extensions with validation and
  indexing evidence.

## Migrations

1. Change schema and migration together.
2. Prove migration on an empty database and a production-like prior snapshot.
3. Use expand/migrate/contract for incompatible changes.
4. Keep deploy migrations bounded; large backfills run resumable jobs.
5. Never edit a migration applied to a shared environment.
6. Database rollback normally uses a forward corrective migration; application rollback must remain
   compatible during the deploy window.

## Scale

- Index from observed query plans and service-level objectives.
- Use cursor pagination and bounded queries.
- Partition high-volume append-only data by time and tenant only after measured need.
- Read replicas may serve explicitly stale-tolerant reports, never authorization or immediate
  command decisions.
- Archive according to retention policy while keeping reproducible issued documents and audit
  evidence.

## Backup and recovery

Production requires encrypted automated backups, point-in-time recovery, cross-failure-domain
copies, quarterly restore exercises, documented RPO/RTO, and reconciliation between PostgreSQL
object metadata and R2 bytes. A backup is not accepted until restore evidence exists.

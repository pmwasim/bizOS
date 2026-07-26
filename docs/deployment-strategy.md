# Deployment strategy

Status: Accepted target; provider selection remains open

## Environments

- **Local**: Docker PostgreSQL and Redis; developer-controlled R2 development credentials.
- **Preview**: isolated deployment per pull request with synthetic data and short retention.
- **Staging**: production-shaped topology, sanitized fixtures, migration and recovery rehearsal.
- **Production**: regional cells with managed PostgreSQL/Redis, R2, edge controls, and centralized
  observability.

Credentials and data never flow from production down to lower environments.

## Build once

CI installs the frozen lockfile, runs `pnpm check`, creates non-root OCI images, generates an SBOM,
scans images, signs artifacts, and records source revision. The same immutable digest advances
through environments.

## Release sequence

1. Verify change, dependency, security, and architecture gates.
2. Back up and prove migration compatibility.
3. Apply expand-phase migrations with a dedicated identity.
4. Deploy API/workers and web gradually.
5. Run authenticated and unauthenticated smoke checks.
6. Observe error, latency, saturation, business invariants, and queue health.
7. Promote or automatically stop/roll back.
8. Run contract cleanup only after the rollback window.

## Rollback

Application rollback uses the prior image digest and requires backward-compatible schema. Database
errors use forward repair unless a rehearsed reversible migration is safe. Queue payloads are
versioned so old and new workers can coexist during rollout.

## Availability and recovery

Initial target is one region with multiple availability zones and an explicit maintenance policy.
Before production launch, set SLO, RPO, and RTO from customer research and cost constraints.
Multi-region data writes are not assumed; a cell-based disaster-recovery design is preferred over
premature active-active consistency.

## Infrastructure as code

Cloud resources, network policy, databases, buckets, queues, secrets, DNS, alerts, and dashboards
must be declared and reviewed. Provider and IaC tool selection requires a separate ADR because it
affects cost, portability, and operational ownership.

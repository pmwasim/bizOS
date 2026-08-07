# ADR-0022: Ubuntu production hosting

Status: Accepted  
Date: 2026-08-07  
Deciders: Product owner

## Context

bizOS historically deployed its web and API services to Render and retained an active
`.github/workflows/production-deploy.yml`, Render-specific operations documentation, and `RENDER_*`
references after the production hosting model changed.

On 2026-08-07 the product owner explicitly corrected the operating assumption: **bizOS production is
hosted on an Ubuntu desktop and is not using Render**.

The stale deployment material created an operational hazard: an agent investigating the production
`/signin` 404 followed the obsolete Render path and triggered a Render build before the hosting
correction was supplied.

## Decision drivers

- Production documentation must describe the system that actually serves users.
- A retired provider must not remain an executable production deployment path.
- The zero-cost/local-control operating model favors the already selected Ubuntu host.
- Production changes need one authoritative deployment and rollback mechanism.
- Agents must fail closed when current host details are unknown instead of guessing from historical
  runbooks.

## Options considered

### Keep Render as a parallel fallback

Rejected. Two independently executable production paths create drift, ambiguous rollback ownership,
and a high chance that automation mutates the wrong provider.

### Keep the Render workflow but label it historical

Rejected. A manually dispatchable workflow remains an active mutation path even if documentation
calls it obsolete.

### Make Ubuntu the only production host and retire Render automation

Accepted. Historical Render implementation details remain available in Git history for audit and
forensics, but are removed from the active production control surface.

## Decision

1. The Ubuntu desktop is the authoritative bizOS production application host.
2. Render is retired as a bizOS production hosting/deployment target.
3. The Render-specific GitHub production deployment workflow is removed from the active repository.
4. Current operations documentation must identify Ubuntu as production and explicitly reject
   `RENDER_*` deployment instructions.
5. The exact Ubuntu checkout path, process manager/container names, ports, Cloudflare origin
   mapping, restart command, and rollback command must be discovered on the host and recorded before
   a new automated production workflow is introduced.
6. GitHub CI may build and validate deployable artifacts, but it must not claim production
   deployment success without evidence from the Ubuntu host and the public hostname.
7. Cloudflare remains the public DNS/TLS/ingress boundary as configured operationally; credentials
   and tunnel secrets are not stored in this ADR.

## Consequences

### Positive

- Future agents cannot accidentally use the historical Render production workflow.
- Deployment drift becomes explicit instead of hidden behind outdated documentation.
- Ubuntu recovery and rollback can be documented around the actual running process.
- Production verification can distinguish source correctness from host/runtime drift.

### Negative / work required

- Until the current Ubuntu runtime is inventoried, production rollout remains a manual or externally
  controlled operation rather than a repository-defined deploy workflow.
- Existing Render environment secrets and provider resources require a separate reviewed cleanup;
  this ADR does not delete credentials or provider resources.
- The Ubuntu host now has stronger availability, backup, power/network, patching, monitoring, and
  recovery responsibilities.

## Validation and review trigger

Validate this decision by recording the real Ubuntu production topology and completing issue `#56`,
including a successful local and public `/signin` smoke test and a rollback procedure.

Review or supersede this ADR if:

- production moves to another host/provider;
- the Ubuntu host no longer meets availability or recovery requirements;
- a second production region/host is intentionally introduced;
- an approved automated GitHub-to-Ubuntu deployment mechanism replaces the current process.

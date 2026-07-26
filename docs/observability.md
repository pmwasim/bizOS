# Observability

Status: Accepted

## Correlation

Every inbound request, command, outbox event, job, webhook, and integration call carries a bounded
request or correlation ID. IDs are returned to users in error responses and never used as
authorization proof.

## Logs

Logs are structured JSON with time, level, service, environment, release, request/correlation ID,
tenant/business opaque reference where allowed, actor type, operation, outcome, duration, and error
code. Authorization headers, cookies, tokens, secrets, payment credentials, document bodies, and
personal details are redacted or excluded.

## Metrics

- request rate, error rate, duration, and saturation;
- database latency, connections, locks, and migration state;
- queue lag, attempts, failures, dead letters, and oldest job;
- outbox backlog and dispatch delay;
- R2 errors and transfer size;
- authentication and authorization denials;
- workflow transition conflicts and automation failures;
- product signals such as action completion and abandonment without exposing content.

Metrics use bounded labels; tenant IDs are not unbounded metric dimensions.

## Traces

OpenTelemetry propagation spans web, API, database, outbox, worker, and external calls. Sampling
keeps errors and high-impact workflows while respecting data minimization. Trace attributes do not
contain document text or secrets.

## SLO and alerts

Before launch, define availability and latency objectives for interactive reads, commands, and
background completion. Alerts reflect user impact, burn rate, data-integrity risk, security signals,
or recovery failure. Every page has a runbook, owner, and safe diagnostic path.

## Audit versus telemetry

Audit is durable product evidence with controlled retention. Telemetry is operational, sampled, and
access-limited. An audit event cannot be reconstructed solely from application logs.

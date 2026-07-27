# ADR-0013: Share document facts and keep the quotation lifecycle explicit

Status: Accepted

Date: 2026-07-27

Deciders: Product and engineering

## Context

The first production journey must create, render, and send a quotation. The long-term product will
also contain purchase orders and invoices, but those modules are explicitly out of scope. We need
enough shared structure to avoid rebuilding money, parties, numbering, rendering, and immutable
versions without creating a generic engine that hides materially different lifecycle rules.

## Decision drivers

- Ship one complete journey quickly.
- Reproduce every sent PDF from stored facts.
- Keep money, tenant scope, numbering, and customer relationships consistent.
- Prevent future invoice or workflow assumptions from entering the quotation MVP.
- Preserve a clear extraction seam for later document types.

## Options considered

- A quotation-only schema is direct, but duplicates durable document primitives when the next type
  arrives.
- One generic document service with status conditionals is initially compact, but makes unrelated
  lifecycle rules difficult to reason about and authorize.
- Shared document facts with a quotation-specific application service and lifecycle retain the
  reusable values while keeping behavior explicit.

## Decision

Use `documents`, `document_lines`, `document_versions`, and `document_deliveries` for scoped,
versioned commercial facts. The only approved type is `QUOTATION`. A quotation application service
owns draft validation, numbering, PDF rendering, and the transition to `SENT`.

Sending creates an immutable JSON snapshot, renders the PDF from that snapshot, delivers those exact
bytes, and records delivery, audit, and outbox evidence in the document transaction. Draft PDFs may
be generated for preview but do not become immutable versions.

PDF rendering is a server-side template identified by a stable template name. Delivery uses a
provider-neutral SMTP boundary so production providers can change without changing the document
domain.

## Consequences

The first schema contains a small amount of structure that a quotation-only table would avoid. In
return, sent artifacts are reproducible and later document types can reuse facts without inheriting
quotation behavior. Adding another type requires its own ADR, service, authorization map, lifecycle
tests, and issued-document examples.

## Validation and review trigger

Validate exact totals, tenant isolation, numbering concurrency, immutable sent versions, PDF
reproduction, and delivery failure recovery. Revisit when a second document type has approved
requirements; do not generalize from speculative similarities.

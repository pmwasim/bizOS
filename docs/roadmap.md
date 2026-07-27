# Roadmap

Status: Outcome roadmap; dates require planning evidence

## Phase 0 - Engineering foundation

Exit criteria:

- executable monorepo, frozen dependencies, CI, security scanning, and local infrastructure;
- accepted product/UX/domain/architecture handbook and ADRs;
- protected GitHub workflow, templates, ownership, labels, and milestones;
- validated web/API shells and tenant-scoped authorization proof;
- deployment provider decision, production IaC, integration test environment, and launch SLOs are
  planned before product build begins.

## MVP - Send the first quotation

The active delivery gate is one complete journey:

1. sign up and set up one business;
2. add a customer;
3. create a quotation using exact money and a simple tax default;
4. generate and download a professional PDF;
5. send the exact PDF through configured SMTP delivery.

No broader module begins until a new user completes this journey in under five minutes, the
cross-tenant and authorization tests pass against PostgreSQL, the PDF is reproducible from the
stored version, and responsive WCAG 2.2 AA acceptance is complete.

## Phase 1 - Broader document workflow core

Discovery and delivery sequence:

1. additional membership administration, parties, numbering, files, and audit views;
2. customer quotation acceptance and revision;
3. workflow tasks, approvals, and notification foundation;
4. purchase orders and supplier coordination;
5. supplier invoice intake and approval;
6. customer invoice issuance.

Each slice includes real multi-tenant tests, accessible UX research, migration evidence, and
country-neutral money/tax primitives.

## Phase 2 - Payments and statements

- payment observation, allocation, partial/overpayment, refund, and reversal;
- customer and supplier account statements;
- reconciliation assistance and accounting-system export;
- operational cash and overdue views in plain language.

## Phase 3 - Integrations and automation

- public API and developer portal;
- signed webhooks, sandbox tenants, scoped credentials, and usage limits;
- payment, email, tax, and accounting connectors;
- visual automations using the governed workflow/formula engines.

## Phase 4 - CRM and projects

- leads, opportunities, activities, and customer history;
- project scope, milestones, time/cost capture, delivery, and document linkage;
- mobile-focused work execution.

## Phase 5 - Inventory and extensibility

- items, locations, movements, reservations, purchasing, and valuation boundary;
- signed plugin manifests, isolated runtime, marketplace governance, and billing hooks.

## Phase 6 - AI operating layer

- permission-filtered retrieval and explainable summaries;
- draft generation and exception detection;
- governed agents with previews, confirmations, budgets, evaluation, and full audit.

## Sequencing gates

No phase advances because a screen exists. It advances when correctness, usability, isolation,
recovery, observability, migration, and operating ownership are demonstrated for the outcome.

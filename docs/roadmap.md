# Roadmap

Status: Outcome roadmap; dates require planning evidence

## Phase 0 - ERP foundation and customer-experience seam

Exit criteria:

- an upgradeable ERPNext/Frappe baseline with its licence, hosting, security, backup, and upgrade
  responsibilities recorded;
- a versioned bizOS setup pack and a plain-language customer workspace built through supported
  integration contracts;
- one end-to-end proof journey with ERP permissions, audit, money values, printable output, and
  upgrade resilience verified;
- a self-service registration and guided-setup path, with an optional assisted-setup request that
  continues the same business record;
- accepted product, UX, integration, security, and customization governance documentation;
- deployment, integration-test, recovery, and launch operating plans before broad product delivery.

## MVP - Small-business record to statement

The active delivery gate is one complete journey and its minimum release capabilities:

1. sign up and set up one business;
2. add a customer;
3. create, revise, and send a quotation using exact money and the applicable tax profile;
4. create a compliant customer invoice and generate its professional PDF;
5. create a purchase order;
6. record a payment without collecting it online;
7. view a statement of account and role-authorized ledger evidence; and
8. send the exact PDF through configured SMTP delivery.

The MVP is a responsive web application. Native Android and iPhone applications are explicitly
deferred until the web release proves the customer workflow and operating model.

Future platform expansion may include Android, iPhone, desktop, and Linux clients. It must reuse the
same versioned business, authorization, audit, and compliance contracts as the web application; no
platform receives a separate data model or bypasses the ERP foundation.

No broader module begins until a new user completes this journey in under five minutes, the ERPNext
permission and audit controls are verified through the bizOS experience, the PDF is reproducible,
the customization remains upgradeable, and responsive WCAG 2.2 AA acceptance is complete.

## Phase 1 - Broader document workflow core

Discovery and delivery sequence:

1. additional membership administration, parties, numbering, files, and audit views;
2. customer quotation acceptance and revision;
3. workflow tasks, approvals, and notification foundation;
4. supplier coordination beyond the minimum purchase-order flow;
5. supplier invoice intake and approval;
6. payment allocation, partial/overpayment, refund, and reversal.

Each slice includes real multi-tenant tests, accessible UX research, migration evidence, and
country-neutral money/tax primitives.

## Phase 2 - Payments and statements

- payment-link and gateway collection integration, with its own security, provider, refund, and
  reconciliation acceptance gates;
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
- signed plugin manifests, isolated runtime, marketplace governance, and billing hooks;
- free, subscription, and credit entitlement controls with governed usage records.

## Phase 6 - AI operating layer

- permission-filtered retrieval and explainable summaries;
- draft generation and exception detection;
- governed agents with previews, confirmations, budgets, evaluation, and full audit.

## Sequencing gates

No phase advances because a screen exists. It advances when correctness, usability, isolation,
recovery, observability, migration, and operating ownership are demonstrated for the outcome.

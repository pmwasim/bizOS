# bizOS Product Requirements Document

**Status:** Accepted product baseline  
**Version:** 4.0  
**Last reviewed:** 2026-07-28  
**Product owner:** Mohammed Wasim Perinkadakkat  
**Repository:** `pmwasim/bizOS`  
**Production:** `https://bizos.qloudihub.com`  
**Budget constraint:** $0 unless the product owner explicitly approves otherwise  

## 1. Purpose

This document defines the product model, default ERP experience, optional onboarding customization, System Admin responsibilities, release priorities, and product requirements for bizOS.

It is the product source of truth. Architecture, implementation, release plans, and AI-agent instructions must remain consistent with it.

## 2. Product vision

bizOS is a simple, configurable Business Operating System for small businesses, service companies, freelancers, and growing organizations.

Its purpose is to provide a proper ERP by default while hiding unnecessary complexity from users who do not have accounting or ERP experience.

A business must be able to:

- start immediately with the standard bizOS ERP;
- optionally answer setup questions for a more suitable configuration;
- request deeper business-specific customization;
- continue using one stable platform rather than receiving a separate codebase.

### Product promise

A new user can create a business and begin working immediately. Customization is optional, reversible where safe, and never required to access the default ERP.

## 3. Core product model

bizOS follows this hierarchy:

```text
bizOS Standard ERP
        ↓
Optional guided setup
        ↓
Optional industry template
        ↓
Optional business configuration
        ↓
System Admin customization
        ↓
Exceptional custom development only when configuration is insufficient
```

All businesses share one maintained platform and coherent data model.

Customization changes configuration, modules, workflows, fields, terminology, permissions, templates, and rules. It must not normally create a separate application or fork for each customer.

## 4. Default-versus-customized onboarding

### 4.1 Account signup

Account signup asks only for identity and authentication information required to create an account.

The business-configuration questionnaire must not be embedded into a long mandatory signup form.

### 4.2 Business creation choices

After account creation, the user creates a business and is offered three choices:

1. **Use default bizOS ERP**
2. **Customize my setup**
3. **Configure later**

### 4.3 Required fallback rule

Every new business must receive a complete valid configuration.

```text
IF guided setup is completed:
    assign the approved recommended configuration
ELSE:
    assign the current published Default bizOS ERP version
```

There must never be a business without:

- a workflow configuration;
- modules;
- roles and permissions;
- currency;
- numbering;
- basic tax settings;
- document templates;
- an active configuration version.

### 4.4 Use default bizOS ERP

When this option is selected, or when setup is skipped:

- no business-process questionnaire is required;
- the current published Default bizOS ERP is assigned;
- the user is taken directly to the standard dashboard;
- common tasks are prioritized;
- advanced modules remain available through progressive disclosure;
- customization can be started later from Settings.

### 4.5 Customize my setup

The setup wizard asks short, plain-language questions about:

- country and currency;
- business type;
- goods, services, or both;
- quotations;
- customer purchase orders;
- sales orders;
- delivery or service completion;
- invoice approval;
- staged or partial invoicing;
- customer payments;
- supplier purchasing;
- inventory;
- projects or job references;
- team size and approval responsibility;
- tax registration;
- document and numbering preferences.

The wizard then recommends:

- an industry template;
- enabled modules;
- workflow requirements;
- optional stages;
- navigation;
- terminology;
- role defaults;
- tax and currency defaults;
- numbering;
- document templates;
- dashboard content.

The user must review the recommendation before it is applied.

### 4.6 Configure later

This option assigns Default bizOS ERP immediately.

The user can later:

- run the setup wizard;
- review current configuration;
- request System Admin customization;
- switch to a compatible published configuration after impact review.

## 5. Default bizOS ERP

The Default bizOS ERP is the platform-owned, versioned, standard configuration assigned when customization is skipped.

It must represent conventional ERP processes rather than the workflow of one specific business.

### 5.1 Default sales process

```text
Customer
→ Quotation
→ Sales Order
→ Delivery or Service Completion
→ Invoice
→ Payment
→ Credit Note or Refund when required
```

Rules:

- a customer PO is optional supporting evidence;
- invoice approval is optional unless configured;
- physical-goods and service businesses may use different fulfilment records;
- users should see only relevant next actions;
- later stages must not be presented as mandatory when the assigned configuration marks them optional.

### 5.2 Default procurement process

```text
Supplier
→ Purchase Request
→ Supplier RFQ
→ Supplier Quotation
→ Supplier Purchase Order
→ Goods or Service Receipt
→ Supplier Bill
→ Supplier Payment
```

Terminology must remain precise:

- **Customer PO** is a document received from a customer in the sales process.
- **Supplier Purchase Order** is a document issued by the business in the procurement process.
- They are different records and must not share ambiguous behavior.

### 5.3 Default supporting capabilities

The completed Default bizOS ERP target includes:

- organizations and users;
- customers and suppliers;
- products and services;
- quotations;
- sales orders;
- customer PO evidence;
- delivery notes;
- service completion records;
- invoices;
- supplier purchasing;
- supplier bills;
- customer and supplier payments;
- receipts;
- credit notes and refunds;
- statements of account;
- projects and job references;
- inventory where enabled;
- taxes and currencies;
- numbering;
- document templates;
- reports;
- roles and permissions;
- audit history.

These capabilities may be delivered incrementally. The product must never claim an unavailable module is operational.

### 5.4 Default ERP user experience

A proper ERP does not require every module to be visible at once.

The default experience must:

- prioritize common tasks;
- use plain business language;
- show a small primary navigation;
- reveal advanced modules progressively;
- avoid ledger and journal terminology in normal business workflows;
- support desktop and mobile;
- display the next recommended action;
- make optional and mandatory stages clear.

## 6. Business and industry configurations

bizOS may provide reusable configuration packs such as:

### Standard service business

```text
Customer
→ Quotation
→ Sales Order
→ Service Completion
→ Invoice
→ Payment
```

### Service PO and approval business

```text
Customer
→ Quotation
→ Customer PO
→ Approval Evidence
→ Invoice
→ Payment
```

### Trading business

```text
Customer
→ Quotation
→ Sales Order
→ Delivery Note
→ Invoice
→ Payment
```

### Project or construction business

```text
Customer
→ Quotation
→ Contract or Customer PO
→ Project
→ Progress or Completion Evidence
→ Partial or Final Invoice
→ Payment
```

### Retail business

```text
Customer or Walk-in
→ Sale
→ Invoice or Receipt
→ Payment
```

Repeated business-specific customizations should be promoted into reusable industry templates rather than maintained as isolated one-off variants.

## 7. Current specialized workflow

The workflow originally used to define early bizOS functionality represents the combined processes of two specific businesses:

```text
Quotation
→ Customer PO
→ Approval Evidence
→ Ready to Invoice
→ Invoice
→ Payment
```

It must be preserved as a specialized versioned configuration, not treated as the universal bizOS workflow.

Existing businesses using this process must retain compatible behavior. They must not be silently migrated to the Default bizOS ERP workflow.

## 8. Customization levels

### Level 1 — Automatic default configuration

Applied when onboarding customization is skipped.

Includes:

- Default bizOS ERP version;
- standard roles;
- standard navigation;
- baseline workflows;
- numbering defaults;
- currency and tax defaults;
- standard document templates.

### Level 2 — Guided onboarding configuration

Generated from user answers using approved templates and safe configuration options.

It may change:

- enabled modules;
- mandatory or optional stages;
- terminology;
- navigation;
- dashboard;
- numbering;
- templates;
- role defaults;
- business settings.

It must not generate code or deploy a unique application.

### Level 3 — Business Admin configuration

A Business Admin may manage safe organization-level settings:

- business identity and branding;
- users and business roles;
- currency and tax defaults;
- numbering;
- approved document layouts;
- notifications;
- optional fields exposed by the assigned template;
- optional modules permitted by platform policy.

A Business Admin must not:

- create arbitrary workflows;
- execute scripts;
- change platform security boundaries;
- create structural custom fields without approval;
- modify another organization;
- publish platform templates.

### Level 4 — bizOS System Admin customization

The System Admin may perform structural configuration:

- create and version workflow templates;
- define stages and transitions;
- mark stages mandatory or optional;
- define readiness rules;
- create structural custom fields;
- configure document relationships;
- define role templates and permissions;
- configure approved automations;
- create industry packs;
- assign configurations to businesses;
- publish, retire, and migrate configuration versions;
- manage feature flags and staged rollouts.

### Level 5 — Exceptional custom development

Custom code is permitted only when:

- configuration cannot safely satisfy the requirement;
- the change is reusable or isolated behind a maintained extension boundary;
- security and tenancy are preserved;
- upgrade and rollback paths are documented;
- licence and maintenance implications are reviewed;
- the product owner approves the scope.

## 9. System Admin portal

bizOS requires a separate platform-level System Admin portal.

It is not an organization settings screen and must use platform-level authorization.

### 9.1 Platform dashboard

The portal should provide:

- organizations;
- users;
- active configurations;
- module adoption;
- release and deployment state;
- web and API health;
- email failures;
- storage usage;
- free-tier usage;
- security events;
- recent System Admin actions.

### 9.2 Organization management

System Admin can:

- search and inspect organizations;
- activate, suspend, archive, or restore organizations under controlled rules;
- view assigned configuration and version;
- assign a different compatible configuration;
- inspect enabled modules and usage;
- inspect migration status;
- export or delete data through controlled processes;
- provide audited support access.

### 9.3 Workflow and configuration management

System Admin can:

- create a template;
- create a draft version;
- define stages;
- define allowed transitions;
- define readiness conditions;
- make stages required or optional;
- test configuration;
- publish a version;
- retire a version;
- assign a version;
- preview migration impact;
- roll back assignment where safe.

### 9.4 Module management

System Admin can:

- define modules;
- define dependencies;
- enable or disable modules by configuration;
- control feature flags;
- perform gradual rollouts;
- restrict experimental capabilities.

### 9.5 Custom fields and document configuration

System Admin can:

- define structural fields;
- choose type and validation;
- choose placement;
- choose role visibility;
- mark required or optional;
- version the definition;
- manage numbering;
- manage templates;
- define country-required fields;
- manage email templates;
- manage QR and document-output rules.

### 9.6 Permissions

System Admin can manage:

- platform roles;
- organization role templates;
- module permissions;
- document actions;
- approval rights;
- support access;
- audit visibility.

### 9.7 Operations

The portal should surface or link to:

- production deployments;
- migration state;
- health checks;
- logs;
- email delivery state;
- R2 status and usage;
- database recovery evidence;
- rollback controls;
- secret-rotation status.

### 9.8 Audit requirements

Every consequential System Admin action must record:

- administrator;
- organization affected;
- configuration affected;
- previous value;
- new value;
- timestamp;
- reason;
- correlation or request reference.

System Admin support impersonation, if implemented, must be explicit, time-limited, visible, and fully audited.

## 10. Configuration architecture requirements

The product requires a configuration model equivalent to:

```text
ModuleDefinition
ConfigurationTemplate
ConfigurationTemplateVersion
BusinessConfigurationAssignment

WorkflowTemplate
WorkflowTemplateVersion
WorkflowStep
WorkflowTransition
ReadinessRule

CustomFieldDefinition
RoleTemplate
PermissionDefinition
FeatureFlag
AuditEvent
```

Requirements:

1. Every template is versioned.
2. Published versions are immutable.
3. Every business has one active configuration assignment.
4. New businesses default to the current published Default bizOS ERP version.
5. Existing specialized businesses retain their assigned specialized version.
6. Each relevant business document records the configuration or workflow version used when created.
7. Publishing a new version does not change historical transactions.
8. Configuration changes are declarative.
9. User-supplied executable code is prohibited.
10. Illegal workflow transitions are rejected server-side.
11. Readiness is derived from versioned rules.
12. Cross-tenant assignments are rejected.
13. Configuration changes are audited.
14. Impact is previewed before migration.

## 11. Functional product areas

### 11.1 Identity and tenancy

bizOS must support:

- secure signup and login;
- multiple organizations per user;
- different roles per organization;
- explicit organization switching;
- server-side organization resolution;
- cross-tenant denial;
- platform-level System Admin authority separate from organization roles.

### 11.2 Parties

bizOS must support:

- customers;
- suppliers;
- contacts;
- billing and delivery addresses;
- tax identifiers;
- deactivation without breaking history;
- duplicate warnings without silent merging.

### 11.3 Sales

The full target includes:

- quotations;
- sales orders;
- customer PO evidence;
- fulfilment or service completion;
- invoices;
- delivery tracking;
- credit notes;
- refunds;
- customer payments;
- statements.

### 11.4 Procurement

The full target includes:

- purchase requests;
- supplier RFQs;
- supplier quotations;
- supplier purchase orders;
- goods or service receipts;
- supplier bills;
- supplier payments.

### 11.5 Products, services, and inventory

The target includes:

- products;
- services;
- units;
- prices;
- tax defaults;
- inventory-enabled and non-inventory items;
- stock movements only when inventory is enabled;
- no inventory requirement for service-only businesses.

### 11.6 Projects

The target includes:

- project or job reference;
- related quotations, orders, fulfilment, invoices, and payments;
- progress or completion evidence;
- project-level status and reporting.

### 11.7 Documents

All issued business documents require:

- exact money calculations;
- business-local atomic numbering;
- versioning;
- immutable issued versions;
- authorized PDF access;
- private object storage where active;
- delivery attempts;
- audit evidence.

### 11.8 Payments and statements

The target includes:

- customer and supplier payments;
- partial payments;
- multi-document allocation;
- overpayment handling;
- receipt generation;
- reversals;
- outstanding balances;
- statements of account.

### 11.9 Reporting

Initial reports should answer plain business questions:

- What quotations are open?
- What is ready to invoice?
- What invoices are unpaid?
- What payments were received?
- What do we owe suppliers?
- What is the status of a project?

Accounting-oriented reports may be added as the accounting foundation matures.

## 12. Guided setup requirements

### 12.1 Design rules

The setup wizard must:

- be optional;
- be resumable;
- use plain language;
- show progress;
- ask only questions that affect configuration;
- avoid asking advanced accounting questions unnecessarily;
- provide recommendations;
- allow review before applying;
- explain what will change;
- allow safe reconfiguration later.

### 12.2 Recommendation behavior

Recommendations must come from approved templates and rules.

The wizard must not:

- generate unique application code;
- deploy a separate application;
- create arbitrary scripts;
- invent unsupported workflows;
- silently disable required controls.

### 12.3 Failure and uncertainty

If answers do not map safely to a published template:

- assign Default bizOS ERP;
- preserve the user’s answers;
- show that further customization is available;
- create a System Admin review request where implemented.

## 13. Product principles

1. Default ERP first; customization optional.
2. Plain business language.
3. One maintained platform.
4. Configuration before custom code.
5. Progressive disclosure.
6. Exact financial calculations.
7. Immutable issued records.
8. Tenant isolation by design.
9. Mobile-capable core journeys.
10. Version every structural configuration.
11. Show truthful states and failures.
12. Preserve audit evidence.
13. Reuse proven open source when it reduces time and risk.
14. Do not combine unrelated repositories without a coherent architecture.
15. Keep production live while evolving the platform.
16. Introduce no unapproved cost.

## 14. Open-source-first implementation policy

bizOS should use open-source code, products, and frameworks when they accelerate delivery without weakening coherence, security, upgradeability, or licensing safety.

### 14.1 Reuse rules

A candidate must pass:

- current requirement fit;
- time advantage;
- licence compatibility;
- active maintenance;
- security review;
- architecture fit;
- tenant and data-control fit;
- zero-budget operation;
- testability;
- removal or migration path.

### 14.2 Current implementation baseline

The current platform already uses a coherent open-source application stack and should not be discarded without evidence that migration is decisively better.

Existing foundations include:

- Next.js and React;
- NestJS;
- PostgreSQL;
- Prisma;
- Auth.js;
- Casbin;
- Zod;
- shadcn/ui;
- Playwright;
- S3-compatible object-storage integration.

### 14.3 ERP framework evaluation

Mature ERP frameworks and repositories may be used for:

- domain research;
- workflow comparison;
- reusable patterns;
- isolated integration;
- benchmark prototypes;
- future migration analysis.

They must not be introduced by:

- copying random code from multiple ERP repositories;
- running two uncontrolled systems of record;
- replacing the live core without a formal decision;
- exposing a complex default ERP UI to non-accountant users;
- delaying near-term live releases for speculative migration work.

Any proposal to adopt or migrate to an ERP foundation must compare:

- standard ERP coverage;
- guided customization;
- System Admin capability;
- multi-tenancy;
- simplified UI feasibility;
- APIs;
- upgrades;
- licensing;
- hosting at $0;
- operational burden;
- data migration;
- rollback.

## 15. Current live baseline

As of this PRD version, production includes validated vertical capabilities for:

- account and session;
- business setup;
- customer management;
- quotation creation;
- quotation PDF and email;
- customer PO and approval evidence;
- ready-to-invoice behavior for the specialized workflow;
- invoice creation from a ready quotation;
- invoice PDF and email;
- private object storage;
- role-based access;
- tenant isolation;
- CI/CD and production smoke validation.

This live behavior must remain operational while the product is generalized.

## 16. Immediate product priority

The next architecture milestone is not to add another hard-coded stage.

The priority is to establish:

1. Default bizOS ERP configuration;
2. optional onboarding choice;
3. versioned business configuration assignment;
4. preservation of the specialized two-business workflow;
5. platform System Admin authorization;
6. the first System Admin configuration portal;
7. workflow-specific readiness rules.

After this generalization, product slices can continue through:

- payments and statements;
- sales order and fulfilment;
- procurement;
- products and inventory;
- projects;
- reporting.

## 17. Release-speed policy

bizOS must go live and improve quickly without sacrificing core safety.

Rules:

- ship complete user outcomes;
- keep the current production flow working;
- implement one major workflow at a time;
- use additive migrations where possible;
- protect regressions with production-path tests;
- distinguish release blockers from hardening;
- use feature flags for incomplete functionality;
- avoid platform rewrites during active release work;
- keep rollback targets;
- validate production after deployment.

## 18. Budget policy

The operating budget remains strictly $0 unless explicitly changed.

Requirements:

- use free tiers and open source;
- do not activate a paid plan automatically;
- do not silently incur usage charges;
- document free-tier limitations;
- monitor storage, database, hosting, and email usage;
- fail safely when limits are reached;
- preserve data integrity;
- propose paid upgrades only with evidence and explicit approval.

## 19. Security, privacy, and audit

Release-blocking defects include:

- authentication bypass;
- cross-tenant access;
- unauthorized System Admin access;
- secret exposure;
- unauthorized file access;
- data corruption;
- incorrect financial results;
- issued document mismatch;
- false send success.

Required controls include:

- HTTPS;
- server-side authorization;
- separate platform and organization roles;
- strict request validation;
- rate limiting;
- safe logs;
- private object storage;
- immutable issued versions;
- dependency and secret scanning;
- audited configuration changes;
- tested cross-tenant denial.

bizOS must not claim legal, tax, privacy, accounting, or regulatory compliance that has not been verified.

## 20. Success metrics

### Activation

- signup-to-business completion;
- percentage choosing default ERP versus guided setup;
- setup-wizard completion;
- time to first useful action;
- first quotation or invoice completion.

### Configuration quality

- recommendation acceptance rate;
- setup changes within seven days;
- System Admin customization requests;
- repeated customizations promoted to templates;
- failed configuration migrations.

### Product usage

- quotations sent;
- POs recorded;
- invoices sent;
- payments recorded;
- transactions progressing to the next stage;
- active organizations.

### Reliability

- deployment success;
- PDF and email success;
- cross-tenant test pass rate;
- configuration migration success;
- free-tier interruptions;
- mean recovery time.

### Initial quality thresholds

- zero confirmed cross-tenant exposure;
- zero unauthorized System Admin actions;
- zero unapproved spend;
- zero unresolved critical security defects;
- default ERP assignment succeeds for every new business;
- existing specialized businesses retain compatible behavior;
- historical documents remain stable after configuration updates.

## 21. Release gates

A release may proceed only when:

- the user outcome is complete;
- default and customized paths behave as documented;
- authorization is tested;
- tenant isolation is tested;
- configuration versions are stable;
- historical records are not changed unexpectedly;
- migrations are validated;
- mobile and desktop paths pass;
- current live regressions pass;
- rollback is available;
- cost remains $0;
- documentation is updated;
- production smoke validation is defined and executed.

## 22. Roadmap

### Stage A — Live transactional foundation

Status: delivered incrementally.

- quotation;
- customer PO and approval evidence;
- invoice;
- PDF;
- email;
- tenant isolation;
- deployment.

### Stage B — Default ERP and customization foundation

Highest priority.

- Default bizOS ERP template;
- optional onboarding choices;
- guided setup;
- configuration templates and versions;
- business assignment;
- specialized-workflow preservation;
- System Admin role;
- initial System Admin portal;
- workflow-specific readiness.

### Stage C — Receivables

- payments;
- allocations;
- receipts;
- balances;
- statements;
- credit notes and refunds.

### Stage D — Standard sales completion

- sales orders;
- delivery notes;
- service completion;
- standard readiness paths;
- project references.

### Stage E — Procurement

- suppliers;
- purchase requests;
- RFQs;
- supplier quotations;
- supplier purchase orders;
- receipts;
- supplier bills and payments.

### Stage F — Products, projects, inventory, and reporting

- product and service catalogue;
- project operations;
- optional inventory;
- user-friendly operational reports.

### Stage G — Automation and AI

Only after stable workflows and reliable data:

- extraction;
- matching suggestions;
- reminders;
- draft communication;
- anomaly detection;
- human confirmation for consequential actions.

## 23. Decision rights

### Product owner approval required

- any paid service;
- core-platform migration;
- public-launch decision;
- compliance claim;
- irreversible production-data action;
- new external data processor;
- autonomous AI action with business consequences;
- exceptional custom-development commitment.

### System Admin authority

System Admin may manage approved structural configuration within platform controls.

### Business Admin authority

Business Admin may manage safe organization settings within the assigned configuration.

### Engineering and agent autonomy

Engineering agents may:

- implement approved PRD scope;
- improve tests;
- perform safe refactoring;
- harden security;
- improve CI/CD;
- evaluate open source;
- optimize zero-cost infrastructure;
- update documentation.

They may not silently change the product model, incur cost, or broaden business authority.

## 24. Definition of done

A capability is done only when:

- it delivers an end-to-end user outcome;
- default ERP behavior is defined;
- customization behavior is defined where applicable;
- language is understandable to a non-accountant;
- authorization and tenancy are enforced;
- financial calculations are exact;
- issued records are reproducible;
- configuration versions are preserved;
- failure recovery exists;
- mobile behavior is verified;
- audit requirements are met;
- CI and production validation pass;
- no unapproved cost is introduced;
- documentation is current.

Merged code alone is not product completion.

## 25. One-sentence product test

> A change belongs in bizOS when it helps a business use a proper ERP more simply, or safely adapts that ERP to the business through versioned configuration, without breaking the shared platform, historical records, security, or the $0 budget.

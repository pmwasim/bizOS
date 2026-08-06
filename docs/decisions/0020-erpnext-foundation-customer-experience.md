# ADR-0020: ERPNext foundation with a bizOS customer experience

Status: Accepted

Date: 2026-07-28

Deciders: Product and engineering

## Decision

Use Frappe/ERPNext as the ERP foundation for bizOS. Sell bizOS as a configurable, plain-language
customer experience and implementation layer—not as a new accounting engine or a lightly rebranded
ERPNext installation.

ERPNext owns the ERP capabilities that are mature, reliable, and appropriate for the enabled
modules: accounting truth, core master data, document lifecycle, inventory, projects, CRM, reports,
permissions, audit, and extensible metadata. bizOS owns the customer experience: information
architecture, language, guided setup, role-based workspaces, workflows, configuration packs,
integrations, and supportable industry-specific customization.

## Product boundary

At business registration, an administrator may select a default versioned experience mode:

1. **Guided bizOS experience** — a selected UI and workflow pack provides plain-language workspaces,
   setup, and role-based tasks for that business or industry.
2. **Standard ERPNext experience** — the business uses ERPNext's standard interface and workflows
   without the bizOS overlay.

The selected business mode is a default, not a lock. A user chooses the interface they can access
for their active business: guided bizOS or standard ERPNext. The choice is stored per user and
business and can be changed when their needs change, including during an operational incident. Each
switch must record the actor, time, prior and new mode, and reason; it takes effect without changing
or migrating ERP records.

Users may belong to, administer, or own multiple businesses. Membership, role, capabilities, and the
interfaces available are evaluated separately for each active business; switching business never
grants access to another business's data. Both interfaces operate on the same authorized ERP
records; selecting the guided experience must never create a divergent data model or bypass ERPNext
controls. The guided default user should see their work, next actions, people, money status, and
exceptions—not a general ERP menu or accounting jargon. Formal accounting screens remain available
only to users whose role and enabled capabilities require them.

Customization is configuration-first: approved ERPNext/Frappe configuration, custom fields,
workflows, print formats, roles, integrations, and versioned bizOS packs. A customer-specific fork
is an exception requiring an explicit maintenance and upgrade plan.

## Customization authority

Two parties customize the product with different scopes:

- **bizOS System Administrators** are the platform team. They create, approve, publish, retire, and
  support reusable country, industry, UI, and workflow packs. They can apply a governed pack or
  incident remediation when authorized, with a full platform audit trail.
- **Business Administrators** configure their own business within the limits of the assigned pack:
  they select an available interface, enable permitted modules, manage their team, adjust approved
  settings, and choose permitted workflows and templates. They cannot modify protected platform or
  country controls, or affect another business.

Every customization identifies its scope (platform, country, pack, business, or user), version,
actor, time, and prior value. A platform change must not silently overwrite a business's permitted
configuration; conflicts require an explicit reviewed resolution.

## Compliance architecture

Compliance is implemented as versioned, effective-dated country packs, separate from UI preference
or general workflow customization. A pack defines the applicable tax registration fields, tax
categories and rates, currency and rounding rules, document numbering, mandatory invoice fields,
language and layout, retention and audit rules, and government-integration requirements. Only the
platform team may publish a compliance-pack version, after legal, tax, security, and regression
review.

The launch packs have distinct boundaries:

- **Saudi Arabia:** VAT and Arabic invoice requirements, plus both ZATCA/FATOORAH e-invoicing
  capabilities: Phase One compliant invoice generation and Phase Two clearance/reporting
  integration. Phase Two activation is controlled per business according to its current ZATCA
  onboarding wave and eligibility; it must not be assumed for every business at registration.
- **United Arab Emirates:** VAT, AED presentation and rounding, Tax Registration Number fields, and
  Federal Tax Authority invoice requirements.
- **India:** GSTIN and state-aware CGST/SGST/IGST treatment, invoice and credit/debit-note rules,
  and Invoice Registration Portal integration only for businesses covered by the current e-invoice
  mandate.

The application must determine applicability from a business's registered country, tax status,
activity, and relevant threshold evidence; it must not guess. Regulatory changes receive a new pack
version with an effective date, migration impact assessment, customer communication, and a
controlled rollout. Until each pack is implemented, tested against authority specifications, and
reviewed by a qualified local adviser, bizOS must not claim statutory or filing compliance.

## Integration boundary

- Keep ERPNext/Frappe as a separately deployable, upgradeable core; do not copy its business logic
  into the Next.js/NestJS codebase.
- Build the bizOS web experience against supported ERPNext/Frappe APIs and controlled integration
  contracts. Do not couple it to direct database writes.
- Use a minimal Frappe app only where an extension cannot be represented safely through supported
  configuration or APIs. Each such extension requires tests, migration ownership, security review,
  and an upgrade path.
- Treat ERPNext permission and audit controls as authoritative for ERP actions. bizOS may simplify
  presentation, but must not bypass authorization or weaken auditability.
- Preserve tenant, company, country, currency, tax, and data-residency decisions as explicit
  architecture work; adopting ERPNext does not resolve them automatically.

## Modular delivery and release

bizOS is planned, built, tested, and released by capability module. A module owns its UI/workspace
surface, supported ERPNext/Frappe integration contract, permissions, configuration schema, audit
events, country-pack applicability, tests, and operational documentation. Initial modules are:

1. identity, business membership, and active-business access;
2. customer and supplier contacts;
3. quotations;
4. customer invoices and compliance documents;
5. purchase orders;
6. payment recording;
7. statements of account and ledger views; and
8. country, industry, UI, and workflow packs.

Stable modules remain available in production while another module is built or changed. New or
materially changed modules are isolated through versioned contracts, capability flags, and staged
rollout by country, pack, and business. A module is not released merely because its screen works:
its integration, authorization, isolation, audit, recovery, compliance, and upgrade acceptance
criteria must pass. Start as a modular application with extraction seams; split into independently
deployed services only when measured operational evidence justifies the added complexity.

## First validation gate

Before building broad business modules, prove the platform boundary with one end-to-end journey:

1. register a business, choose a versioned guided bizOS pack or standard ERPNext default, and record
   the decision;
2. give one user separate memberships in two businesses, with different roles and permitted
   interfaces, and prove that their active-business switch preserves isolation;
3. let the user choose the guided workspace or standard ERPNext interface for an authorized active
   business;
4. create, approve, and send one customer offer or invoice through the bizOS experience;
5. verify the resulting ERPNext records, permissions, audit trail, money values, and printable
   document; and
6. upgrade the ERP foundation in a controlled test environment without losing the customization.

Passing this gate establishes a safe product seam. It does not authorize a production launch or a
claim of statutory accounting compliance.

## Consequences

- ADR-0019's no-migration decision is superseded.
- The existing bespoke NestJS/Prisma ERP-domain roadmap is no longer the default implementation
  path. Retain only components that have a clear customer-experience, integration, or governance
  role after the ERPNext boundary is validated.
- Product and architecture documentation must describe ERPNext/Frappe as the foundation before
  further feature delivery resumes.

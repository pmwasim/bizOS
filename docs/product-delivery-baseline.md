# bizOS product and delivery baseline

Status: Proposed for product-owner approval

Last updated: 2026-07-28

## Purpose and control rule

This is the controlling baseline for the bizOS reset. It consolidates the product-owner decisions
made on 2026-07-28 and prevents the project from drifting back toward a bespoke ERP build. A change
to a Must, launch boundary, module boundary, or country commitment requires a dated decision record
and an update to this document before implementation begins.

Where older handbook material conflicts with this baseline, this baseline controls until the older
document is revised or superseded. It does not claim that the required product has been built,
validated, or deployed.

## Product definition

bizOS is a configurable SaaS experience for freelancers, small establishments, service businesses,
and small construction operators. Frappe/ERPNext is the ERP foundation. bizOS is the product
customers buy: a plain-language, workflow-first UI, guided setup, country and industry packs,
controlled customization, and support. It must not reimplement ERP accounting truth or copy ERPNext
business logic into a parallel system.

## Launch markets and language

| Market       | Default | Additional language            | Compliance focus             |
| ------------ | ------- | ------------------------------ | ---------------------------- |
| Saudi Arabia | English | Modern Standard Arabic and RTL | VAT and ZATCA/FATOORAH       |
| UAE          | English | Modern Standard Arabic and RTL | VAT and FTA/EmaraTax         |
| India        | English | None at launch                 | GST and GST portal ecosystem |

Arabic is shared for formal UI text across Saudi Arabia and the UAE. Country packs own local legal,
tax, and document wording. All user data and documents must support Unicode regardless of the chosen
interface language.

## Experience and customization

At registration, a business receives a default experience choice: guided bizOS, using a versioned UI
and workflow pack, or standard ERPNext. A user selects their permitted interface for each active
business. A user may belong to several businesses, but role, permissions, data, and interface
availability are evaluated independently for each business.

Customization is configuration-first: approved packs, fields, roles, workflows, print formats,
integrations, and feature settings. Customer-specific code forks require an explicit maintenance,
security, and upgrade plan.

System Administrators publish reusable country, industry, UI, and workflow packs. Business owners
and administrators choose available packs, permitted settings, and their team. Accountants,
partners, and auditors receive access only after a request and approval by the target business.
Every change records its scope, actor, time, prior value, new value, version, and reason.

## Privacy and roles

Business data is private by default. An accountant, partner, auditor, or member of the bizOS team
must request access to a specific business. The business owner or administrator approves a defined
role, scope, and expiry. System administrators do not have routine customer-data access; exceptional
support access is temporary and audited.

Initial roles are Owner, Business Administrator, Staff, Accountant, and External Auditor. Apply
least privilege: auditors are read-only, staff receive only their work capabilities, and finance
access is not a shortcut to operational administration.

## Minimum release scope

The responsive web application is the only launch client. Android, iPhone, desktop, and Linux
clients are deferred, but must later use the same versioned contracts, authorization, audit, and ERP
data.

An authorized user must be able to:

1. register and set up a business;
2. create and manage customers;
3. create, revise, approve, and send quotations;
4. create compliant customer invoices and professional PDFs;
5. create and manage purchase orders;
6. record received and made payments without collecting money online;
7. view customer and supplier statements of account; and
8. access role-authorized ledger and audit evidence.

Online payment links, gateway collection, and payment credentials are explicitly deferred.

## Compliance modules

Compliance is separate from UI preference and ordinary workflow configuration. Country packs are
versioned and effective-dated. They define tax registration fields, tax categories and rates,
currency and rounding, document numbering and layout, mandatory fields, language, retention,
government integrations, and evidence.

| Market       | Required capability                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Saudi Arabia | Arabic VAT documents, Phase One e-invoice generation, Phase Two ZATCA integration where in scope, and authorized VAT return support. |
| UAE          | VAT documents, AED presentation and rounding, TRN fields, and authorized EmaraTax return support.                                    |
| India        | GSTIN, state-aware CGST/SGST/IGST, e-invoice integration where applicable, and authorized GST-return support.                        |

Tax returns must be reconciled, reviewed, and explicitly approved by the business before filing.
bizOS must not silently file or pay a tax authority. Until a country pack passes
authority-specification testing and qualified local review, the product must not claim statutory
compliance.

## Onboarding and migration

The launch model is hybrid: self-service registration and guided setup, plus optional assisted
setup, migration, configuration, and training by the bizOS team or approved partners. Businesses can
start clean or migrate from another platform, spreadsheets, manual books, or paper records.

Import scope includes customers, quotations, invoices, and opening balances. Every import needs
validation, preview, business approval, source attribution, and an immutable migration record.
Imported history is never represented as a newly issued compliant invoice or cleared e-invoice.

## Modular architecture and release model

Work is planned and released by module. A module owns its UI/workspace surface, ERP integration
contract, authorization, configuration, audit events, country applicability, tests, and operational
documentation. Initial modules, in release order, are:

1. identity, membership, active-business access, and privacy approvals;
2. country, industry, UI, and workflow packs;
3. customer and supplier contacts;
4. quotations;
5. customer invoices and compliance documents;
6. purchase orders;
7. payment recording;
8. statements of account and ledger views; and
9. tax filing.

Stable modules stay live while a new module is built. Changes are isolated with versioned contracts,
capability flags, and staged rollout by country, pack, and business. Start as a modular application
with extraction seams; independently deploy services only when operating evidence justifies it.

## Commercial model

The commercial model combines free evaluation or carefully limited free access, subscriptions per
business, optional credits for transparent variable-cost actions, and setup, training, migration,
and custom implementation services. Do not charge credits for legal invoices, tax records,
historical access, or ordinary logins. Credits are deferred from the minimum release.

System Administrators may grant complimentary access, discounted pricing, a fixed negotiated price,
included services, tailored packages, or credit grants. Each agreement is explicit, time-bound,
audited, visible to the business, and automatically reverts or expires unless renewed. See
[Pricing recommendation](pricing-recommendation.md) for the pilot commercial hypothesis.

## Delivery gates

### Foundation proof

Prove that an upgradeable ERPNext/Frappe baseline and the bizOS web experience can safely share
records through supported integration contracts. Prove business isolation, role-aware access,
auditability, country-pack selection, and an upgrade path without losing customization.

### Minimum-release acceptance

The release is eligible for pilot only when the defined workflow works for an ordinary user in every
selected country pack, with exact money, applicable tax, PDF reproducibility, role checks, business
isolation, audit evidence, migration safety, recovery, accessibility, and operational ownership
demonstrated. A screen alone is not evidence of completion.

### Deployment boundary

The project is not ready for production deployment. Production requires passed module acceptance,
security and privacy review, specialist country compliance approval, backup and recovery evidence,
observability, support procedures, incident response, and a controlled pilot.

## Explicit deferrals

- Online payment collection and payment links.
- Native Android, iPhone, desktop, and Linux applications.
- Broad inventory, manufacturing, CRM, projects, automation, plugins, and AI beyond the minimum
  flow.
- A separate platform-wide accountant or partner workspace.
- Unreviewed statutory-compliance or tax-filing claims.
- Customer-specific code forks without a governed upgrade plan.

## Change control checklist

Before accepting a new request, confirm:

1. Does it support a named release module or is it a new module?
2. Does it change a Must, a country commitment, an access boundary, or compliance scope?
3. Is it a configuration-pack change, product capability, or custom implementation?
4. What acceptance evidence, owner, risk, and rollback plan are required?
5. Does it belong now, or does it move to a future module or release?

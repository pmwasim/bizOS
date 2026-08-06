# bizOS handbook

Status: Product and delivery baseline under approval

Last reviewed: 2026-07-28

This handbook is the source of truth for product intent, engineering constraints, and accepted
architecture. The [Product and delivery baseline](product-delivery-baseline.md) controls where older
handbook material conflicts during the ERPNext/Frappe product reset. A code change that invalidates
a handbook statement must update the relevant document in the same pull request.

## Product and experience

- [Vision](vision.md)
- [Product and delivery baseline](product-delivery-baseline.md)
- [MVP module delivery plan](mvp-module-plan.md)
- [Country compliance delivery plan](country-compliance-plan.md)
- [Operating and access governance](operating-access-governance.md)
- [ERPNext/Frappe local foundation runbook](../ops/erpnext/README.md)
- [Product overview](product-overview.md)
- [Product requirements](product-requirements.md)
- [Quotation MVP](mvp-quotation.md)
- [User personas](user-personas.md)
- [UX principles](ux-principles.md)
- [Information architecture](information-architecture.md)
- [Roadmap](roadmap.md)

## Domain and platform design

- [Domain model](domain-model.md)
- [Workflow engine](workflow-engine.md)
- [Permission model](permission-model.md)
- [Formula engine](formula-engine.md)
- [Tax engine](tax-engine.md)
- [Internationalization](internationalization.md)
- [Architecture](architecture.md)
- [Architecture decisions](decisions/README.md)

## Engineering and operations

- [API guidelines](api-guidelines.md)
- [Database strategy](database-strategy.md)
- [Coding standards](coding-standards.md)
- [Testing strategy](testing-strategy.md)
- [Deployment strategy](deployment-strategy.md)
- [Cursor deployment handoff](deployment-handoff-cursor.md)
- [Observability](observability.md)
- [Security](security.md)
- [GitHub governance](github-governance.md)
- [Multi-agent working protocol](multi-agent-protocol.md)
- [Development journal](journal/README.md)
- [Assumptions](assumptions.md)
- [Spike: OpenNext on Cloudflare Workers](spikes/opennext-cloudflare-web.md)

## Decision status

- **Proposed**: open for review; not yet a constraint.
- **Accepted**: the current default and a constraint on implementation.
- **Superseded**: retained for history and linked to its replacement.
- **Deprecated**: still present but must not be extended.

Product requirements use **Must**, **Should**, and **Could**. A Must is a release gate, not an
aspiration.

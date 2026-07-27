# Quotation MVP

Status: In delivery  
Last reviewed: 2026-07-27

## Outcome

A new user can create an account and send a professional quotation in under five minutes without
reading documentation:

```text
Create account -> Set up business -> Add customer -> Create quotation -> Preview PDF -> Send
```

The product uses plain business language, remembers safe defaults, and presents one primary action
at each step.

## Included

- Auth.js browser sessions backed by NestJS credential verification.
- Organizations, memberships, Owner/Admin/Member role templates, and exact business access.
- Business identity, locale, time zone, base currency, numbering, and one tax profile.
- Customer creation and list.
- Generic scoped document facts with an explicit quotation draft/send lifecycle.
- Exact integer minor-unit totals and bounded decimal quantity and tax inputs.
- Reproducible `professional-v1` PDF output.
- Provider-neutral SMTP delivery with the exact PDF attached.
- A small dashboard, quotation list, and business settings.
- Desktop and mobile layouts meeting the accessibility baseline.

## Excluded

Purchase orders, invoice approvals, invoices, payments, CRM, inventory, AI, workflow building,
plugins, and a marketplace are not represented by screens, routes, database states, or background
jobs in this slice.

## Experience contract

- Ask only for fields required to send the first quotation.
- Default locale and time zone from the request environment when they are trustworthy; keep every
  default visible and reversible.
- Default quotation validity to 30 days, numbering to `Q-0001`, and tax to off until the user
  explicitly enables it.
- Use “price”, “tax”, “total”, “save draft”, and “send quotation”; do not expose ledger, posting,
  debit, credit, journal, or receivable terms.
- Preserve form values on correctable errors and state what is preserved.
- Make preview and send separate deliberate steps.

## Visual system

The implementation reference is the [desktop flow](design/mvp/desktop-flow-concept.png) and
[mobile flow](design/mvp/mobile-flow-concept.png).

- True-white background, charcoal text, restrained cobalt primary action, and cool-gray borders.
- Open workspace layout with a quiet navigation rail; do not wrap every region in a card.
- Twelve-pixel control radii, 44-pixel minimum targets, visible keyboard focus, and minimal shadow.
- Desktop quotation lines use a table-like editor; mobile lines become a readable field group.
- Mobile product navigation contains only Home, Customers, Quotations, and Settings.

## API and security contract

- The browser never sends a trusted tenant identifier.
- Auth.js establishes the user session. The Next.js server issues a short-lived internal assertion
  to NestJS; NestJS resolves membership and business scope on every request.
- Casbin denies by default and evaluates exact tenant/business domains.
- Business repositories run inside a transaction with PostgreSQL tenant and business context; forced
  row-level security protects customer and document tables.
- A sent quotation is immutable. Resending creates another delivery record for the same version;
  changing facts requires a new draft version.
- SMTP attachments are in-memory bytes. Email delivery cannot read arbitrary files or URLs.

## Implemented API slice

The current `/api/v1` foundation exposes:

- `POST /auth/signup`, `POST /auth/verify`, and authenticated `GET /me`.
- `POST /businesses` plus settings read and update.
- Customer create, list, read, and update within a resolved business.

Every non-public route requires a short-lived internal assertion. Business routes independently
resolve an active membership, apply the role policy, set database row-security context, validate
strict request contracts, return no-store responses, and record mutation audit events. Quotation,
PDF, and delivery endpoints are the next slice; this section must be updated when they are
executable.

The deployable NestJS application does not emit TypeScript declarations. Public types are owned by
the contract and shared-library packages; keeping generated ORM types out of application declaration
output prevents build-time type expansion without changing runtime architecture. The API also pins
the workspace Zod catalog version directly because it constructs runtime pipes from contract
schemas; this prevents structurally incompatible validator copies from entering the same type graph.

## Release evidence

- Unit tests for runtime schemas, exact money, quotation totals, permissions, PDF generation, and
  delivery failure behavior.
- Real PostgreSQL tests for cross-tenant denial, scoped foreign keys, numbering concurrency, and
  immutable sent versions.
- API tests for unauthenticated, unauthorized, invalid, happy-path, and conflict responses.
- Browser tests for the complete desktop and mobile journey, keyboard operation, interruption
  recovery, and accessible names.
- Production build, migration validation, dependency audit, document-link check, and container
  builds remain green.

The local Docker daemon is currently unavailable. PostgreSQL and SMTP container acceptance therefore
remain CI gates until equivalent local runtime evidence is available; unit, contract, migration, and
production-build checks still run locally.

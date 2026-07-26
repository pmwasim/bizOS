# Information architecture

Status: Accepted direction

## Navigation model

The primary navigation describes work, not implementation modules:

1. **Today** - assigned actions, exceptions, due items, and recent outcomes.
2. **Work** - offers, orders, approvals, invoices, payments, and statements.
3. **Contacts** - customers, suppliers, and people.
4. **Reports** - saved questions and operational summaries.
5. **Automations** - rules, runs, failures, and approvals.
6. **Settings** - business, team, documents, tax, integrations, modules, and developer access.

Desktop uses a compact side navigation. Mobile uses a task-first bottom/navigation pattern with
secondary areas in a menu. The selected business is always visible and changing it is deliberate.

## Multi-business context

- A person belongs to a tenant account and receives access to zero or more businesses.
- The current business scopes all work views and commands.
- Cross-business views are explicitly labeled and permission-gated.
- Links carry stable object identity but resolve authorization using the active session, never by
  trusting a business identifier in the URL.
- Switching business clears business-scoped cached data and announces the new context.

## Object pages

Every durable object follows a predictable structure:

- summary and current state;
- next action and owner;
- essential facts;
- timeline and communication;
- related work;
- files;
- activity and audit details under progressive disclosure.

## Search

Global search returns only authorized objects and groups by human concept. Results show business,
counterparty, status, amount, date, and why the result matches. Search indexes are treated as
tenant-scoped derived data and rebuilt from the source of truth.

## URLs

Human-facing URLs use opaque public identifiers and stable resource nouns. Locale is a display
preference rather than part of object identity. API URLs are independently versioned.

## Module growth

CRM, projects, inventory, and future modules register navigation contributions through governed
manifests. They cannot reorder core safety destinations or bypass permission-filtered routing.

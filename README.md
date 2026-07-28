# bizOS

bizOS is a workflow-first Business Operating System for small businesses and service companies. It
is designed for people who run a business, not people who speak in accounting jargon.

The repository delivers a private-beta sales-document workflow: a new user can create a business,
add a customer, prepare and send a quotation, record customer purchase-order and approval evidence,
convert a ready quotation into an invoice, and send the invoice PDF by email. A Default ERP
foundation (configuration templates, guided onboarding, and a platform System Admin boundary) is
merged on `main` and rolling out. Payments, statements, credit notes, suppliers, inventory, and
accounting remain on the roadmap.

## Repository map

```text
apps/
  api/               NestJS modular-monolith API and quotation delivery
  web/               Next.js web application, Auth.js session boundary, and BFF
packages/
  authorization/     Casbin policy model and enforcement boundary
  config/            Runtime environment validation
  contracts/         Transport-neutral schemas and API contracts
  database/          Prisma schema, migrations, and database tooling
  queue/             BullMQ job contracts and queue factory
  storage/           Cloudflare R2 storage boundary
  ui/                Shared shadcn/ui-compatible components and design tokens
docs/                 Product, UX, architecture, operations, and ADR handbook
```

## Prerequisites

- Node.js 22.23.1 or a compatible release in the supported engine range
- pnpm 11.17
- Docker with Compose for local PostgreSQL and Redis

## Start locally

```bash
cp .env.example .env
# Replace the placeholder Redis password in both REDIS_PASSWORD and REDIS_URL.
# A suitable value can be generated with: openssl rand -hex 32
pnpm install --frozen-lockfile
docker compose up -d postgres redis mailpit
pnpm db:validate
pnpm dev
```

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/v1/health`
- Local message inbox: `http://localhost:8025`

## Quality gate

```bash
pnpm check
```

The gate checks formatting, linting, TypeScript, tests, the Prisma schema, and production builds.
See [Contributing](CONTRIBUTING.md) and the [documentation index](docs/README.md).

## Status and license

**Private beta.** The deployed sales-document workflow has production evidence, but the platform is
not yet generally available: do not store irreplaceable or sensitive customer data until backup and
restore are verified, and do not market bizOS as a complete ERP. Current production capabilities and
their verification status are tracked in
[docs/operations/invoice-vertical-slice-production-evidence.md](docs/operations/invoice-vertical-slice-production-evidence.md)
and the [documentation index](docs/README.md). The full slice and its scope boundary are documented
in [Quotation MVP](docs/mvp-quotation.md).

The source is currently all-rights-reserved; see [LICENSE.md](LICENSE.md).

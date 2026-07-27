# bizOS

bizOS is a workflow-first Business Operating System for small businesses and service companies. It
is designed for people who run a business, not people who speak in accounting jargon.

This repository is currently in **Phase 0: engineering foundation**. It intentionally contains no
quotation, invoice, payment, or accounting feature implementation.

## Repository map

```text
apps/
  api/               NestJS modular-monolith API
  web/               Next.js web application and BFF
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
docker compose up -d postgres redis
pnpm db:validate
pnpm dev
```

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/v1/health`

## Quality gate

```bash
pnpm check
```

The gate checks formatting, linting, TypeScript, tests, the Prisma schema, and production builds.
See [Contributing](CONTRIBUTING.md) and the [documentation index](docs/README.md).

## Status and license

The platform is pre-release and not suitable for production business records. The source is
currently all-rights-reserved; see [LICENSE.md](LICENSE.md).

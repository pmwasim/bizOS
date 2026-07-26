# Contributing to bizOS

## Before starting

Read the [handbook](docs/README.md), search issues and ADRs, and open an issue for material product
or architecture changes. Security vulnerabilities follow [SECURITY.md](SECURITY.md), not public
issues.

## Local workflow

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d postgres redis
pnpm check
```

Create a short-lived branch from `main`. Use Conventional Commits and the scopes enforced by
Commitlint. Keep commits reviewable and independently valid when practical.

## Pull requests

- Explain the user or platform outcome and alternatives considered.
- Link the issue or ADR.
- Include tests and exact validation commands.
- Update contracts, migrations, and docs in the same change.
- State tenant/security, data migration, observability, deployment, and rollback impact.
- Do not include secrets, customer data, generated credentials, or production exports.

Architecture decisions with durable consequences require an ADR. A proposed ADR can accompany
exploratory code, but implementation does not merge before the decision is accepted.

## Review

Reviewers prioritize correctness, tenant isolation, security, plain-language UX, recoverability, and
maintainability. A green check is necessary but not sufficient evidence.

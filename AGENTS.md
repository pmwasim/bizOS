# AGENTS.md

## Cursor Cloud specific instructions

bizOS is a pnpm + Turborepo monorepo. Two long-running apps plus supporting packages:

- `apps/api` — NestJS API (`nest start --watch`), serves `http://localhost:3001/api/v1` (health at
  `/api/v1/health`).
- `apps/web` — Next.js app + Auth.js/BFF (`next dev`), serves `http://localhost:3000`.
- Standard scripts live in the root `package.json` and `README.md`/`CONTRIBUTING.md`; prefer those
  for lint/test/build/run commands.

Backing services (Docker Compose in `compose.yaml`): PostgreSQL, authenticated Redis, and Mailpit
(local SMTP inbox at `http://localhost:8025`).

### Non-obvious gotchas

- **Turbo strict env mode strips `dev`/runtime env vars.** The apps read `process.env` directly (no
  dotenv), and the `dev` task in `turbo.json` declares no `env`. Running plain `pnpm dev` makes the
  API crash with a Zod error (`DATABASE_URL`/`INTERNAL_AUTH_SECRET`/`SMTP_*` undefined). Export the
  env and run with loose mode: `set -a && . ./.env && set +a && TURBO_ENV_MODE=loose pnpm dev`. The
  `test` task already declares its env vars, so tests only need the vars exported (loose not
  required).
- **`.env` is required and not committed.** Create it from `.env.example` and fill the generated
  secrets: `REDIS_PASSWORD`, matching `REDIS_URL`, `AUTH_SECRET`, `INTERNAL_AUTH_SECRET` (each
  `openssl rand -hex 32`, secrets need ≥32 chars). Placeholder `R2_*` values are fine for the
  quotation flow (SMTP attachments are in-memory; no real R2 needed).
- **Docker daemon is not managed by systemd here.** Start it manually (e.g. `sudo dockerd &`) before
  `docker compose --env-file .env up -d postgres redis mailpit`. Compose reads `REDIS_PASSWORD` from
  `.env`.
- **DB must be migrated + seeded per fresh database.**
  `pnpm --filter @bizo/database prisma:migrate:deploy` then `pnpm db:seed` (the API's Default-ERP
  assignment and system-admin flows depend on the seed).
- **`pnpm build` / `pnpm check` / `pnpm typecheck` fail only on `@bizo/web#build`.** Next's
  prerender of `/_global-error` throws
  `TypeError: Cannot read properties of null (reading 'useContext')` under the pinned Next 16 /
  React 19 versions. This is a pre-existing production-build issue, unrelated to environment setup.
  Dev mode (`next dev`), the web app's own `tsc --noEmit`, ESLint, and all package/api tests pass.
  Use per-package/per-app commands (or `--filter '!@bizo/web'`) to get green build/test signal while
  this stands.
- **`lefthook install` (root `prepare`) fails under the cloud agent's custom `core.hooksPath`.** It
  is a benign local git-hook convenience; the startup update script installs deps without triggering
  it, so ignore that failure.

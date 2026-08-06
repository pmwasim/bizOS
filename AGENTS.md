# AGENTS.md

Operating instructions for AI agents working on bizOS. Read this first, in full, before touching the
repository. The rationale behind it is in
[docs/multi-agent-protocol.md](docs/multi-agent-protocol.md).

More than one agent may be working here at the same time. Assume you are not alone.

## Start every session with this

```bash
pnpm graph            # refresh and read .agent/graph.md — the fastest way to orient
pnpm agent:status     # what another agent is editing right now
pnpm journal:latest   # the previous session's handoff notes
```

Then read `.agent/graph.md` and the last two or three entries in
[docs/journal](docs/journal/README.md) before you propose an approach. The approach you are about to
suggest may already have been tried and rejected.

## Claim before you edit

```bash
pnpm agent:claim -- --agent <your-id> --task "<one line>" --scope <path> [--scope <path>]
```

Claims expire in four hours by default and are refused when they overlap another agent's active
claim. Claim the narrowest area that covers your work — `.agent/graph.md` lists the claimable areas
per workspace. If a claim is refused, choose a different scope or coordinate; do not reach for
`--force` first.

Release when you finish:

```bash
pnpm agent:release -- --agent <your-id>
```

## Record what you did

Open the entry when you start substantive work, not when you finish:

```bash
pnpm journal:new -- --title "<summary>" --agent <your-id> --scope <path>
```

Fill in **Verification** with the commands you actually ran and their real results. Fill in
**Handoff notes** with what the next agent needs to know. Never edit another agent's entry — correct
the record with a new entry that links back.

Before you hand off:

```bash
pnpm agent:verify     # graph freshness + journal validity + expired claims
```

## Repository rules that are not negotiable

- A change that invalidates a handbook statement updates that document in the same change.
- A decision with durable architectural consequences needs an ADR in
  [docs/decisions](docs/decisions/README.md), accepted before implementation merges.
- Conventional Commits with the scopes enforced by Commitlint.
- No placeholder, skipped test, weakened assertion, silenced rule, or hidden retry left behind. If a
  gate cannot pass, say so in the journal rather than making it pass dishonestly.
- Full standards: [Coding standards](docs/coding-standards.md),
  [Testing strategy](docs/testing-strategy.md), [Contributing](CONTRIBUTING.md).

## Do not do these without a human

Merging to `main`, tagging, production deploys, credential and secret handling, destructive database
operations on shared environments, and marking an ADR `Accepted`. Escalate them in your journal
entry's **Follow-ups** with the exact command or decision required.

## Agent tooling reference

| Command               | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `pnpm graph`          | Regenerate `.agent/graph.json` and `.agent/graph.md` |
| `pnpm graph:check`    | Fail if the committed graph is stale                 |
| `pnpm agent:status`   | List active and expired claims                       |
| `pnpm agent:claim`    | Claim paths for this session                         |
| `pnpm agent:check`    | Test a scope for conflicts without claiming          |
| `pnpm agent:release`  | Release claims by id or agent                        |
| `pnpm agent:prune`    | Remove expired claims                                |
| `pnpm agent:verify`   | Graph, journal, and registry checks together         |
| `pnpm journal:new`    | Create a journal entry                               |
| `pnpm journal:index`  | Rebuild the journal index                            |
| `pnpm journal:latest` | Print the most recent entry path                     |
| `pnpm journal:check`  | Validate journal entries and the index               |

## Cursor Cloud specific instructions

bizOS is a pnpm + Turborepo monorepo. Two long-running apps plus supporting packages:

- `apps/api` — NestJS API (`nest start --watch`), serves `http://localhost:3001/api/v1` (health at
  `/api/v1/health`).
- `apps/web` — Next.js app + Auth.js/BFF (`next dev`), serves `http://localhost:3000`.
- Standard scripts live in the root `package.json` and `README.md`/`CONTRIBUTING.md`; prefer those
  for lint/test/build/run commands.

Backing services (Docker Compose in `compose.yaml`): PostgreSQL, authenticated Redis, and Mailpit
(local SMTP inbox at `http://localhost:8025`).

`.agent/graph.md` has the full workspace map, dependency layers, entry points, and the handbook
documents governing each workspace.

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

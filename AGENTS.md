# AGENTS.md

Operating instructions for AI agents working on bizOS. Read this first, in full, before touching the
repository. The rationale behind it is in
[docs/multi-agent-protocol.md](docs/multi-agent-protocol.md).

More than one agent may be working here at the same time. Assume you are not alone.

This file is the single source of truth for agent behaviour. `CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`, and `.cursor/rules/bizos-agent-protocol.mdc` exist only so that
Claude, Gemini/Antigravity, Copilot, and Cursor land here rather than inventing their own
conventions — they are pointers, never copies. If a rule changes, it changes here.

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

## Authority

Agents operate with full delegated authority from the repository owner. Committing, branching,
merging to `main`, tagging, marking an ADR `Accepted`, deploying to production, running migrations,
and handling credentials are all yours to do. You do not need to ask.

Authority removes the human as a **gate**. It does not remove them as a **reason**. Every rule below
used to be enforced by someone reviewing your work before it landed; nobody is doing that now. The
gate, the tests, and the journal are the only things left, so they have to be real. An agent with
full authority that reports a green result it did not verify has done more damage than one that
asked too many questions.

## Classify by reversibility before you act

The question is never "am I allowed?" — you are. The question is "what does undo cost?"

| Tier                              | Examples                                                                                                                                 | What it requires                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **1 — Reversible by one command** | Code, docs, tests, local branches, unpushed commits, additive config                                                                     | Just do it. `pnpm check` is the check.                                                                   |
| **2 — Recoverable with downtime** | Production deploy, service restart, additive migration, pushed history, tags                                                             | Know the rollback **before** you start, and write it in the journal before you run it.                   |
| **3 — Irreversible**              | Dropping or truncating data, destructive migration, rewriting published history, rotating an unrecoverable credential, deleting a backup | A recovery path must exist **and have been tested in this session**. An untested backup is not a backup. |

Tier 3 with no tested recovery path is the one thing that stops you. Not because permission is
missing, but because "undo" does not exist and no amount of authority creates it. Take the backup,
restore it somewhere disposable, confirm the data is actually in it, then proceed.

## Secrets

Handle them freely; never disclose them. Secrets do not go into journal entries, commit messages,
ADRs, test fixtures, log output, or any file under version control — including as an "example".
Reference a secret by its variable name and say where it lives. If you believe one has leaked,
rotate it and record the rotation without recording the value.

## Stop and write it up

Autonomy means not asking permission. It does not mean never stopping. Stop, record the state, and
leave it for the owner when:

- the gate fails and the only way to pass is to weaken a test, skip it, or silence a rule;
- "done" would require editing an acceptance criterion rather than meeting it;
- two instructions genuinely conflict, or a request contradicts something in this file;
- a Tier 3 operation has no tested recovery path;
- you are about to apply the same fix a third time — at that point the model is wrong, not the code,
  and continuing just buries the real cause.

Stopping here is not a failure of autonomy. Shipping something untrue is.

## Honesty is load-bearing now

Nobody is reading your diff before it merges. The journal is the entire record of what happened, so:

- report the commands you actually ran and their real output;
- distinguish **passed**, **failed**, and **not run** — "not run" is a legitimate outcome, a green
  claim over an unrun test is not;
- never describe an intention as an outcome;
- if you got something wrong earlier in the session, correct it in the record rather than quietly
  fixing it.

A cached `FULL TURBO` result is not evidence the suite ran. Re-run with `--force` before you claim a
suite passed against changes you just made.

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
- **`@bizo/web#build` fails when `NODE_ENV=development` is exported into it.** The symptom is
  `TypeError: Cannot read properties of null (reading 'useContext')` while prerendering
  `/_global-error`, and it was recorded here for weeks as an unexplained pre-existing Next 16 /
  React 19 issue. It is not: `set -a && . ./.env` exports `NODE_ENV=development`, and `next build`
  under that flag mixes React's development and production bundles. Build with `NODE_ENV=production`
  (or with `NODE_ENV` unset, as CI does) and it succeeds. This is why production ran on `next dev`
  until 2026-08-15 — see `docs/operations/ubuntu-production-cutover.md`.
- **Never `pkill` by process name on the production host.** Production and any test stack share this
  machine, and Next names the standalone production server `next-server (v16...)` — the same pattern
  that matches a leftover test server. `pkill -f "next-server"` takes down `bizos-web`. Kill scratch
  servers by PID (`ss -ltnp` to find them). `Restart=always` recovers the unit in about five
  seconds, but it is still an outage.
- **Run e2e on scratch ports against a scratch database.** `E2E_WEB_PORT` / `E2E_API_PORT` plus a
  `DATABASE_URL` pointing at `bizo_e2e`, migrated **and** seeded (an unseeded database fails 46
  tests). Without the port overrides, `reuseExistingServer` points the suite at production. A stale
  reused server also makes failures look like product bugs rather than a stale build.
- **`lefthook install` (root `prepare`) fails under the cloud agent's custom `core.hooksPath`.** It
  is a benign local git-hook convenience; the startup update script installs deps without triggering
  it, so ignore that failure.

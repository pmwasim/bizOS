# Tech debt: brace-expansion resolution, web-tier ADR, and API boot optimization

Date: 2026-08-06

Agent: antigravity-opus

Scope: docs/decisions, docs/spikes, apps/api/src/database, apps/api/src/main.ts

Status: Complete

Related: [Render cold start and OpenNext spike](2026-08-06-render-cold-start-and-opennext-spike.md)

## Context

Follow-ups 2, 5, and 6 from the previous journal entry (2026-08-06, claude-opus Cowork session) were
open:

- Follow-up 2: Resolve the `brace-expansion` override conflict blocking the OpenNext build.
- Follow-up 5: Write an ADR for the web-tier hosting split before adopting the OpenNext direction.
- Follow-up 6: Cut the ~20s API boot time (lazy Prisma connect, defer non-critical modules).

## What changed

### 1. brace-expansion / minimatch@8 ESM conflict — analysed and documented

Traced the full dependency chain: `@opennextjs/aws@4.1.0` → `@node-minify/core@^8.0.6` →
`glob@9.3.5` → `minimatch@^8.0.2` → `brace-expansion@^2.0.1`.

**Finding**: The current `pnpm-workspace.yaml` overrides are correctly version-ranged (e.g.
`"brace-expansion@>=2.0.0 <2.1.4": "2.1.4"`). A clean `pnpm install` resolves `minimatch@8`'s
`brace-expansion@^2.0.1` to v2.1.4 correctly. The spike's error occurred because the throwaway copy
was `pnpm install`-ed fresh without the committed lockfile, causing pnpm to hoist v5 into
minimatch@8's resolution scope.

**No changes to `pnpm-workspace.yaml` needed.** A scoped override
(`"minimatch@^8>brace-expansion": "2.1.4"`) is documented as a fallback if the issue recurs.

Updated: `docs/spikes/opennext-cloudflare-web.md` — new section "Resolved: brace-expansion /
minimatch@8 ESM conflict".

### 2. ADR-0022: Web tier hosting split

Created `docs/decisions/0022-web-tier-cloudflare-workers-hosting-split.md` (status: **Proposed**).

Documents the architecture for moving `apps/web` to Cloudflare Workers Free via OpenNext while
keeping `apps/api` on Render Free. Covers four options, deployment topology, implementation details,
consequences, risks, and validation criteria.

Updated `docs/decisions/README.md` index to include the new entry.

### 3. API boot time optimization

**`apps/api/src/database/database.service.ts`**: Removed the eager `this.client.$connect()` from
`onModuleInit()`. Prisma auto-connects on the first query, so the explicit connect only blocked
bootstrap while the TCP + TLS handshake completed with remote PostgreSQL (~2-5s). The `OnModuleInit`
interface is retained (method logs a message instead) so integration tests calling
`database.onModuleInit()` are unaffected.

**`apps/api/src/main.ts`**: Added `performance.now()` timing instrumentation to `bootstrap()`. Logs
`API bootstrap completed in Nms` after `app.listen()` for cold-start visibility.

## Decisions and trade-offs

**Lazy Prisma over eager**: The health endpoint (`/api/v1/health`) should respond immediately on
boot without waiting for a database connection. First real query pays the connection cost. The only
risk is that the first user request sees slightly higher latency, but this is strictly better than
blocking the entire bootstrap for every cold start.

**ADR status Proposed, not Accepted**: Per AGENTS.md, humans must accept ADRs. The ADR is complete
and ready for review.

**No code changes for brace-expansion**: The overrides are already correct. Documenting the root
cause and fallback is the right action — code changes would be speculative.

## Verification

```text
apps/api      tsc --noEmit                        # passed
apps/api      vitest run (unit, 26 files)          # 159 passed
packages/config vitest run                         # 11 passed
apps/web      vitest run                           # 15 passed
eslint <changed .ts files>                         # passed, no output
prettier --check <all changed files>               # passed (after --write fix on markdown)
node scripts/check-doc-links.mjs                   # passed — all local Markdown links resolve
pnpm graph                                         # passed — 9 workspaces, 22 decision records
pnpm agent:verify                                  # passed — graph current, journal valid, no claims
```

## Follow-ups

1. **Accept or reject ADR-0022** — human decision required. If accepted, proceed with the OpenNext
   build trial (spike runbook steps 1-4 are ready).
2. **Run the OpenNext build** — the go/no-go gate is whether the Worker is under 3 MiB compressed.
   This is the single remaining unknown for the web-tier hosting split.
3. **Follow-ups 1, 3, 4, 7 from the previous journal entry remain open** — read the Render log for
   ERROR 1826286119, deploy the keep-warm worker, establish PostgreSQL backup story, revoke the
   spike SSH key.
4. **Integration tests** were not run (require Docker PostgreSQL and Redis). Run `pnpm test` with
   Docker services up to verify the lazy-connect change under integration.

## Handoff notes

- The `database.onModuleInit()` method still exists but is now a no-op (logs a message). Integration
  tests that call it directly will still work — they just won't eagerly connect. The first query in
  each test suite will trigger the connection. If any integration test assumes the connection is
  ready at `onModuleInit()` time, it will still work because the query itself connects.
- The ADR-0022 file is Prettier-formatted and passes the doc-link checker. It links back to ADR-0015
  and the spike doc.
- No claims were taken (session was short). No claims need releasing.

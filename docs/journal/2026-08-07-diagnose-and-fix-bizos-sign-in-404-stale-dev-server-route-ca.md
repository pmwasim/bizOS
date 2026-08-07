# Diagnose and fix bizOS sign-in 404 (stale dev-server route cache)

Date: 2026-08-07

Agent: claude-sonnet-5

Scope: apps/web/src/app

Status: Complete

Related: none — picked up autonomously per user request ("continue working on bizOS, also fix
sign-in"). No prior journal entry described this symptom.

## Context

`main` (branch `fix/brace-expansion-override`) had a long-running `pnpm dev` session (turbo +
`next dev` + `nest start --watch`) left over from a prior multi-agent swarm session (see `.agents/`
— orchestrator/explorer/worker/reviewer workspaces from an autonomous PRD-implementation run
described in `ORIGINAL_REQUEST.md`). The working tree had ~20 new/modified files across
`apps/api/src/{crm,inventory,projects,sales-orders,suppliers,delivery-notes,credit-notes,statements}`
and `apps/web/src/app/(auth)` untouched by this session.

User report: sign-in is broken. Reproduced: `GET /signin` returned a genuine Next.js 404 (not a
redirect, not an app error boundary), while the structurally identical `GET /signup` in the same
`(auth)` route group returned 200.

## What changed

Root-caused via `apps/web/.next/dev/server/app-paths-manifest.json` (the aggregate route table the
Turbopack dev server actually serves from): it was missing the `/(auth)/signin/page` entry even
though a valid per-route manifest for that page existed on disk
(`apps/web/.next/dev/server/app/(auth)/signin/page/app-paths-manifest.json`, compiled successfully
at some point) and the route was correctly declared in `next.config.ts`/the filesystem. `/signup`'s
entry was present in the same aggregate file. This is a stale/corrupted Turbopack dev-server route
cache — most likely caused by the concurrent multi-agent edits to the `apps/web/src/app` tree while
`next dev`'s file watcher was live, which desynced its in-memory route table from disk.

Separately, `apps/api` (`nest start --watch`) was continuously reporting 16-17
`TS2307: Cannot find module '@bizo/contracts/{crm,inventory,projects,sales-orders,suppliers,delivery-notes,credit-notes}'`
errors in its watch loop, even though `packages/contracts/package.json` exports and
`packages/contracts/dist/*.js` for all of those subpaths were present and correct. A clean
`npx tsc -p apps/api/tsconfig.build.json --noEmit` had zero errors — confirming this was a stale
`tsconfig.tsbuildinfo` / incremental-watch cache issue in the long-running process, not a real code
defect.

Fix applied: killed the stale detached dev processes (`apps/api/dist/main.js`, `next-server`, their
`turbo`/`pnpm` parents), cleared `apps/web/.next/dev` and `apps/web/.next/cache`, and restarted
`pnpm dev` clean. No source files were modified — this was a dev-environment cache defect, not an
application bug.

## Decisions and trade-offs

Considered patching `apps/web/src/app/(auth)/signin/page.tsx` (e.g. touching the file to force a
recompile) instead of a full restart, but a full restart is the only way to guarantee the aggregate
route manifest and the API's incremental TS cache are both rebuilt from a known-good state, and it
verifies the fix rather than just working around the symptom. No ADR needed — this is an
environment/tooling issue, not an architectural decision.

## Verification

```text
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/signin   # before: 404 -> after: 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/signup   # 200 throughout (control)
npx tsc -p apps/api/tsconfig.build.json --noEmit                      # 0 errors (confirmed pre-existing errors were stale-cache, not real)
curl -s http://localhost:3001/api/v1/health                           # {"service":"api","status":"ok",...}
```

End-to-end auth flow verified in the Browser pane against the running dev server:

1. `/signup` → created `signin-test-0807@example.com` → session cookie issued, landed on onboarding
   step 2 (business creation) — confirms `NextAuth` Credentials provider + `/auth/verify` round-trip
   works.
2. `POST /api/v1/auth/verify` with the same credentials directly against the API returned `201` and
   the user record — confirms the credential-verification path independent of the web session.
3. `/signin`, `/signup`, `/`, `/start` all return expected status codes post-restart
   (200/200/200/307).

`pnpm lint` / `pnpm test` / full `pnpm build` were **not** run this session — out of scope for a
dev-server cache fix, and the working tree has substantial unrelated in-progress/uncommitted work
from the prior multi-agent session (see Handoff notes) that would make a full quality-gate run noisy
and non-attributable to this change.

## Follow-ups

- The working tree on `fix/brace-expansion-override` has ~20 new API modules (`crm`, `inventory`,
  `projects`, `sales-orders`, `suppliers`, `delivery-notes`, `credit-notes`, `statements`) and
  matching web routes that are uncommitted and were left mid-flight by a prior autonomous
  multi-agent session (`.agents/*`, `ORIGINAL_REQUEST.md`, `NOT`). These need a human decision on
  whether to commit, squash, or discard — they represent a large uncommitted diff with no journal
  entry of their own.
- `apps/web/src/auth.ts` has uncommitted changes (`trustHost`, `useSecureCookies`, a `redirect`
  callback) already in the working tree from that same prior session, ahead of this one. They look
  correct (open-redirect-safe, secure-cookie-in-production) but have not been reviewed or tested by
  this session — worth a second look before commit.
- Consider adding a `next dev` cache-bust step (`rm -rf apps/web/.next/dev apps/web/.next/cache`) to
  the multi-agent protocol or a `pnpm dev:clean` script, since concurrent agents editing
  `apps/web/src/app` while `next dev` is live is exactly the condition that produced this bug and
  will likely recur under the same multi-agent workflow.

## Handoff notes

- The dev stack (`pnpm dev`) is running now as detached/orphaned processes (reparented to pid 1, not
  attached to a terminal) — API on `:3001`, web on `:3000`, both healthy. If you need to restart
  them, kill by port (`ss -tlnp | grep -E ':3000|:3001'`) rather than assuming a `pnpm dev` job is
  attached to your shell.
- If `/signin`-style 404s recur on other freshly-added App Router pages while `next dev` is running
  under concurrent multi-agent edits, this stale-manifest cache is the first thing to check —
  compare the per-route `app-paths-manifest.json` against the aggregate
  `apps/web/.next/dev/server/app-paths-manifest.json`; a mismatch confirms it, and a clean restart
  (with `.next/dev` and `.next/cache` removed) is the fix.
- Did not claim any scope via `pnpm agent:claim` since `pnpm agent:status` showed the tree free and
  no other agent's active work was touched (no source files modified). Did not attempt the giant
  PRD-implementation backlog from `ORIGINAL_REQUEST.md` — that is a separate, much larger piece of
  work that needs explicit human scoping before another autonomous pass, given how much of it is
  already uncommitted and unreviewed.

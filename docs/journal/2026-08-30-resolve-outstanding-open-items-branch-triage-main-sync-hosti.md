# Resolve outstanding open items: branch triage, main sync, hosting/module doc audit

Date: 2026-08-30

Agent: claude-resolve-open-items

Scope: .agent, AGENTS.md, apps/api/src/ai, docs

Status: Complete

Related:
[Zero-budget Hugging Face for bizOS AI](2026-08-21-zero-budget-hugging-face-for-bizos-ai.md);
[Repair recurring production health false failures](2026-08-23-repair-recurring-production-health-false-failures.md);
[Complete bizOS production release and clear E2E gate](2026-08-23-complete-bizos-production-release-and-clear-e2e-gate.md);
ADR-0014, ADR-0015, ADR-0022 (`docs/decisions`)

## Context

The owner asked for five standing open items to be resolved, explicitly from the project's own
documents rather than by asking: (1) 23 uncommitted files on `cursor/hf-zero-budget-ai`, (2) `main`
8 commits behind `origin/main`, (3) a stray untracked file `J`, (4) whether to merge
`fix/brace-expansion-override`, how deep to build partial modules, and the
Cloudflare-tunnel-vs-Render hosting question, and (5) resuming PRD/contracts work reportedly cut off
by a spend limit.

`main` was at `b13c9a1`; `origin/main` was 8 commits ahead including two merged CRM sprints
(`#136`-`#139`) and one inventory sprint task (`#140`), landed 2026-08-29. The
`cursor/hf-zero-budget-ai` branch's own commit history had already squash-landed on `main` three
times (PRs `#120`-`#122`, confirmed identical tree via `git diff 510ddcb 369b282`); its 23 dirty
files were new work sitting on top of that stale tip.

## What changed

- **`main` synced to `origin/main`** (item 2): `git fetch origin main:main`, a pure fast-forward
  (`b13c9a1..09d21ff`). No local commits were unique to `main`, so nothing was at risk.
- **`cursor/hf-zero-budget-ai` rebuilt on current `main`** (item 1): reset the branch pointer onto
  `main` (content-identical to the branch's old tip through PR #122, confirmed by diff), then
  restored the Sprint 7/8 files that briefly regressed in the working tree to `main`'s content
  (`apps/api/src/crm`, `apps/api/src/inventory`, `apps/api/src/documents/quotations.service.ts`,
  `apps/api/src/integration`, `apps/web/src/app/actions.ts`, the CRM web page/view,
  `packages/contracts/src/{crm,inventory}.ts`, `packages/database/prisma`). Nothing of the
  zero-budget AI work touches those paths, so no content was lost.
- **Kept and staged** (all traceable to the "Done" 2026-08-21 zero-budget-AI journal entry):
  `apps/api/src/ai/*` (5 modified + `zero-budget-ai.provider.ts`/`.spec.ts` new), `.env.example`,
  `AGENTS.md` (Learned Preferences/Facts sections), `ops/ai/README.md` +
  `ops/ai/n8n-bizos-invoice-ocr-zero-budget.json`, the zero-budget-AI journal entry itself, and
  `docs/journal/README.md`'s index line. Reformatted `ops/ai/README.md` with Prettier (was
  unformatted).
- **Kept** `apps/web/AGENTS.md` / `apps/web/CLAUDE.md` — regenerated verbatim by `next dev` on every
  boot; the file's own header says committing it "keeps the tree clean." Added `apps/web/AGENTS.md`
  to `.prettierignore` (hand-formatting it just fights the next regeneration).
- **Deleted `J`** (item 3): a 249 KB ImageMagick-produced PostScript file in the repo root, not
  referenced anywhere in source, docs, or config. Junk from an image-export tool, not a project
  artifact.
- **Excluded from the repository** (not deleted from disk destructively — recoverable from
  `safety/hf-zero-budget-ai-20260830` and the `~/bizos-backups` tarball the owner already took):
  `docs/vault/` (an Obsidian knowledge-graph mirror with a fictional
  "Michael/Jim/Pam/Dwight/Oscar/Kevin" agent roster referencing an external path,
  `/home/wasim/HarnessAgents/hive/agents/dwight`, outside this repo) and
  `pipelines/ai-invoice-ocr-automated-reconciliation/` (a Draft/Discovery PRD + all-`"todo"` sprint
  dispatch for an unbuilt "AI Invoice OCR & Automated Reconciliation" product, assigned to the same
  fictional roster). Also removed the generator, `scripts/agent/graphify-obsidian.mjs`. See
  Decisions below for why.
- **`.gitignore`**: added `.cursor/mcp.json` and `.cursor/hooks/` (machine-local Cursor state — MCP
  server registration and "continual learning" cache — mirroring the existing `.vscode`/`.idea`
  local-state pattern already in the file).
- Regenerated `.agent/graph.json` / `.agent/graph.md` (`pnpm graph`) and the journal index
  (`pnpm journal:index`) against the final tree.
- Rebuilt `packages/contracts` (`pnpm --filter @bizo/contracts build`) — its `dist/` predates the
  Sprint 7/8 CRM/inventory contract exports now in `main` and was failing `@bizo/api` typecheck on
  stale output, not on anything this session changed.

## Decisions and trade-offs

**1. Do not merge `fix/brace-expansion-override` into `main`.** `docs/mvp-module-plan.md` lists
inventory, full CRM, and projects under "Deferred modules" that "must not delay the MVP sequence";
`docs/roadmap.md` places CRM/projects in Phase 4 and inventory in Phase 5, both after Phase 1-3, and
states "no phase advances because a screen exists." The branch adds exactly those modules ahead of
sequence. It is also 8+ commits stale relative to `main`: merging it would **delete**
already-shipped, tested functionality — the tax engine, ZATCA UBL e-invoicing, webhooks, API keys,
and numbering (`git diff main..fix/brace-expansion-override --stat` shows 48,550 deletions against
7,902 insertions). Its own origin remote is already deleted (`git branch -vv` shows `gone`), and its
stashed `ORIGINAL_REQUEST.md` (`git stash show -p stash@{2}`) shows it was an autonomous "implement
the full PRD" attempt from `teamwork_preview`, superseded by the disciplined Sprint 1-8 track that
has since properly delivered the same CRM/inventory scope through reviewed, gated PRs. Left the
local branch and its stash untouched — not destructive to leave, and no instruction requires
deleting it.

**2. How deep to build partial modules (suppliers/inventory/CRM/projects): follow the existing
sprint sequence; do not open new feature work in this session.** `origin/main` already shows the
answer in progress and merged: Sprint 7 (`TASK-26`-`TASK-29`, PRs `#136`-`#139`) delivered CRM lead
scoring, lead→opportunity progression, opportunity→quotation conversion, the activity timeline, and
a CRM lifecycle verification gate; Sprint 8 (`TASK-30`, PR `#140`) started inventory with
multi-warehouse stock locations and a movement journal. `docs/mvp-module-plan.md`'s "Rule of
delivery" (workflow, authorization, audit, integration contract, recovery, country-pack checks, each
proven before release) is exactly what those PRs' verification gates are for. The owner's request
was to resolve open items, not to start a new sprint; doing so here would duplicate that
already-working, PR-reviewed process ad hoc. Flagged as a follow-up, not actioned.

**3. Hosting: Ubuntu host with Cloudflare as edge only — already decided, nothing to build.**
ADR-0022 (`docs/decisions/0022-ubuntu-production-hosting.md`, Accepted 2026-08-07) retires Render
and Cloudflare-Workers-as-host, making the Ubuntu desktop "the authoritative bizOS production
application host" with Cloudflare kept only as "the public DNS/TLS/ingress boundary." This
supersedes ADR-0015's earlier Render-behind-Cloudflare plan. `apps/web/wrangler.jsonc` and
`open-next.config.ts` do not exist anywhere in this repository or its branches (checked
`git log --all`), so there was nothing uncommitted to organize — the open question was already
closed by ADR-0022 before this session.

**4. Item 5 — "PRD implementation cut off mid-way through the contracts build": no live work to
resume.** `packages/contracts/src` is complete (58 modules incl. tax engine, ZATCA, webhooks, API
keys, statements) and matches `main`'s last hardening commit; there is no uncommitted or dangling
contracts work anywhere in this repository (checked `git status`, `git stash list`,
`git fsck --unreachable`, and the four Dependabot-only open PRs via `gh pr list`). The only match
for "an autonomous full-PRD implementation that ran out of budget" is the
`fix/brace-expansion-override`/ `teamwork_preview` attempt addressed in Decision 1 above — already
superseded, not resumed. `docs/product-requirements.md` (v4.0, "Accepted product baseline") and
ADR-0023/0024 (invoice settlement and statements, both Accepted and verified) show no open,
partially-implemented contract decision either.

**5. Excluded `docs/vault/` and `pipelines/ai-invoice-ocr-automated-reconciliation/` from the
repository.** Neither is covered by `docs/multi-agent-protocol.md`, which defines exactly three
shared coordination artifacts (repository graph, work registry, journal) and says "never hand-edit
the graph" — a parallel, hand-editable Obsidian mirror of the same information is a fourth,
undocumented artifact with drift risk the protocol doesn't account for. Both reference a fictional
six-person agent roster (Michael/Jim/Pam/Dwight/Oscar/Kevin) tied to an external, non-bizOS path
(`/home/wasim/HarnessAgents/hive/...`), and the pipeline directory is a 100%-`"todo"`,
Draft/Discovery PRD for a product feature never raised in `docs/roadmap.md`, `docs/mmf.md`, or any
ADR. Adding it would route a real product decision around the documented process (roadmap/MMF/ADR)
that every other feature in this repo goes through. This is a documented **gap** — no policy says
"don't commit a vault directory" by name — but it's not a coin-flip: it fails the same test as
everything else in `docs/multi-agent-protocol.md`'s three-artifact model, and the safety tag +
tarball mean nothing is lost by leaving it out.

## Verification

```text
pnpm graph                                                  # PASS — 9 workspaces, 27 decision records
pnpm journal:index                                          # PASS
pnpm exec prettier --check ops/ai/README.md apps/web/CLAUDE.md AGENTS.md docs/journal/README.md \
  docs/journal/2026-08-21-zero-budget-hugging-face-for-bizos-ai.md apps/api/src/ai   # PASS (after
  # --write on ops/ai/README.md, which was unformatted; apps/web/AGENTS.md added to
  # .prettierignore — Next.js-regenerated, not ours to format)
pnpm --filter @bizo/api exec vitest run src/ai              # PASS — 4 files, 16 tests (matches the
  # 2026-08-21 journal record)
pnpm --filter @bizo/api exec eslint src/ai --max-warnings=0 # PASS — no output, no warnings
pnpm --filter @bizo/contracts build                         # PASS — dist/ was stale against main's
  # Sprint 7/8 CRM/inventory exports; rebuilt
pnpm --filter @bizo/api exec tsc --noEmit -p tsconfig.json  # PASS (after the contracts rebuild above)
pnpm lint / pnpm typecheck / pnpm test (full monorepo)      # NOT RUN — this host is at 28/30 GiB
  # used and 8/8 GiB swap used throughout this session (`free -h`); a full-monorepo run risks OOM on
  # a shared production box per the standing instruction to work serially and avoid heavy parallel
  # builds. Scoped checks above cover every file this session actually changed.
```

## Follow-ups

- Full-monorepo `pnpm check` / `pnpm lint` / `pnpm typecheck` / `pnpm test` have not been run
  against this exact tree; run them once the host has headroom, before the next production deploy.
- Decision 2 above: the next module-depth work (CRM/inventory continuation, or starting suppliers/
  projects) should open as its own Sprint-N/TASK-NN PR following the pattern in Sprints 1-8, not as
  an extension of this session.
- `.agent/registry.json` and `docs/decisions/README.md` both carry a pre-existing
  duplicate-numbering issue (two ADR-0021s, two ADR-0022s) from earlier parallel work; untouched
  here since renumbering an Accepted ADR rewrites accepted decision history, which
  `docs/decisions/README.md`'s own template note forbids. Flagging for the owner to decide a
  renumbering scheme.
- Three stashes exist on this host (`registry-claim` on `main`, `leftover` on
  `cursor/rc-server-entitlements`, `pre-merge-analysis stash` on `fix/brace-expansion-override`),
  all pre-dating this session. Left untouched; none blocked this work.

## Handoff notes

`cursor/hf-zero-budget-ai` now sits on top of current `main` (`09d21ff`) with only the
zero-budget-AI work staged. A PR against `main` is the next step (ADR-0014 requires PRs into `main`
with required checks green, squash-only — no direct push). Claim `clm_27b225fc`
(claude-resolve-open-items) covers `.agent`, `.gitignore`, `AGENTS.md`, `apps/api/src/ai`, `docs`;
release it once the PR is open.

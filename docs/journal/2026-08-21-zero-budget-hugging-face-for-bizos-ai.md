# Zero-budget Hugging Face for bizOS AI

Date: 2026-08-21

Agent: cursor-hf-zero

Scope: apps/api/src/ai

Status: Done

Related: pipelines/ai-invoice-ocr-automated-reconciliation; ops/ai/README.md

## Context

User asked to utilize Hugging Face for bizOS on this Ubuntu workstation with a strict zero-budget
constraint. HF MCP was already authenticated as free-tier user `pmwasim`. Existing `apps/api/src/ai`
services were heuristic/template stubs (regex OCR, TF-IDF RAG, template emails). Local Ollama was
already running with `qwen2.5-coder:7b` and `nomic-embed-text`.

## What changed

- Added `ZeroBudgetAiProvider` (`apps/api/src/ai/zero-budget-ai.provider.ts`) with Ollama-first,
  Hugging Face free Inference Router second, and hard ignore of paid (402) responses.
- Wired optional AI paths: `DraftEmailService.generateDraftWithAi`,
  `OcrExtractorService.extractFromBufferWithAi`, controller flags `useAi=true`, and
  `GET /ai/provider-status`.
- Documented zero-budget ops in `ops/ai/README.md` and added importable n8n workflow
  `ops/ai/n8n-bizos-invoice-ocr-zero-budget.json` (Ollama-only).
- Extended `.env.example` with AI/HF variables; local `.env` got Ollama settings only (no HF secret
  committed).
- Installed `hf` CLI via `uv tool install huggingface_hub` (CLI not logged in yet — MCP OAuth ≠
  classic CLI token).
- Branch: `cursor/hf-zero-budget-ai`.

## Decisions and trade-offs

- Local Ollama is the product default ($0, GPU on box). HF is secondary free-tier only.
- Kept deterministic heuristics as the sync default so existing tests and callers do not depend on
  LLM availability.
- Did not add paid Donut/OCR cloud Endpoints; recommended Apache/MIT Hub models for a future local
  download path.
- Skipped `docs/` ADR claim collision with `cursor-autonomy`; ops README holds the operational
  contract for now.

## Verification

```text
pnpm --filter @bizo/api exec vitest run src/ai   # passed — 4 files, 16 tests
curl Ollama /api/generate qwen2.5-coder:7b       # passed — reply "bizos-ok"
hf auth whoami                                   # failed — Not logged in (expected)
HF_TOKEN in .env                                 # not set — HF free path inactive until token
pnpm lint / typecheck / full test                # not run (scoped AI unit tests only)
```

## Follow-ups

- Add a classic HF token to local `.env` as `HF_TOKEN` (read + inference) and run `hf auth login` so
  Hub downloads + free router work when Ollama is down.
- Import n8n workflow into `ai-n8n` and point a webhook at supplier invoice intake.
- Optional later: local Donut/PaddleOCR download for true image OCR (still $0).

## Handoff notes

- Claim `clm_a14bd31f` (cursor-hf-zero) covers `apps/api/src/ai`, `.env.example`, `ops`.
- Do not set `HF_ALLOW_PAID`; provider ignores paid routes by design.
- MCP HF OAuth for Cursor expires ~2026-08-22T07:08:11Z; NestJS needs its own classic token.

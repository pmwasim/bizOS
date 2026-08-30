# Zero-budget Hugging Face + local AI for bizOS

**Budget rule:** $0 only. Local Ollama on this Ubuntu host is primary. Hugging Face is used for Hub
access and the free Inference Router when a token is present — never paid Endpoints, never billed
Spaces GPUs.

## What is wired

| Capability        | Path                             | Backend order                                    |
| ----------------- | -------------------------------- | ------------------------------------------------ |
| Provider probe    | `GET /api/v1/ai/provider-status` | Ollama → HF free → none                          |
| OCR parse         | `POST /api/v1/ai/ocr-parse`      | Heuristic; `useAi=true` adds local/HF LLM refine |
| Draft email       | `POST /api/v1/ai/draft-email`    | Template; `useAi=true` drafts via Ollama/HF free |
| Embeddings helper | `ZeroBudgetAiProvider.embed()`   | Ollama `nomic-embed-text` only                   |

Recommended Hub models for future local OCR (download free, run locally — do not buy Endpoints):

- [mychen76/invoice-and-receipts_donut_v1](https://huggingface.co/mychen76/invoice-and-receipts_donut_v1)
  (Apache-2.0)
- [katanaml-org/invoices-donut-model-v1](https://huggingface.co/katanaml-org/invoices-donut-model-v1)
  (MIT)
- [PaddlePaddle/PP-OCRv5_server_det](https://huggingface.co/PaddlePaddle/PP-OCRv5_server_det)
  (Apache-2.0)

Avoid CC-BY-NC invoice models for commercial bizOS use.

## Workstation facts (verified)

- Hugging Face account: free (`Pro: no`) — `@pmwasim`
- Ollama: `http://127.0.0.1:11434` with `qwen2.5-coder:7b`, `nomic-embed-text`, …
- Dual GTX 1070 (8 GB) — keep chat models ≤ ~7–8B Q4
- n8n Community: `http://127.0.0.1:5678` (`ai-n8n`)

## Env (local `.env` only — never commit secrets)

```bash
# Zero-budget AI
AI_LLM_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
AI_CHAT_MODEL=qwen2.5-coder:7b
AI_EMBED_MODEL=nomic-embed-text

# Hugging Face Hub + free Inference Router (optional secondary)
# Create a classic token with read + inference at https://huggingface.co/settings/tokens
HF_TOKEN=
# HF_CHAT_MODEL=HuggingFaceH4/zephyr-7b-beta
# HF_FREE_TIER_CONFIRMED must be explicitly "true" before this token is ever called. A 402 after
# the request is not proof the request would have been free if the account has billing enabled —
# so the router is skipped entirely (Ollama-only) until you've confirmed there is no payment
# method / credits on this HF account.
HF_FREE_TIER_CONFIRMED=false
```

CLI (installed via `uv tool install huggingface_hub`):

```bash
hf auth login
hf auth whoami
```

## n8n

Import `ops/ai/n8n-bizos-invoice-ocr-zero-budget.json` into the local Community instance. It calls
Ollama only (no cloud spend). The webhook trigger requires header auth — before activating the
workflow, create an n8n Header Auth credential named **"bizOS n8n webhook shared secret"** (Header
Name `Authorization`, value a locally generated bearer token; never commit it) and send the same
header from any caller. An unauthenticated webhook on this path would let anyone who can reach the
n8n instance trigger local Ollama inference for free.

## Hard no

- Hugging Face Pro spend, Inference Endpoints, paid ZeroGPU quotas used as product dependency
- Treating simulated forecasts as revenue
- Shipping secrets in git or journals

import { Injectable, Logger } from "@nestjs/common";

/**
 * Zero-budget AI routing for bizOS on the Ubuntu workstation.
 *
 * Priority (never spend money):
 * 1. Local Ollama on this host (GPU / CPU) — always free
 * 2. Hugging Face Inference Router free tier — only when HF_TOKEN is set
 * 3. Caller-supplied deterministic fallback
 *
 * Forbidden: paid Inference Endpoints, billed Spaces GPUs, Pro-only spend.
 */

export type ZeroBudgetBackend = "ollama" | "huggingface-free" | "none";

export interface ZeroBudgetAiStatus {
  ollamaReachable: boolean;
  huggingfaceConfigured: boolean;
  preferredBackend: ZeroBudgetBackend;
  chatModel: string;
  embedModel: string;
  budgetMode: "zero";
}

export interface ChatCompletionInput {
  system?: string;
  prompt: string;
  /** Soft cap; local Ollama may truncate earlier under load. */
  maxTokens?: number;
}

export interface ChatCompletionResult {
  text: string;
  backend: Exclude<ZeroBudgetBackend, "none">;
  model: string;
}

export interface EmbedResult {
  embedding: number[];
  backend: "ollama";
  model: string;
}

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_CHAT_MODEL = "qwen2.5-coder:7b";
const DEFAULT_EMBED_MODEL = "nomic-embed-text";
/** Free-tier chat model id for the HF router; may 402/429 — we then fall through. */
const DEFAULT_HF_CHAT_MODEL = "HuggingFaceH4/zephyr-7b-beta";

function readEnv(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function envFlagEnabled(name: string, defaultEnabled = true): boolean {
  const raw = readEnv(name);
  if (!raw) {
    return defaultEnabled;
  }
  return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

@Injectable()
export class ZeroBudgetAiProvider {
  private readonly logger = new Logger(ZeroBudgetAiProvider.name);

  public getStatus(): ZeroBudgetAiStatus {
    const huggingfaceConfigured = Boolean(readEnv("HF_TOKEN") || readEnv("HUGGING_FACE_HUB_TOKEN"));
    return {
      ollamaReachable: false,
      huggingfaceConfigured,
      preferredBackend: this.resolvePreferredBackend(false, huggingfaceConfigured),
      chatModel: readEnv("AI_CHAT_MODEL", DEFAULT_CHAT_MODEL),
      embedModel: readEnv("AI_EMBED_MODEL", DEFAULT_EMBED_MODEL),
      budgetMode: "zero",
    };
  }

  public async probe(): Promise<ZeroBudgetAiStatus> {
    const huggingfaceConfigured = Boolean(readEnv("HF_TOKEN") || readEnv("HUGGING_FACE_HUB_TOKEN"));
    const ollamaReachable = await this.isOllamaReachable();
    return {
      ollamaReachable,
      huggingfaceConfigured,
      preferredBackend: this.resolvePreferredBackend(ollamaReachable, huggingfaceConfigured),
      chatModel: readEnv("AI_CHAT_MODEL", DEFAULT_CHAT_MODEL),
      embedModel: readEnv("AI_EMBED_MODEL", DEFAULT_EMBED_MODEL),
      budgetMode: "zero",
    };
  }

  public async completeChat(input: ChatCompletionInput): Promise<ChatCompletionResult | null> {
    if (!envFlagEnabled("AI_LLM_ENABLED", true)) {
      return null;
    }

    const ollama = await this.completeViaOllama(input);
    if (ollama) {
      return ollama;
    }

    const hf = await this.completeViaHuggingFaceFree(input);
    if (hf) {
      return hf;
    }

    return null;
  }

  public async embed(text: string): Promise<EmbedResult | null> {
    if (!envFlagEnabled("AI_LLM_ENABLED", true)) {
      return null;
    }

    const baseUrl = readEnv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
    const model = readEnv("AI_EMBED_MODEL", DEFAULT_EMBED_MODEL);

    try {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        this.logger.debug(`Ollama embeddings HTTP ${response.status}`);
        return null;
      }
      const payload = (await response.json()) as { embedding?: number[] };
      if (!Array.isArray(payload.embedding) || payload.embedding.length === 0) {
        return null;
      }
      return { embedding: payload.embedding, backend: "ollama", model };
    } catch (error) {
      this.logger.debug(`Ollama embeddings failed: ${String(error)}`);
      return null;
    }
  }

  private resolvePreferredBackend(
    ollamaReachable: boolean,
    huggingfaceConfigured: boolean,
  ): ZeroBudgetBackend {
    if (ollamaReachable) {
      return "ollama";
    }
    if (huggingfaceConfigured) {
      return "huggingface-free";
    }
    return "none";
  }

  private async isOllamaReachable(): Promise<boolean> {
    const baseUrl = readEnv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(2_500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async completeViaOllama(
    input: ChatCompletionInput,
  ): Promise<ChatCompletionResult | null> {
    const baseUrl = readEnv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
    const model = readEnv("AI_CHAT_MODEL", DEFAULT_CHAT_MODEL);
    const prompt = input.system ? `${input.system}\n\n${input.prompt}` : input.prompt;

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            num_predict: input.maxTokens ?? 512,
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) {
        this.logger.debug(`Ollama generate HTTP ${response.status}`);
        return null;
      }
      const payload = (await response.json()) as { response?: string };
      const text = payload.response?.trim();
      if (!text) {
        return null;
      }
      return { text, backend: "ollama", model };
    } catch (error) {
      this.logger.debug(`Ollama generate failed: ${String(error)}`);
      return null;
    }
  }

  private async completeViaHuggingFaceFree(
    input: ChatCompletionInput,
  ): Promise<ChatCompletionResult | null> {
    const token = readEnv("HF_TOKEN") || readEnv("HUGGING_FACE_HUB_TOKEN");
    if (!token) {
      return null;
    }

    // Hard budget guard: a 402 after the fact only catches accounts with no payment method on
    // file. If the account has billing/credits enabled, the router can fulfil the call and
    // charge it, and there is no client-side signal that distinguishes that from a free
    // response — so bizOS never sends this request unless the operator has explicitly attested
    // the token is billing-free. Default is off even when HF_TOKEN is present.
    if (!envFlagEnabled("HF_FREE_TIER_CONFIRMED", false)) {
      this.logger.debug(
        "HF_TOKEN is set but HF_FREE_TIER_CONFIRMED is not; skipping Hugging Face to avoid risking paid usage.",
      );
      return null;
    }

    const routerUrl = readEnv("HF_ROUTER_URL", DEFAULT_HF_ROUTER_URL);
    const model = readEnv("HF_CHAT_MODEL", DEFAULT_HF_CHAT_MODEL);
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (input.system) {
      messages.push({ role: "system", content: input.system });
    }
    messages.push({ role: "user", content: input.prompt });

    try {
      const response = await fetch(routerUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: input.maxTokens ?? 512,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (response.status === 402) {
        this.logger.warn("Hugging Face returned payment-required; staying on zero-budget path.");
        return null;
      }
      if (!response.ok) {
        this.logger.debug(`HF free inference HTTP ${response.status}`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return null;
      }
      return { text, backend: "huggingface-free", model };
    } catch (error) {
      this.logger.debug(`HF free inference failed: ${String(error)}`);
      return null;
    }
  }
}

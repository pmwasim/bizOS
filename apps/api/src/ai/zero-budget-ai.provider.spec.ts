import { afterEach, describe, expect, it, vi } from "vitest";

import { ZeroBudgetAiProvider } from "./zero-budget-ai.provider.js";

describe("ZeroBudgetAiProvider", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("reports zero budget and prefers ollama when reachable", async () => {
    process.env.HF_TOKEN = "hf_test";
    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.endsWith("/api/tags")) {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const provider = new ZeroBudgetAiProvider();
    const status = await provider.probe();
    expect(status.budgetMode).toBe("zero");
    expect(status.ollamaReachable).toBe(true);
    expect(status.huggingfaceConfigured).toBe(true);
    expect(status.preferredBackend).toBe("ollama");
  });

  it("completes chat via ollama before attempting huggingface", async () => {
    delete process.env.HF_TOKEN;
    delete process.env.HUGGING_FACE_HUB_TOKEN;
    process.env.AI_LLM_ENABLED = "true";
    process.env.AI_CHAT_MODEL = "qwen2.5-coder:7b";

    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/generate")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ response: " hello from ollama " }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = new ZeroBudgetAiProvider();
    const result = await provider.completeChat({ prompt: "Say hi" });
    expect(result).toEqual({
      text: "hello from ollama",
      backend: "ollama",
      model: "qwen2.5-coder:7b",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses huggingface free router when ollama is down and token is set", async () => {
    process.env.HF_TOKEN = "hf_test_token";
    process.env.AI_LLM_ENABLED = "true";
    process.env.HF_CHAT_MODEL = "HuggingFaceH4/zephyr-7b-beta";

    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("11434")) {
        throw new Error("ollama offline");
      }
      if (url.includes("router.huggingface.co")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "hf free reply" } }],
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const provider = new ZeroBudgetAiProvider();
    const result = await provider.completeChat({ prompt: "Ping" });
    expect(result).toEqual({
      text: "hf free reply",
      backend: "huggingface-free",
      model: "HuggingFaceH4/zephyr-7b-beta",
    });
  });

  it("refuses paid huggingface responses and returns null", async () => {
    process.env.HF_TOKEN = "hf_test_token";
    process.env.AI_LLM_ENABLED = "true";

    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("11434")) {
        throw new Error("ollama offline");
      }
      return new Response(JSON.stringify({ error: "payment required" }), { status: 402 });
    }) as typeof fetch;

    const provider = new ZeroBudgetAiProvider();
    await expect(provider.completeChat({ prompt: "Ping" })).resolves.toBeNull();
  });

  it("returns null when LLM is disabled", async () => {
    process.env.AI_LLM_ENABLED = "false";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = new ZeroBudgetAiProvider();
    await expect(provider.completeChat({ prompt: "Ping" })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

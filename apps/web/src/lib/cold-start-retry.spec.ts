import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchThroughColdStart } from "./cold-start-retry.js";

function response(status: number): Response {
  return new Response(null, { status });
}

/** Runs the retry loop to completion while skipping the real backoff waits. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const result = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const settled = await result;
  if (settled.ok) {
    return settled.value;
  }
  throw settled.error;
}

describe("fetchThroughColdStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a successful response without retrying", async () => {
    const request = vi.fn().mockResolvedValue(response(200));

    const result = await settle(fetchThroughColdStart(request));

    expect(result.status).toBe(200);
    expect(request).toHaveBeenCalledOnce();
  });

  it("retries through a spin-up 503 and returns the eventual success", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValue(response(200));

    const result = await settle(fetchThroughColdStart(request));

    expect(result.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("does not retry a genuine application error", async () => {
    const request = vi.fn().mockResolvedValue(response(500));

    const result = await settle(fetchThroughColdStart(request));

    expect(result.status).toBe(500);
    expect(request).toHaveBeenCalledOnce();
  });

  it("does not retry a client error", async () => {
    const request = vi.fn().mockResolvedValue(response(401));

    const result = await settle(fetchThroughColdStart(request));

    expect(result.status).toBe(401);
    expect(request).toHaveBeenCalledOnce();
  });

  it("gives up and returns the last response when the cold start never finishes", async () => {
    const request = vi.fn().mockResolvedValue(response(503));

    const result = await settle(fetchThroughColdStart(request));

    expect(result.status).toBe(503);
    expect(request).toHaveBeenCalledTimes(6);
  });

  it("retries a mutation on 503 because the origin never saw it", async () => {
    const request = vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValue(response(201));

    const result = await settle(fetchThroughColdStart(request, { method: "POST" }));

    expect(result.status).toBe(201);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not replay a mutation on 502, which may have been processed", async () => {
    const request = vi.fn().mockResolvedValue(response(502));

    const result = await settle(fetchThroughColdStart(request, { method: "POST" }));

    expect(result.status).toBe(502);
    expect(request).toHaveBeenCalledOnce();
  });

  it("retries a read when the connection is refused", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue(response(200));

    const result = await settle(fetchThroughColdStart(request));

    expect(result.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("replays a mutation at most once on a connection failure", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(settle(fetchThroughColdStart(request, { method: "POST" }))).rejects.toThrow(
      "fetch failed",
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
});

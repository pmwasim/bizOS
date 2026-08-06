import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeepWarmMiddleware } from "./keep-warm.middleware.js";

const WAKE_URL = "https://bizos-health.example.workers.dev/wake";
const WAKE_SECRET = "a-secret-long-enough";

function createRequest(url: string) {
  return { originalUrl: url, url } as never;
}

function createResponse() {
  return {} as never;
}

describe("KeepWarmMiddleware", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("KEEP_WARM_URL", WAKE_URL);
    vi.stubEnv("KEEP_WARM_SECRET", WAKE_SECRET);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("pings the worker on a real request and calls next", () => {
    const middleware = new KeepWarmMiddleware();
    const next = vi.fn();

    middleware.use(createRequest("/api/v1/customers"), createResponse(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(WAKE_URL);
    expect(init).toMatchObject({ method: "POST" });
  });

  it("ignores health probes so the worker cannot keep itself warm", () => {
    const middleware = new KeepWarmMiddleware();
    const next = vi.fn();

    middleware.use(createRequest("/api/v1/health"), createResponse(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throttles repeat pings within the interval", () => {
    const middleware = new KeepWarmMiddleware();
    const next = vi.fn();

    for (let index = 0; index < 5; index += 1) {
      middleware.use(createRequest("/api/v1/customers"), createResponse(), next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("pings again once the throttle interval has elapsed", () => {
    vi.useFakeTimers();
    const middleware = new KeepWarmMiddleware();
    const next = vi.fn();

    middleware.use(createRequest("/api/v1/customers"), createResponse(), next);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    middleware.use(createRequest("/api/v1/customers"), createResponse(), next);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stays inert when the keep-warm target is not configured", () => {
    vi.stubEnv("KEEP_WARM_URL", "");
    vi.stubEnv("KEEP_WARM_SECRET", "");
    const middleware = new KeepWarmMiddleware();
    const next = vi.fn();

    middleware.use(createRequest("/api/v1/customers"), createResponse(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never lets a worker failure reach the request path", () => {
    fetchMock.mockRejectedValue(new Error("worker unreachable"));
    const middleware = new KeepWarmMiddleware();
    const next = vi.fn();

    expect(() => {
      middleware.use(createRequest("/api/v1/customers"), createResponse(), next);
    }).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
  });
});

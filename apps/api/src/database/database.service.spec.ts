import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "./database.service.js";

describe("DatabaseService", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://bizos.example.test");
    vi.stubEnv("DATABASE_URL", "postgresql://bizo:test@localhost:5432/bizo");
    vi.stubEnv("INTERNAL_AUTH_SECRET", "test-secret-that-is-at-least-32-characters");
    vi.stubEnv("SMTP_FROM", "quotes@example.test");
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("manages lifecycle with connect and disconnect", async () => {
    const service = new DatabaseService();
    const connectSpy = vi.spyOn(service.client, "$connect").mockResolvedValue(undefined);
    const disconnectSpy = vi.spyOn(service.client, "$disconnect").mockResolvedValue(undefined);

    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it("sets tenant and business config inside withScope transaction", async () => {
    const service = new DatabaseService();
    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    vi.spyOn(service.client, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as (tx: unknown) => unknown)(mockTx);
    });

    const result = await service.withScope({ tenantId: 10n, businessId: 20n }, async (tx) => {
      expect(tx).toBe(mockTx);
      return "scoped-result";
    });

    expect(result).toBe("scoped-result");
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
  });
});

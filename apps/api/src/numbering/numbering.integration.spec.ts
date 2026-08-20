import { type Prisma } from "@bizo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseService } from "../database/database.service.js";
import { allocateDocumentNumber } from "./numbering.js";

// Gated exactly like the other database-backed specs: skipped unless RUN_DATABASE_TESTS=true, so the
// default `vitest run` stays hermetic. This proves the gap-safety/race-safety claim against real
// PostgreSQL row locking rather than a mock.
const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("allocateDocumentNumber against PostgreSQL", () => {
  let database: DatabaseService;
  let tenantId: bigint;
  let businessId: bigint;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const created = await database.client.$transaction(async (tx: Prisma.TransactionClient) => {
      const tenant = await tx.tenant.create({ data: { name: "Numbering Test Co" } });
      const business = await tx.business.create({
        data: {
          tenantId: tenant.id,
          name: "Numbering Test",
          countryCode: "GB",
          baseCurrency: "GBP",
        },
      });
      // business_settings is RLS-protected; scope the session to the row we are about to insert,
      // mirroring how PlatformService.createBusiness seeds settings.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id.toString()}, true)`;
      await tx.$executeRaw`SELECT set_config('app.business_id', ${business.id.toString()}, true)`;
      await tx.businessSettings.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          invoicePrefix: "AX",
          numberPadWidth: 5,
        },
      });
      return { tenantId: tenant.id, businessId: business.id };
    });
    tenantId = created.tenantId;
    businessId = created.businessId;
  });

  afterAll(async () => {
    if (database) {
      await database.client.business.deleteMany({ where: { id: businessId } });
      await database.client.tenant.deleteMany({ where: { id: tenantId } });
      await database.onModuleDestroy();
    }
  });

  it("allocates sequential numbers with the configured prefix and pad width", async () => {
    const first = await database.withScope({ tenantId, businessId }, (tx) =>
      allocateDocumentNumber(tx, businessId, "SALES_ORDER"),
    );
    const second = await database.withScope({ tenantId, businessId }, (tx) =>
      allocateDocumentNumber(tx, businessId, "SALES_ORDER"),
    );

    expect(first.number).toBe("SO-00001");
    expect(second.number).toBe("SO-00002");
  });

  it("never hands two concurrent allocations the same number", async () => {
    const concurrency = 30;
    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        database.withScope({ tenantId, businessId }, (tx) =>
          allocateDocumentNumber(tx, businessId, "INVOICE"),
        ),
      ),
    );

    const numbers = results.map((result) => result.number);
    const distinct = new Set(numbers);

    // Every concurrent allocation received a distinct number...
    expect(distinct.size).toBe(concurrency);
    // ...they honor the configured prefix and width...
    for (const number of numbers) {
      expect(number).toMatch(/^AX-\d{5}$/);
    }
    // ...and the sequence is contiguous with no gaps or repeats.
    const sequences = results.map((result) => result.sequence).sort((a, b) => a - b);
    expect(sequences).toEqual(Array.from({ length: concurrency }, (_, index) => index + 1));
  });
});

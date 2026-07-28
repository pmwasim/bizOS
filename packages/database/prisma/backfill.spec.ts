// Phase 13 — Backfill classification and repeat-safety tests.
//
// The classification logic (service-po-approval vs default-erp) is tested in two layers:
//
//   1. Pure unit tests (always run) that mirror the SQL CASE WHEN logic in TypeScript.
//      These verify the four classification scenarios from the Phase 13 spec without
//      requiring a live database.
//
//   2. DB-gated tests (RUN_DATABASE_TESTS=true) that execute the actual migration SQL
//      against a scratch PostgreSQL database and verify:
//        - Every business gets a primary assignment after the first run.
//        - Running the migration again produces no new assignments (repeat-safe).
//        - The DO $$ verification block does not raise when all businesses are assigned.
//
// The migration SQL is the source of truth for the backfill; the TypeScript classification
// function below mirrors it so the unit tests can validate the logic without a database.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Client as PgClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_SQL_PATH = join(
  __dirname,
  "migrations",
  "20260728020200_backfill_configuration_assignments",
  "migration.sql",
);

export interface BusinessClassificationEvidence {
  poCount: number;
  approvalEvidenceCount: number;
  invoiceFromPoCount: number;
}

export interface BusinessClassification {
  templateCode: "service-po-approval" | "default-erp";
  version: "1.0.0";
}

/**
 * Mirror of the SQL classification CASE WHEN in the Phase 13 migration.
 *
 * service-po-approval v1.0.0 if the business has at least one PurchaseOrder with approval
 * evidence (a non-superseded StoredObject of kind APPROVAL_EVIDENCE linked to that PO) OR
 * at least one Document (invoice) linked to a PurchaseOrder. Otherwise default-erp v1.0.0
 * (the safe fallback, including ambiguous test businesses with no documents at all).
 */
export function classifyBusiness(evidence: BusinessClassificationEvidence): BusinessClassification {
  const usesServicePo = evidence.approvalEvidenceCount > 0 || evidence.invoiceFromPoCount > 0;
  return usesServicePo
    ? { templateCode: "service-po-approval", version: "1.0.0" }
    : { templateCode: "default-erp", version: "1.0.0" };
}

describe("Phase 13 backfill classification logic (pure unit)", () => {
  it("classifies a business with a PO + approval evidence as service-po-approval", () => {
    const result = classifyBusiness({
      poCount: 1,
      approvalEvidenceCount: 1,
      invoiceFromPoCount: 0,
    });
    expect(result.templateCode).toBe("service-po-approval");
    expect(result.version).toBe("1.0.0");
  });

  it("classifies a business with no PO as default-erp", () => {
    const result = classifyBusiness({
      poCount: 0,
      approvalEvidenceCount: 0,
      invoiceFromPoCount: 0,
    });
    expect(result.templateCode).toBe("default-erp");
    expect(result.version).toBe("1.0.0");
  });

  it("classifies a business with an invoice linked to a PO as service-po-approval", () => {
    const result = classifyBusiness({
      poCount: 1,
      approvalEvidenceCount: 0,
      invoiceFromPoCount: 1,
    });
    expect(result.templateCode).toBe("service-po-approval");
    expect(result.version).toBe("1.0.0");
  });

  it("classifies a test business with no documents as default-erp (fallback)", () => {
    const result = classifyBusiness({
      poCount: 0,
      approvalEvidenceCount: 0,
      invoiceFromPoCount: 0,
    });
    expect(result.templateCode).toBe("default-erp");
    expect(result.version).toBe("1.0.0");
  });

  it("prefers service-po-approval when both approval evidence and invoice-from-PO exist", () => {
    const result = classifyBusiness({
      poCount: 3,
      approvalEvidenceCount: 2,
      invoiceFromPoCount: 5,
    });
    expect(result.templateCode).toBe("service-po-approval");
  });

  it("classifies a business with POs but no approval evidence and no invoice-from-PO as default-erp", () => {
    const result = classifyBusiness({
      poCount: 2,
      approvalEvidenceCount: 0,
      invoiceFromPoCount: 0,
    });
    expect(result.templateCode).toBe("default-erp");
  });

  it("classifies a business with only invoice-from-PO (no approval evidence) as service-po-approval", () => {
    const result = classifyBusiness({
      poCount: 1,
      approvalEvidenceCount: 0,
      invoiceFromPoCount: 1,
    });
    expect(result.templateCode).toBe("service-po-approval");
  });
});

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true" && !!process.env.DATABASE_URL;

describe.runIf(databaseEnabled)("Phase 13 backfill migration (postgres)", () => {
  let pgClient: PgClient;

  beforeAll(async () => {
    const { Client } = await import("pg");
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL!,
      connectionTimeoutMillis: 5_000,
    });
    await pgClient.connect();
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.end();
    }
  });

  async function ensureSeedsRun() {
    // Seeds are idempotent; running them ensures the configuration templates and
    // published versions exist before the backfill classification runs.
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { PrismaClient } = await import("../generated/client/client.js");
    const { runAllSeeds } = await import("./seeds/index.js");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      max: 10,
    });
    const prisma = new PrismaClient({ adapter });
    try {
      await runAllSeeds(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }

  async function ensurePublishedVersionsExist(): Promise<boolean> {
    const result = await pgClient.query(`
      SELECT COUNT(*)::int AS count
      FROM configuration_template_versions v
      JOIN configuration_templates t ON t.id = v.template_id
      WHERE t.code IN ('default-erp', 'service-po-approval')
        AND v.version = '1.0.0'
        AND v.status = 'PUBLISHED'
    `);
    return Number(result.rows[0]?.count ?? 0) >= 2;
  }

  async function countPrimaryAssignments(): Promise<number> {
    const result = await pgClient.query(`
      SELECT COUNT(*)::int AS count
      FROM business_configuration_assignments
      WHERE is_primary = true
    `);
    return Number(result.rows[0]?.count ?? 0);
  }

  async function countBusinesses(): Promise<number> {
    const result = await pgClient.query(`
      SELECT COUNT(*)::int AS count FROM businesses
    `);
    return Number(result.rows[0]?.count ?? 0);
  }

  async function countAuditEventsForBackfill(): Promise<number> {
    const result = await pgClient.query(`
      SELECT COUNT(*)::int AS count
      FROM configuration_audit_events
      WHERE reason = 'backfill'
        AND action = 'ASSIGN'
        AND entity_type = 'BusinessConfigurationAssignment'
    `);
    return Number(result.rows[0]?.count ?? 0);
  }

  async function countUnassignedBusinesses(): Promise<number> {
    const result = await pgClient.query(`
      SELECT COUNT(*)::int AS count
      FROM businesses b
      LEFT JOIN business_configuration_assignments bca
        ON bca.tenant_id = b.tenant_id
       AND bca.business_id = b.id
       AND bca.is_primary = true
      WHERE bca.id IS NULL
    `);
    return Number(result.rows[0]?.count ?? 0);
  }

  async function executeMigration(): Promise<void> {
    const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
    await pgClient.query(sql);
  }

  it("ensures published configuration versions exist before backfill", async () => {
    await ensureSeedsRun();
    const exists = await ensurePublishedVersionsExist();
    expect(exists).toBe(true);
  }, 60_000);

  it("assigns every existing business a primary configuration on first run", async () => {
    await ensureSeedsRun();
    const beforeBusinesses = await countBusinesses();
    const beforeAssignments = await countPrimaryAssignments();

    await executeMigration();

    const afterAssignments = await countPrimaryAssignments();
    const unassigned = await countUnassignedBusinesses();

    // Every business should have a primary assignment after the migration.
    expect(unassigned).toBe(0);
    expect(afterAssignments).toBe(beforeBusinesses);
    // The migration should have created assignments for businesses that lacked them.
    expect(afterAssignments).toBeGreaterThanOrEqual(beforeAssignments);
  }, 60_000);

  it("is repeat-safe: running the migration twice produces no new assignments", async () => {
    await ensureSeedsRun();
    await executeMigration();

    const afterFirst = await countPrimaryAssignments();
    const auditAfterFirst = await countAuditEventsForBackfill();

    // Run the migration again. ON CONFLICT DO NOTHING should make this a no-op for
    // assignments that already exist.
    await executeMigration();

    const afterSecond = await countPrimaryAssignments();
    const auditAfterSecond = await countAuditEventsForBackfill();

    expect(afterSecond).toBe(afterFirst);
    // The second run should not create any new audit events either, because the
    // INSERT...RETURNING feeds the audit INSERT and the first INSERT was a no-op.
    expect(auditAfterSecond).toBe(auditAfterFirst);
  }, 60_000);

  it("leaves no business unassigned (DO block verification passes)", async () => {
    await ensureSeedsRun();
    // The migration's Step C DO $$ block raises an exception if any business lacks a
    // primary assignment. If executeMigration() does not throw, the verification passed.
    await expect(executeMigration()).resolves.toBeUndefined();
    const unassigned = await countUnassignedBusinesses();
    expect(unassigned).toBe(0);
  }, 60_000);
});

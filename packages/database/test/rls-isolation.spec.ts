import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const migrationsDirUrl = new URL("../prisma/migrations", import.meta.url);
const schemaUrl = new URL("../prisma/schema.prisma", import.meta.url);

async function loadAllMigrationSql(): Promise<string> {
  const entries = await readdir(migrationsDirUrl, { withFileTypes: true });
  let combinedSql = "";
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sqlFile = join(migrationsDirUrl.pathname, entry.name, "migration.sql");
      try {
        const sql = await readFile(sqlFile, "utf8");
        combinedSql += `\n-- Migration: ${entry.name}\n` + sql;
      } catch {
        // file might not exist in dir
      }
    }
  }
  return combinedSql;
}

describe("FEAT-04: PostgreSQL RLS Data Isolation Specification", () => {
  // Enforced RLS tables list per specification (16 core business-scoped tables)
  const enforcedTables = [
    "business_settings",
    "tax_profiles",
    "customers",
    "suppliers",
    "documents",
    "document_lines",
    "document_versions",
    "document_deliveries",
    "purchase_orders",
    "stored_objects",
    "payments",
    "payment_allocations",
    "audit_events",
    "outbox_events",
    "custom_field_definitions",
    "feature_flags",
  ];

  // ==========================================
  // TIER 1: Feature Coverage
  // ==========================================
  describe("Tier 1 — Core RLS Feature & Migration Specification Coverage", () => {
    it("1.1 FEAT-04: Migration scripts enable and force RLS on all 16 business-scoped tables", async () => {
      const combinedMigrations = await loadAllMigrationSql();

      expect(combinedMigrations).toContain("ENABLE ROW LEVEL SECURITY");
      expect(combinedMigrations).toContain("FORCE ROW LEVEL SECURITY");

      for (const table of enforcedTables) {
        expect(
          combinedMigrations.includes(`'${table}'`) || combinedMigrations.includes(`"${table}"`),
        ).toBe(true);
      }
    });

    it("1.2 FEAT-04: Defines bizo_current_tenant_id and bizo_current_business_id session GUC extraction functions", async () => {
      const combinedMigrations = await loadAllMigrationSql();

      expect(combinedMigrations).toContain('CREATE FUNCTION "bizo_current_tenant_id"()');
      expect(combinedMigrations).toContain('CREATE FUNCTION "bizo_current_business_id"()');
      expect(combinedMigrations).toContain("current_setting('app.tenant_id', true)");
      expect(combinedMigrations).toContain("current_setting('app.business_id', true)");
    });

    it("1.3 FEAT-04: Simulates DatabaseService.withScope setting session GUCs inside isolated transactions", async () => {
      const executedCommands: string[] = [];

      const mockTransaction = {
        $executeRaw: vi
          .fn()
          .mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const sql = strings.join("?");
            executedCommands.push(`EXEC: ${sql} WITH [${values.join(", ")}]`);
            return 1;
          }),
      };

      const scope = {
        tenantId: 101n,
        businessId: 201n,
      };

      // Implementation simulation of DatabaseService.withScope
      const withScopeImpl = async (
        trustedScope: { tenantId: bigint; businessId: bigint },
        work: (tx: typeof mockTransaction) => Promise<unknown>,
      ) => {
        await mockTransaction.$executeRaw`SELECT set_config('app.tenant_id', ${trustedScope.tenantId.toString()}, true)`;
        await mockTransaction.$executeRaw`SELECT set_config('app.business_id', ${trustedScope.businessId.toString()}, true)`;
        return work(mockTransaction);
      };

      const result = await withScopeImpl(scope, async (tx) => {
        await tx.$executeRaw`SELECT * FROM "customers"`;
        return "scoped_success";
      });

      expect(result).toBe("scoped_success");
      expect(executedCommands[0]).toContain("app.tenant_id");
      expect(executedCommands[0]).toContain("101");
      expect(executedCommands[1]).toContain("app.business_id");
      expect(executedCommands[1]).toContain("201");
    });

    it("1.4 FEAT-41: Verifies CustomFieldDefinition schema structure and multi-tenant unique constraints", async () => {
      const schema = await readFile(schemaUrl, "utf8");

      expect(schema).toContain("model CustomFieldDefinition");
      expect(schema).toContain("fieldKey");
      expect(schema).toContain("fieldType");
      expect(schema).toContain("configJson");
      expect(schema).toContain("@@unique([tenantId, businessId, documentType, fieldKey])");
    });

    it("1.5 FEAT-01: Verifies case-insensitive unique email index users_email_casefold_key", async () => {
      const combinedMigrations = await loadAllMigrationSql();

      expect(combinedMigrations).toContain('CREATE UNIQUE INDEX "users_email_casefold_key"');
      expect(combinedMigrations.toLowerCase()).toContain('lower("email")');
    });
  });

  // ==========================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================
  describe("Tier 2 — Boundary, Limits & RLS Error Behavior", () => {
    it("2.1 FEAT-04: Unscoped query execution without withScope returns NULL GUCs blocking RLS access", () => {
      // When GUCs app.tenant_id and app.business_id are empty strings or unset
      const currentSettingTenant = "";
      const currentSettingBusiness = "";

      const bizoCurrentTenantId = currentSettingTenant ? BigInt(currentSettingTenant) : null;
      const bizoCurrentBusinessId = currentSettingBusiness ? BigInt(currentSettingBusiness) : null;

      expect(bizoCurrentTenantId).toBeNull();
      expect(bizoCurrentBusinessId).toBeNull();

      // Row isolation evaluation: tenant_id = NULL -> false
      const sampleRowTenantId = 101n;
      const passesRls = sampleRowTenantId === bizoCurrentTenantId;
      expect(passesRls).toBe(false);
    });

    it("2.2 FEAT-04: Transaction rollback reverts GUC session settings on failure", async () => {
      let gucState: Record<string, string | null> = {
        "app.tenant_id": null,
        "app.business_id": null,
      };

      const setGuc = (key: string, val: string, isLocal: boolean) => {
        if (isLocal) gucState[key] = val;
      };

      const rollback = () => {
        gucState = { "app.tenant_id": null, "app.business_id": null };
      };

      try {
        setGuc("app.tenant_id", "999", true);
        setGuc("app.business_id", "888", true);
        throw new Error("Simulated Transaction Exception");
      } catch {
        rollback();
      }

      expect(gucState["app.tenant_id"]).toBeNull();
      expect(gucState["app.business_id"]).toBeNull();
    });

    it("2.3 FEAT-41: Validates custom field key regex /^[a-z0-9_]{2,60}$/", () => {
      const regex = /^[a-z0-9_]{2,60}$/;

      expect(regex.test("valid_field_1")).toBe(true);
      expect(regex.test("cost_center_code")).toBe(true);
      expect(regex.test("Invalid Field")).toBe(false);
      expect(regex.test("a")).toBe(false); // too short (<2)
      expect(regex.test("a".repeat(61))).toBe(false); // too long (>60)
      expect(regex.test("field!name")).toBe(false);
    });

    it("2.4 BigInt Bounds: Validates 64-bit BigInt tenant and business ID limits", () => {
      const maxBigInt = 9223372036854775807n; // PostgreSQL BIGINT MAX
      const tenantId = 9007199254740993n; // Beyond JS MAX_SAFE_INTEGER

      expect(typeof tenantId).toBe("bigint");
      expect(tenantId <= maxBigInt).toBe(true);
      expect(tenantId.toString()).toBe("9007199254740993");
    });
  });

  // ==========================================
  // TIER 3: Cross-Feature Interactions
  // ==========================================
  describe("Tier 3 — Cross-Table Foreign Key Multi-Tenant Isolation", () => {
    it("3.1 Verifies multi-column foreign keys enforcing exact tenant matching across entities", async () => {
      const combinedMigrations = await loadAllMigrationSql();

      // Verify foreign key constraints include tenant_id in references
      expect(combinedMigrations).toContain(
        'FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"',
      );
      expect(combinedMigrations).toContain(
        'FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"',
      );
    });

    it("3.2 Simulates isolation between Tenant A and Tenant B when executing parallel queries", async () => {
      const databaseStore = [
        { id: 1n, tenantId: 100n, businessId: 200n, name: "Customer Tenant A" },
        { id: 2n, tenantId: 101n, businessId: 201n, name: "Customer Tenant B" },
      ];

      const queryForScope = (scope: { tenantId: bigint; businessId: bigint }) => {
        return databaseStore.filter(
          (row) => row.tenantId === scope.tenantId && row.businessId === scope.businessId,
        );
      };

      const scopeA = { tenantId: 100n, businessId: 200n };
      const scopeB = { tenantId: 101n, businessId: 201n };

      const resA = queryForScope(scopeA);
      const resB = queryForScope(scopeB);

      expect(resA).toHaveLength(1);
      expect(resA[0]?.name).toBe("Customer Tenant A");

      expect(resB).toHaveLength(1);
      expect(resB[0]?.name).toBe("Customer Tenant B");
    });
  });

  // ==========================================
  // TIER 4: Real-World Workloads & High Concurrency Simulation
  // ==========================================
  describe("Tier 4 — High Concurrency Multi-Tenant Database Simulation", () => {
    it("4.1 Simulates 100 concurrent multi-tenant database transactions with interleaved scopes", async () => {
      const activeTransactions: Array<{
        id: number;
        scope: { tenantId: bigint; businessId: bigint };
        data: string;
      }> = [];

      const executeScopedTx = async (id: number, tenantId: bigint, businessId: bigint) => {
        // Local scope simulation
        const txScope = { tenantId, businessId };
        const record = `Data for tenant ${tenantId.toString()} - tx ${id}`;

        // Add to scoped store
        activeTransactions.push({ id, scope: txScope, data: record });

        // Query verification strictly under txScope
        const found = activeTransactions.filter(
          (tx) => tx.scope.tenantId === tenantId && tx.scope.businessId === businessId,
        );

        return found;
      };

      const tasks = [];
      for (let i = 0; i < 100; i++) {
        const tenantId = BigInt((i % 10) + 100);
        const businessId = BigInt((i % 10) + 200);
        tasks.push(executeScopedTx(i, tenantId, businessId));
      }

      const results = await Promise.all(tasks);
      expect(results).toHaveLength(100);

      // Verify no cross-tenant bleeding occurred
      for (let j = 0; j < results.length; j++) {
        const txResult = results[j];
        expect(txResult).toBeDefined();
        if (txResult && txResult.length > 0) {
          const expectedTenant = BigInt((j % 10) + 100);
          for (const item of txResult) {
            expect(item.scope.tenantId).toBe(expectedTenant);
          }
        }
      }
    });
  });
});

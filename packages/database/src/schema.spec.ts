import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../prisma/migrations/20260727090000_mvp_core/migration.sql",
  import.meta.url,
);

describe("MVP database migration", () => {
  it("enforces exact scope on document relationships", async () => {
    const migration = await readFile(migrationUrl, "utf8");

    expect(migration).toContain(
      'FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("tenant_id", "business_id", "document_id", "document_version") REFERENCES "document_versions"',
    );
  });

  it("enables forced tenant and business row-level isolation", async () => {
    const migration = await readFile(migrationUrl, "utf8");

    expect(migration).toContain("ALTER TABLE %I ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE %I FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("tenant_id = bizo_current_tenant_id()");
    expect(migration).toContain("business_id = bizo_current_business_id()");
  });

  it("constrains money, tax, dates, and normalized identity values", async () => {
    const migration = await readFile(migrationUrl, "utf8");

    expect(migration).toContain('"total_minor" = "subtotal_minor" + "tax_minor"');
    expect(migration).toContain('"tax_rate_ppm" BETWEEN 0 AND 1000000');
    expect(migration).toContain('"valid_until" >= "issue_date"');
    expect(migration).toContain('CREATE UNIQUE INDEX "users_email_casefold_key"');
  });
});

describe("purchase order approval readiness migration", () => {
  const poMigrationUrl = new URL(
    "../prisma/migrations/20260727193000_purchase_orders_approval_readiness/migration.sql",
    import.meta.url,
  );

  it("keeps purchase orders and stored objects under forced RLS", async () => {
    const migration = await readFile(poMigrationUrl, "utf8");
    expect(migration).toContain('"purchase_orders"');
    expect(migration).toContain('"stored_objects"');
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("purchase_orders_active_customer_po_number_key");
    expect(migration).toContain("ON DELETE RESTRICT");
  });

  it("links purchase orders to same-business customers and quotations", async () => {
    const migration = await readFile(poMigrationUrl, "utf8");
    expect(migration).toContain(
      'FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("tenant_id", "business_id", "quotation_id") REFERENCES "documents"',
    );
  });
});

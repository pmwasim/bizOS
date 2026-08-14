-- The products table is business-scoped (tenant_id + business_id) but was the only such table
-- without row-level security. It was created by 20260807050000_products, which sorts *after*
-- 20260807050000_enable_rls_missing_tables, so the table did not yet exist when that migration
-- enumerated the tables to protect, and it was never added afterwards.
--
-- Without this, tenant isolation for products depends entirely on the application always filtering
-- by tenant_id/business_id. Every peer table fails closed at the database instead; products did not.
--
-- Safe to enable: every query in apps/api/src/products/products.service.ts runs through
-- DatabaseService.withScope, which sets app.tenant_id and app.business_id via set_config before
-- touching the table, so the policy below has the session context it needs.

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_business_isolation ON "products"
  USING (
    tenant_id = bizo_current_tenant_id()
    AND business_id = bizo_current_business_id()
  )
  WITH CHECK (
    tenant_id = bizo_current_tenant_id()
    AND business_id = bizo_current_business_id()
  );

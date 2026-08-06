-- This is deliberately separate from the enum migration: PostgreSQL does not permit a newly
-- added enum value to be used until the preceding transaction has committed.
INSERT INTO "roles" ("public_id", "tenant_id", "code", "name", "permissions", "created_at", "updated_at")
SELECT gen_random_uuid(), tenants.id, role_catalog.code, role_catalog.name, role_catalog.permissions, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants"
CROSS JOIN (
  VALUES
    ('STAFF'::"RoleCode", 'Staff member'::VARCHAR(80), ARRAY['business.read', 'customers.*', 'quotations.*']::VARCHAR(80)[]),
    ('ACCOUNTANT'::"RoleCode", 'Accountant'::VARCHAR(80), ARRAY['business.read', 'customers.read', 'quotations.read', 'invoices.read']::VARCHAR(80)[]),
    ('EXTERNAL_AUDITOR'::"RoleCode", 'External auditor'::VARCHAR(80), ARRAY['business.read', 'customers.read', 'quotations.read', 'invoices.read']::VARCHAR(80)[])
) AS role_catalog(code, name, permissions)
ON CONFLICT ("tenant_id", "code") DO NOTHING;

-- Auditable cutover QA cleanup (FORCE RLS aware).
-- Target businesses only:
--   a4ebfa34-be55-44aa-8886-6b69c9a760c1  Deploy QA Business
--   c7d6cc1c-a787-4c3f-af97-a7f5aff344bd  Ubuntu Cutover QA Business
-- Applied 2026-07-27 via Prisma MCP against Primary. Keep for replay/audit.

DO $$
DECLARE
  biz RECORD;
  uid BIGINT;
  tid BIGINT;
BEGIN
  FOR biz IN
    SELECT id, tenant_id, public_id, name
    FROM businesses
    WHERE public_id IN (
      'a4ebfa34-be55-44aa-8886-6b69c9a760c1',
      'c7d6cc1c-a787-4c3f-af97-a7f5aff344bd'
    )
  LOOP
    PERFORM set_config('app.tenant_id', biz.tenant_id::text, true);
    PERFORM set_config('app.business_id', biz.id::text, true);

    DELETE FROM document_deliveries WHERE tenant_id = biz.tenant_id AND business_id = biz.id;
    DELETE FROM document_versions WHERE tenant_id = biz.tenant_id AND business_id = biz.id;
    DELETE FROM document_lines WHERE tenant_id = biz.tenant_id AND business_id = biz.id;
    DELETE FROM documents WHERE tenant_id = biz.tenant_id AND business_id = biz.id;
    DELETE FROM customers WHERE tenant_id = biz.tenant_id AND business_id = biz.id;
    DELETE FROM audit_events WHERE tenant_id = biz.tenant_id AND business_id = biz.id;
    DELETE FROM outbox_events WHERE tenant_id = biz.tenant_id AND business_id = biz.id;

    PERFORM set_config('app.tenant_id', '', true);
    PERFORM set_config('app.business_id', '', true);

    DELETE FROM businesses WHERE id = biz.id;

    tid := biz.tenant_id;
    IF NOT EXISTS (SELECT 1 FROM businesses WHERE tenant_id = tid) THEN
      SELECT user_id INTO uid FROM memberships WHERE tenant_id = tid LIMIT 1;
      DELETE FROM business_access WHERE tenant_id = tid;
      DELETE FROM memberships WHERE tenant_id = tid;
      DELETE FROM roles WHERE tenant_id = tid;
      DELETE FROM tenants WHERE id = tid;
      IF uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = uid) THEN
        DELETE FROM users WHERE id = uid;
      END IF;
    END IF;
  END LOOP;
END $$;

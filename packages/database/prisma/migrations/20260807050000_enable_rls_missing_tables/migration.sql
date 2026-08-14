-- Enable and Force Row Level Security with tenant_business_isolation policy for missing business-scoped tables

DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'suppliers',
      'payments',
      'payment_allocations',
      'credit_note_allocations',
      'leads',
      'opportunities',
      'projects',
      'inventory_items',
      'business_configuration_assignments',
      'document_workflow_contexts',
      'custom_field_definitions',
      'feature_flags',
      'customization_requests'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_business_isolation ON %I
       USING (
         tenant_id = bizo_current_tenant_id()
         AND business_id = bizo_current_business_id()
       )
       WITH CHECK (
         tenant_id = bizo_current_tenant_id()
         AND business_id = bizo_current_business_id()
       )',
      table_name
    );
  END LOOP;
END $$;

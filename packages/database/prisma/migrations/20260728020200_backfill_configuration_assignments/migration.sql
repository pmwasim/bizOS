-- Phase 13 — Additive backfill of BusinessConfigurationAssignment and DocumentWorkflowContext.
--
-- Backfills every EXISTING business with a reviewed primary configuration assignment and
-- associates historical Document rows with a DocumentWorkflowContext capturing the
-- configuration version under which they were created. Preserves all existing data,
-- identifiers, URLs, numbering, and records. Repeat-safe via ON CONFLICT DO NOTHING.
--
-- Classification logic (deterministic, evidence-based):
--   1. service-po-approval v1.0.0 if the business has at least one PurchaseOrder with
--      approval evidence (a non-superseded StoredObject of kind APPROVAL_EVIDENCE linked
--      to that PO) OR at least one Document (invoice) linked to a PurchaseOrder.
--   2. Otherwise default-erp v1.0.0 (the safe fallback, including ambiguous test
--      businesses with no documents at all).
--
-- Tenant isolation: each business gets its own assignment scoped to its tenant. The
-- partial unique index business_configuration_assignments_one_primary ensures at most
-- one primary assignment per (tenant_id, business_id).

-- Step A — Assign every existing business a primary configuration.
-- Insert primary assignments for businesses that don't yet have one, then write a
-- ConfigurationAuditEvent per newly created assignment.

WITH business_classification AS (
  SELECT
    b.id AS business_id,
    b.tenant_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM purchase_orders po
        JOIN stored_objects so
          ON so.tenant_id = po.tenant_id
         AND so.business_id = po.business_id
         AND so.purchase_order_id = po.id
         AND so.kind = 'APPROVAL_EVIDENCE'
         AND so.superseded_at IS NULL
        WHERE po.tenant_id = b.tenant_id
          AND po.business_id = b.id
      ) THEN 'service-po-approval'
      WHEN EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.tenant_id = b.tenant_id
          AND d.business_id = b.id
          AND d.purchase_order_id IS NOT NULL
      ) THEN 'service-po-approval'
      ELSE 'default-erp'
    END AS template_code
  FROM businesses b
),
published_versions AS (
  SELECT
    t.code AS template_code,
    v.id AS version_id
  FROM configuration_templates t
  JOIN configuration_template_versions v ON v.template_id = t.id
  WHERE t.code IN ('default-erp', 'service-po-approval')
    AND v.version = '1.0.0'
    AND v.status = 'PUBLISHED'
),
new_assignments AS (
  INSERT INTO business_configuration_assignments (
    public_id,
    tenant_id,
    business_id,
    configuration_template_version_id,
    is_primary,
    assigned_by_membership_id,
    reason,
    assigned_at
  )
  SELECT
    gen_random_uuid(),
    c.tenant_id,
    c.business_id,
    pv.version_id,
    true,
    NULL,
    'backfill: existing business configuration assignment',
    CURRENT_TIMESTAMP
  FROM business_classification c
  JOIN published_versions pv ON pv.template_code = c.template_code
  ON CONFLICT (tenant_id, business_id) WHERE is_primary = true DO NOTHING
  RETURNING
    id,
    public_id,
    tenant_id,
    business_id,
    configuration_template_version_id
)
INSERT INTO configuration_audit_events (
  public_id,
  tenant_id,
  actor_membership_id,
  actor_system_admin_id,
  action,
  entity_type,
  entity_id,
  before_json,
  after_json,
  diff_json,
  reason,
  created_at
)
SELECT
  gen_random_uuid(),
  na.tenant_id,
  NULL,
  NULL,
  'ASSIGN',
  'BusinessConfigurationAssignment',
  na.id,
  NULL,
  jsonb_build_object(
    'assignmentId', na.public_id,
    'businessId', na.business_id,
    'tenantId', na.tenant_id,
    'configurationTemplateVersionId', na.configuration_template_version_id,
    'templateCode', bc.template_code,
    'templateVersion', '1.0.0',
    'isPrimary', true,
    'reason', 'backfill: existing business configuration assignment'
  ),
  NULL,
  'backfill',
  CURRENT_TIMESTAMP
FROM new_assignments na
JOIN business_classification bc
  ON bc.business_id = na.business_id
 AND bc.tenant_id = na.tenant_id;

-- Step B — Associate historical documents with a workflow context.
-- For each Document row that does NOT already have a DocumentWorkflowContext, insert one
-- using the business's primary assignment's configurationTemplateVersionId. Resolve the
-- workflowTemplateVersionId from the snapshot's workflows[] array by matching documentType
-- to the document's type. Best-effort workflowState mapping from document.status.

WITH business_primary AS (
  SELECT
    bca.business_id,
    bca.tenant_id,
    bca.configuration_template_version_id
  FROM business_configuration_assignments bca
  WHERE bca.is_primary = true
),
snapshot_workflow_refs AS (
  -- Unnest the workflows[] array from each primary assignment's configuration snapshot
  -- into one row per (business, documentType, workflowTemplateCode, version) tuple.
  SELECT
    bp.business_id,
    bp.tenant_id,
    bp.configuration_template_version_id,
    ctv.public_id AS configuration_template_version_public_id,
    ctv.template_id,
    wf.value->>'documentType' AS document_type,
    wf.value->>'workflowTemplateCode' AS workflow_template_code,
    COALESCE(wf.value->>'version', '1.0.0') AS workflow_version
  FROM business_primary bp
  JOIN configuration_template_versions ctv ON ctv.id = bp.configuration_template_version_id
  JOIN LATERAL jsonb_array_elements(ctv.snapshot_json->'workflows') AS wf ON true
),
workflow_version_ids AS (
  -- Resolve each workflow ref to its published WorkflowTemplateVersion id. We pick the
  -- latest published version matching the code (and the ref's version when specified).
  SELECT
    swr.business_id,
    swr.tenant_id,
    swr.configuration_template_version_id,
    swr.configuration_template_version_public_id,
    swr.document_type,
    wt.code AS workflow_template_code,
    (
      SELECT wtv.id
      FROM workflow_template_versions wtv
      JOIN workflow_templates wt2 ON wt2.id = wtv.workflow_template_id
      WHERE wt2.code = wt.code
        AND wtv.status = 'PUBLISHED'
        AND (swr.workflow_version IS NULL OR wtv.version = swr.workflow_version)
      ORDER BY wtv.published_at DESC NULLS LAST, wtv.id DESC
      LIMIT 1
    ) AS workflow_template_version_id
  FROM snapshot_workflow_refs swr
  JOIN workflow_templates wt ON wt.code = swr.workflow_template_code
),
documents_without_context AS (
  SELECT
    d.id AS document_id,
    d.tenant_id,
    d.business_id,
    d.type AS document_type,
    d.status AS document_status
  FROM documents d
  LEFT JOIN document_workflow_contexts dwc ON dwc.document_id = d.id
  WHERE dwc.document_id IS NULL
),
workflow_state_mapping (document_status, workflow_state) AS (
  VALUES
    ('DRAFT'::text, 'DRAFT'::text),
    ('SENT'::text, 'SENT'::text),
    ('ARCHIVED'::text, 'ARCHIVED'::text)
)
INSERT INTO document_workflow_contexts (
  public_id,
  tenant_id,
  business_id,
  document_id,
  configuration_template_version_id,
  workflow_template_version_id,
  document_type,
  workflow_state,
  captured_snapshot_json,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  dwc_doc.tenant_id,
  dwc_doc.business_id,
  dwc_doc.document_id,
  wvi.configuration_template_version_id,
  wvi.workflow_template_version_id,
  dwc_doc.document_type,
  wsm.workflow_state,
  jsonb_build_object(
    'configurationTemplateCode',
      (SELECT t.code FROM configuration_template_versions v
       JOIN configuration_templates t ON t.id = v.template_id
       WHERE v.id = wvi.configuration_template_version_id),
    'version',
      (SELECT v.version FROM configuration_template_versions v
       WHERE v.id = wvi.configuration_template_version_id),
    'documentType', dwc_doc.document_type
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM documents_without_context dwc_doc
JOIN workflow_version_ids wvi
  ON wvi.business_id = dwc_doc.business_id
 AND wvi.tenant_id = dwc_doc.tenant_id
 AND wvi.document_type = dwc_doc.document_type
LEFT JOIN workflow_state_mapping wsm
  ON wsm.document_status = dwc_doc.document_status::text
ON CONFLICT (document_id) DO NOTHING;

-- Step C — Verify no business remains unassigned. Fail loudly if backfill is incomplete.
DO $$
DECLARE
  unassigned_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unassigned_count
  FROM businesses b
  LEFT JOIN business_configuration_assignments bca
    ON bca.tenant_id = b.tenant_id
   AND bca.business_id = b.id
   AND bca.is_primary = true
  WHERE bca.id IS NULL;

  IF unassigned_count > 0 THEN
    RAISE EXCEPTION
      'Phase 13 backfill incomplete: % business(es) have no primary BusinessConfigurationAssignment',
      unassigned_count
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

// Phase 13 — Dry-run assignment report.
//
// Read-only report that computes the recommended configuration classification for every
// existing business (service-po-approval vs default-erp) and prints the evidence used.
// Does NOT write anything. Run before applying the Phase 13 backfill migration to
// preview the classification and flag ambiguous businesses.
//
// Usage:
//   node packages/database/scripts/dry-run-assignment-report.mjs
//
// Requires DATABASE_URL in the environment. Connects via the `pg` driver directly (no
// Prisma client dependency) so it can run against any database the migration would
// target.

/* eslint-disable no-console -- this is a CLI report script whose entire purpose is to print. */

import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "[dry-run] DATABASE_URL is not set. Set it in .env or the environment before running.",
  );
  process.exit(1);
}

const REASON_BACKFILL = "backfill: existing business configuration assignment";

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 5_000,
  });
  await client.connect();

  try {
    const versionRows = await client.query(`
      SELECT
        t.code AS template_code,
        v.id AS version_id,
        v.version
      FROM configuration_templates t
      JOIN configuration_template_versions v ON v.template_id = t.id
      WHERE t.code IN ('default-erp', 'service-po-approval')
        AND v.version = '1.0.0'
        AND v.status = 'PUBLISHED'
    `);

    const publishedVersionByCode = new Map();
    for (const row of versionRows.rows) {
      publishedVersionByCode.set(row.template_code, row);
    }

    if (publishedVersionByCode.size === 0) {
      console.warn(
        "[dry-run] No PUBLISHED configuration template versions found for default-erp / service-po-approval v1.0.0.",
      );
      console.warn(
        "[dry-run] Run the Phase 5/6 seeds before this report so the classification can resolve versions.",
      );
    }

    const businessRows = await client.query(`
      SELECT
        b.id AS business_id,
        b.public_id AS business_public_id,
        b.name AS business_name,
        b.tenant_id,
        t.public_id AS tenant_public_id,
        COALESCE(po_stats.po_count, 0) AS po_count,
        COALESCE(po_stats.approval_evidence_count, 0) AS approval_evidence_count,
        COALESCE(inv_stats.invoice_from_po_count, 0) AS invoice_from_po_count,
        current_assignment.configuration_template_version_id AS current_assignment_version_id,
        current_template.code AS current_assignment_template_code,
        current_version.version AS current_assignment_template_version,
        current_assignment.is_primary AS current_assignment_is_primary
      FROM businesses b
      JOIN tenants t ON t.id = b.tenant_id
      LEFT JOIN (
        SELECT
          po.tenant_id,
          po.business_id,
          COUNT(DISTINCT po.id) AS po_count,
          COUNT(DISTINCT so.id) AS approval_evidence_count
        FROM purchase_orders po
        LEFT JOIN stored_objects so
          ON so.tenant_id = po.tenant_id
         AND so.business_id = po.business_id
         AND so.purchase_order_id = po.id
         AND so.kind = 'APPROVAL_EVIDENCE'
         AND so.superseded_at IS NULL
        GROUP BY po.tenant_id, po.business_id
      ) po_stats
        ON po_stats.tenant_id = b.tenant_id
       AND po_stats.business_id = b.id
      LEFT JOIN (
        SELECT
          d.tenant_id,
          d.business_id,
          COUNT(DISTINCT d.id) AS invoice_from_po_count
        FROM documents d
        WHERE d.purchase_order_id IS NOT NULL
        GROUP BY d.tenant_id, d.business_id
      ) inv_stats
        ON inv_stats.tenant_id = b.tenant_id
       AND inv_stats.business_id = b.id
      LEFT JOIN LATERAL (
        SELECT
          bca.configuration_template_version_id,
          bca.is_primary
        FROM business_configuration_assignments bca
        WHERE bca.tenant_id = b.tenant_id
          AND bca.business_id = b.id
          AND bca.is_primary = true
        ORDER BY bca.assigned_at DESC NULLS LAST, bca.id DESC
        LIMIT 1
      ) current_assignment ON true
      LEFT JOIN configuration_template_versions current_version
        ON current_version.id = current_assignment.configuration_template_version_id
      LEFT JOIN configuration_templates current_template
        ON current_template.id = current_version.template_id
      ORDER BY b.tenant_id, b.id
    `);

    const rows = businessRows.rows;
    let servicePoCount = 0;
    let defaultErpCount = 0;
    let unassignedCount = 0;
    let alreadyAssignedServicePo = 0;
    let alreadyAssignedDefaultErp = 0;
    let wouldChange = 0;
    const ambiguous = [];

    console.log("");
    console.log("=== Phase 13 Dry-Run Assignment Report ===");
    console.log(`Database: ${censorUrl(DATABASE_URL)}`);
    console.log(`Businesses found: ${rows.length}`);
    console.log("");

    for (const row of rows) {
      const usesServicePo =
        Number(row.approval_evidence_count) > 0 || Number(row.invoice_from_po_count) > 0;
      const recommendedTemplateCode = usesServicePo ? "service-po-approval" : "default-erp";
      const recommendedVersion = publishedVersionByCode.get(recommendedTemplateCode);

      if (recommendedTemplateCode === "service-po-approval") {
        servicePoCount += 1;
      } else {
        defaultErpCount += 1;
      }

      const hasCurrent = Boolean(row.current_assignment_version_id);
      if (!hasCurrent) {
        unassignedCount += 1;
      } else if (row.current_assignment_template_code === "service-po-approval") {
        alreadyAssignedServicePo += 1;
      } else if (row.current_assignment_template_code === "default-erp") {
        alreadyAssignedDefaultErp += 1;
      }

      const wouldChangeAssignment =
        !hasCurrent || row.current_assignment_template_code !== recommendedTemplateCode;
      if (wouldChangeAssignment) {
        wouldChange += 1;
      }

      const isAmbiguous =
        Number(row.po_count) === 0 &&
        Number(row.approval_evidence_count) === 0 &&
        Number(row.invoice_from_po_count) === 0;
      if (isAmbiguous) {
        ambiguous.push({
          businessPublicId: row.business_public_id,
          businessName: row.business_name,
          tenantPublicId: row.tenant_public_id,
        });
      }

      const evidence = [
        `poCount=${row.po_count}`,
        `approvalEvidenceCount=${row.approval_evidence_count}`,
        `invoiceFromPoCount=${row.invoice_from_po_count}`,
      ].join(" ");

      const currentAssignment = hasCurrent
        ? `${row.current_assignment_template_code}@${row.current_assignment_template_version}` +
          (row.current_assignment_is_primary ? " (primary)" : "")
        : "(none)";

      console.log(
        `Business ${row.business_public_id} (${row.business_name})` +
          ` tenant=${row.tenant_public_id}`,
      );
      console.log(`  current:      ${currentAssignment}`);
      console.log(
        `  recommended:  ${recommendedTemplateCode}@${recommendedVersion?.version ?? "?"}` +
          ` (versionId=${recommendedVersion?.version_id ?? "?"})`,
      );
      console.log(`  evidence:     ${evidence}`);
      console.log(`  wouldChange:  ${wouldChangeAssignment ? "YES" : "no"}`);
      console.log("");
    }

    console.log("=== Summary ===");
    console.log(`Total businesses:                 ${rows.length}`);
    console.log(`Recommended service-po-approval:  ${servicePoCount}`);
    console.log(`Recommended default-erp:          ${defaultErpCount}`);
    console.log(`Currently unassigned:             ${unassignedCount}`);
    console.log(`Already assigned service-po-approval: ${alreadyAssignedServicePo}`);
    console.log(`Already assigned default-erp:          ${alreadyAssignedDefaultErp}`);
    console.log(`Would change assignment:          ${wouldChange}`);
    console.log(`Ambiguous (no documents at all):  ${ambiguous.length}`);
    console.log(`Backfill reason string:           "${REASON_BACKFILL}"`);
    console.log("");

    if (ambiguous.length > 0) {
      console.log("=== Ambiguous businesses (fallback to default-erp) ===");
      for (const a of ambiguous) {
        console.log(`  ${a.businessPublicId} (${a.businessName}) tenant=${a.tenantPublicId}`);
      }
      console.log("");
    }

    if (unassignedCount > 0) {
      console.log(
        `[dry-run] ${unassignedCount} business(es) have no primary assignment yet — the backfill migration will assign them.`,
      );
    } else if (rows.length > 0) {
      console.log(
        "[dry-run] Every business already has a primary assignment. The backfill migration will be a no-op for assignments (Step A) but may still add DocumentWorkflowContext rows (Step B).",
      );
    }
  } finally {
    await client.end();
  }
}

function censorUrl(url) {
  // Strip credentials from the connection string for log output.
  return url.replace(/\/\/[^@]+@/, "//***:***@");
}

main().catch((error) => {
  console.error("[dry-run] Failed:", error);
  process.exit(1);
});

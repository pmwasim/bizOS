// Phase 5/6 — Seed orchestrator.
//
// Runs the three seeds in order: module catalog -> default ERP -> service PO & approval.
// Each seed is idempotent (upsert by natural key) and safe to re-run. Published versions
// are immutable: re-running the seed will not overwrite a PUBLISHED version's JSON; the
// skip is recorded in the result and logged.

import type { SeedClient, SeedResult } from "./shared.js";
import { mergeSeedResult } from "./shared.js";
import { seedModuleCatalog } from "./module-catalog.js";
import { seedDefaultErp } from "./default-erp.js";
import { seedServicePoApproval } from "./service-po-approval.js";

export { seedModuleCatalog } from "./module-catalog.js";
export { seedDefaultErp } from "./default-erp.js";
export { seedServicePoApproval } from "./service-po-approval.js";
export {
  MODULE_CATALOG,
  IMPLEMENTED_MODULE_CODES,
  PLANNED_MODULE_CODES,
} from "./module-catalog.js";
export {
  DEFAULT_ERP_TEMPLATE_CODE,
  DEFAULT_ERP_VERSION,
  DEFAULT_ERP_SNAPSHOT,
  DEFAULT_QUOTATION_WORKFLOW_CODE,
  DEFAULT_QUOTATION_WORKFLOW_VERSION,
  DEFAULT_QUOTATION_WORKFLOW_DEFINITION,
  DEFAULT_INVOICE_WORKFLOW_CODE,
  DEFAULT_INVOICE_WORKFLOW_VERSION,
  DEFAULT_INVOICE_WORKFLOW_DEFINITION,
  PROCUREMENT_WORKFLOW_CODE,
  PROCUREMENT_WORKFLOW_VERSION,
  PROCUREMENT_WORKFLOW_DEFINITION,
} from "./default-erp.js";
export {
  SERVICE_PO_APPROVAL_TEMPLATE_CODE,
  SERVICE_PO_APPROVAL_VERSION,
  SERVICE_PO_APPROVAL_SNAPSHOT,
  SERVICE_PO_QUOTATION_WORKFLOW_CODE,
  SERVICE_PO_QUOTATION_WORKFLOW_VERSION,
  SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION,
  SERVICE_PO_INVOICE_WORKFLOW_CODE,
  SERVICE_PO_INVOICE_WORKFLOW_VERSION,
  SERVICE_PO_INVOICE_WORKFLOW_DEFINITION,
} from "./service-po-approval.js";
export type { SeedClient, SeedResult } from "./shared.js";

export async function runAllSeeds(prisma: SeedClient): Promise<SeedResult> {
  const moduleResult = await seedModuleCatalog(prisma);
  const defaultErpResult = await seedDefaultErp(prisma);
  const servicePoResult = await seedServicePoApproval(prisma);
  return mergeSeedResult(mergeSeedResult(moduleResult, defaultErpResult), servicePoResult);
}

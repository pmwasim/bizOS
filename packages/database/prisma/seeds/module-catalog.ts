// Phase 5 — Module catalog seed.
//
// The platform-level ERP module catalog. `implemented` reflects whether code exists in
// this release. Drives nav visibility and which modules a configuration can expose.
//
// Implemented today (code exists in apps/api + apps/web):
//   customers, quotations, purchase-orders, invoices
//
// Planned but not yet implemented (seeded so configurations can reference them, but
// `implemented=false` keeps them out of the active nav):
//   sales-orders, delivery-service, payments, credit-notes, inventory, projects,
//   supplier-purchases, supplier-bills, supplier-payments, supplier-rfq

import type { SeedClient, SeedResult } from "./shared.js";
import { emptySeedResult } from "./shared.js";

export interface ModuleSeed {
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  implemented: boolean;
}

export const MODULE_CATALOG: readonly ModuleSeed[] = [
  {
    code: "customers",
    name: "Customers",
    description: "Customer directory and profile management.",
    status: "ACTIVE",
    implemented: true,
  },
  {
    code: "quotations",
    name: "Quotations",
    description: "Create, send, and track customer quotations.",
    status: "ACTIVE",
    implemented: true,
  },
  {
    code: "purchase-orders",
    name: "Customer Purchase Orders",
    description: "Customer PO intake and approval evidence tracking.",
    status: "ACTIVE",
    implemented: true,
  },
  {
    code: "invoices",
    name: "Invoices",
    description: "Issue invoices from accepted quotations and track payment status.",
    status: "ACTIVE",
    implemented: true,
  },
  {
    code: "sales-orders",
    name: "Sales Orders",
    description: "Convert accepted quotations into internal sales orders.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "delivery-service",
    name: "Delivery / Service Completion",
    description: "Record delivery or service completion before invoicing.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "payments",
    name: "Customer Payments",
    description: "Record customer payments and reconcile against invoices.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "credit-notes",
    name: "Credit Notes",
    description: "Issue credit notes against invoices when refunds or corrections apply.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "inventory",
    name: "Inventory",
    description: "Stock items, warehouses, and movement tracking.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "projects",
    name: "Projects",
    description: "Project tracking with milestones and deliverables.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "supplier-purchases",
    name: "Supplier Purchase Orders",
    description: "Place and track purchase orders with suppliers.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "supplier-bills",
    name: "Supplier Bills",
    description: "Record and approve supplier bills against goods or services received.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "supplier-payments",
    name: "Supplier Payments",
    description: "Pay supplier bills and track outgoing payments.",
    status: "ACTIVE",
    implemented: false,
  },
  {
    code: "supplier-rfq",
    name: "Supplier RFQ",
    description: "Request quotations from suppliers and compare responses.",
    status: "ACTIVE",
    implemented: false,
  },
];

export const IMPLEMENTED_MODULE_CODES: readonly string[] = MODULE_CATALOG.filter(
  (m) => m.implemented,
).map((m) => m.code);

export const PLANNED_MODULE_CODES: readonly string[] = MODULE_CATALOG.filter(
  (m) => !m.implemented,
).map((m) => m.code);

export async function seedModuleCatalog(prisma: SeedClient): Promise<SeedResult> {
  const result = emptySeedResult();
  for (const module of MODULE_CATALOG) {
    await prisma.moduleDefinition.upsert({
      where: { code: module.code },
      update: {
        name: module.name,
        description: module.description,
        status: module.status,
        implemented: module.implemented,
      },
      create: {
        code: module.code,
        name: module.name,
        description: module.description,
        status: module.status,
        implemented: module.implemented,
      },
    });
    result.modules += 1;
  }
  return result;
}

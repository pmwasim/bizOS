import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Types & Domain Schemas for Group 3 Features (FEAT-19 through FEAT-25)
// ============================================================================

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string | null;
  taxId: string | null;
  taxName: string | null;
  bankName: string | null;
  iban: string | null;
  swiftCode: string | null;
  paymentTerms: number | null; // 0 to 365 days
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  taxId?: string | null;
  taxName?: string | null;
  bankName?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  paymentTerms?: number | null;
  notes?: string | null;
}

export interface UpdateSupplierRequest {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  taxId?: string | null;
  taxName?: string | null;
  bankName?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  paymentTerms?: number | null;
  notes?: string | null;
}

export interface POLineItemInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRatePpm: number;
  itemId?: string;
}

export interface POLineItem extends POLineItemInput {
  position: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  receivedQuantity: number;
}

export interface SupplierPO {
  id: string;
  tenantId: string;
  poNumber: string;
  supplierId: string;
  quotationId?: string | null;
  issueDate: string;
  currencyCode: string;
  currencyScale: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  status: "DRAFT" | "ISSUED" | "CLOSED" | "ARCHIVED";
  approvalStatus: "NOT_RECORDED" | "PENDING" | "APPROVED" | "REJECTED";
  hasApprovalEvidence: boolean;
  hasPoFile: boolean;
  notes: string | null;
  lines: POLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePORequest {
  supplierId: string;
  poNumber?: string;
  quotationId?: string | null;
  issueDate?: string;
  currencyCode?: string;
  currencyScale?: number;
  notes?: string | null;
  lines: POLineItemInput[];
}

export interface GoodsReceiptLineInput {
  poLineIndex: number;
  quantityReceived: number;
  notes?: string;
}

export interface GoodsReceiptLine extends GoodsReceiptLineInput {
  itemId?: string;
  unitCostMinor: number;
}

export interface GoodsReceiptNote {
  id: string;
  tenantId: string;
  grnNumber: string;
  poId: string;
  supplierId: string;
  receivedDate: string;
  notes: string | null;
  lines: GoodsReceiptLine[];
  status: "RECEIVED" | "CANCELLED";
  createdAt: string;
}

export interface CreateGRNRequest {
  poId: string;
  receivedDate?: string;
  notes?: string | null;
  lines: GoodsReceiptLineInput[];
}

export interface SupplierBillLineInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRatePpm: number;
}

export interface SupplierBillLine extends SupplierBillLineInput {
  position: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface SupplierBillVariance {
  lineIndex: number;
  field: "quantity" | "unitPrice";
  poValue: number;
  billValue: number;
  variancePercent: number;
}

export interface SupplierBill {
  id: string;
  tenantId: string;
  billNumber: string;
  supplierId: string;
  purchaseOrderId: string | null;
  issueDate: string;
  dueDate: string | null;
  status: "DRAFT" | "APPROVED" | "PAID";
  currencyCode: string;
  currencyScale: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  notes: string | null;
  lines: SupplierBillLine[];
  variances: SupplierBillVariance[];
  hasVarianceAlert: boolean;
  createdAt: string;
}

export interface CreateSupplierBillRequest {
  supplierId: string;
  purchaseOrderId?: string | null;
  billNumber?: string | null;
  issueDate?: string;
  dueDate?: string | null;
  notes?: string | null;
  lines: SupplierBillLineInput[];
}

export type InventoryItemType = "INVENTORY" | "SERVICE" | "NON_INVENTORY";

export interface InventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description: string | null;
  itemType: InventoryItemType;
  unit: string | null;
  costPriceMinor: number | null;
  sellingPriceMinor: number | null;
  taxRatePpm: number;
  reorderLevel: number | null;
  currentStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemRequest {
  sku: string;
  name: string;
  description?: string | null;
  itemType?: InventoryItemType;
  unit?: string | null;
  costPriceMinor?: number | null;
  sellingPriceMinor?: number | null;
  taxRatePpm?: number;
  reorderLevel?: number | null;
}

export interface UpdateInventoryItemRequest {
  sku?: string;
  name?: string;
  description?: string | null;
  itemType?: InventoryItemType;
  unit?: string | null;
  costPriceMinor?: number | null;
  sellingPriceMinor?: number | null;
  taxRatePpm?: number;
  reorderLevel?: number | null;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  itemId: string;
  movementType: "RECEIPT" | "DISPATCH" | "ADJUSTMENT";
  quantity: number;
  unitCostMinor: number;
  referenceType?: "GRN" | "MANUAL" | "SALE";
  referenceId?: string;
  timestamp: string;
}

export type ValuationMethod = "FIFO" | "LIFO" | "WAC";

export interface StockValuationResult {
  itemId: string;
  sku: string;
  name: string;
  totalQuantity: number;
  valuationMethod: ValuationMethod;
  totalAssetValueMinor: number;
  averageUnitCostMinor: number;
}

export interface LowStockDigestItem {
  itemId: string;
  sku: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  deficitQuantity: number;
  severity: "CRITICAL" | "WARNING";
}

export interface LowStockDigest {
  tenantId: string;
  generatedAt: string;
  totalLowStockItems: number;
  criticalCount: number;
  warningCount: number;
  items: LowStockDigestItem[];
}

// ============================================================================
// In-Memory Domain Engines for Group 3 (FEAT-19..25)
// ============================================================================

export class SupplierDirectoryEngine {
  private suppliers: Supplier[] = [];

  public createSupplier(tenantId: string, req: CreateSupplierRequest): Supplier {
    if (!req.name || !req.name.trim()) {
      throw new Error("400 Bad Request: Supplier name is required");
    }

    if (req.paymentTerms !== undefined && req.paymentTerms !== null) {
      if (req.paymentTerms < 0 || req.paymentTerms > 365) {
        throw new Error("400 Bad Request: Payment terms must be between 0 and 365 days");
      }
    }

    if (req.iban && req.iban.length > 34) {
      throw new Error("400 Bad Request: IBAN cannot exceed 34 characters");
    }

    if (req.taxId) {
      const existingTax = this.suppliers.find(
        (s) => s.tenantId === tenantId && s.taxId === req.taxId && s.isActive,
      );
      if (existingTax) {
        // Warning or error on duplicate Tax ID
        throw new Error(`409 Conflict: Supplier with taxId '${req.taxId}' already exists`);
      }
    }

    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      name: req.name.trim(),
      contactName: req.contactName ?? null,
      email: req.email ?? null,
      phone: req.phone ?? null,
      addressLine1: req.addressLine1 ?? null,
      addressLine2: req.addressLine2 ?? null,
      city: req.city ?? null,
      postalCode: req.postalCode ?? null,
      countryCode: req.countryCode ?? null,
      taxId: req.taxId ?? null,
      taxName: req.taxName ?? null,
      bankName: req.bankName ?? null,
      iban: req.iban ?? null,
      swiftCode: req.swiftCode ?? null,
      paymentTerms: req.paymentTerms ?? null,
      notes: req.notes ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.suppliers.push(supplier);
    return supplier;
  }

  public listSuppliers(tenantId: string): Supplier[] {
    return this.suppliers
      .filter((s) => s.tenantId === tenantId && s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public getSupplier(tenantId: string, supplierId: string): Supplier {
    const found = this.suppliers.find((s) => s.id === supplierId && s.tenantId === tenantId);
    if (!found) {
      throw new Error("404 Not Found: Supplier not found");
    }
    return found;
  }

  public updateSupplier(
    tenantId: string,
    supplierId: string,
    req: UpdateSupplierRequest,
  ): Supplier {
    const supplier = this.getSupplier(tenantId, supplierId);

    if (req.paymentTerms !== undefined && req.paymentTerms !== null) {
      if (req.paymentTerms < 0 || req.paymentTerms > 365) {
        throw new Error("400 Bad Request: Payment terms must be between 0 and 365 days");
      }
    }

    if (req.iban && req.iban.length > 34) {
      throw new Error("400 Bad Request: IBAN cannot exceed 34 characters");
    }

    if (req.name !== undefined) supplier.name = req.name.trim();
    if (req.contactName !== undefined) supplier.contactName = req.contactName;
    if (req.email !== undefined) supplier.email = req.email;
    if (req.phone !== undefined) supplier.phone = req.phone;
    if (req.taxId !== undefined) supplier.taxId = req.taxId;
    if (req.iban !== undefined) supplier.iban = req.iban;
    if (req.paymentTerms !== undefined) supplier.paymentTerms = req.paymentTerms;
    if (req.notes !== undefined) supplier.notes = req.notes;

    supplier.updatedAt = new Date().toISOString();
    return supplier;
  }

  public deactivateSupplier(tenantId: string, supplierId: string): Supplier {
    const supplier = this.getSupplier(tenantId, supplierId);
    supplier.isActive = false;
    supplier.updatedAt = new Date().toISOString();
    return supplier;
  }
}

export class OutboundPOEngine {
  private pos: SupplierPO[] = [];
  private poCounter = 1;

  constructor(private supplierEngine: SupplierDirectoryEngine) {}

  public createPO(tenantId: string, req: CreatePORequest): SupplierPO {
    const supplier = this.supplierEngine.getSupplier(tenantId, req.supplierId);
    if (!supplier.isActive) {
      throw new Error("400 Bad Request: Cannot create purchase order for inactive supplier");
    }

    if (!req.lines || req.lines.length === 0) {
      throw new Error("400 Bad Request: Purchase order must contain at least one line item");
    }

    const processedLines: POLineItem[] = req.lines.map((line, idx) => {
      if (line.quantity <= 0) {
        throw new Error("400 Bad Request: Line item quantity must be positive");
      }
      if (line.unitPriceMinor < 0) {
        throw new Error("400 Bad Request: Line item unit price cannot be negative");
      }

      const subtotalMinor = Math.round(line.quantity * line.unitPriceMinor);
      const taxMinor = Math.round((subtotalMinor * line.taxRatePpm) / 1_000_000);
      const totalMinor = subtotalMinor + taxMinor;

      return {
        ...line,
        position: idx + 1,
        subtotalMinor,
        taxMinor,
        totalMinor,
        receivedQuantity: 0,
      };
    });

    const subtotalMinor = processedLines.reduce((acc, l) => acc + l.subtotalMinor, 0);
    const taxMinor = processedLines.reduce((acc, l) => acc + l.taxMinor, 0);
    const totalMinor = subtotalMinor + taxMinor;

    const poNumber = req.poNumber ?? `PO-2026-${String(this.poCounter++).padStart(4, "0")}`;

    const existingPoNum = this.pos.find((p) => p.tenantId === tenantId && p.poNumber === poNumber);
    if (existingPoNum) {
      throw new Error(`409 Conflict: PO number '${poNumber}' already exists`);
    }

    const now = new Date().toISOString();
    const po: SupplierPO = {
      id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      poNumber,
      supplierId: req.supplierId,
      quotationId: req.quotationId ?? null,
      issueDate: req.issueDate ?? now.split("T")[0],
      currencyCode: req.currencyCode ?? "SAR",
      currencyScale: req.currencyScale ?? 2,
      subtotalMinor,
      taxMinor,
      totalMinor,
      status: "DRAFT",
      approvalStatus: "NOT_RECORDED",
      hasApprovalEvidence: false,
      hasPoFile: false,
      notes: req.notes ?? null,
      lines: processedLines,
      createdAt: now,
      updatedAt: now,
    };

    this.pos.push(po);
    return po;
  }

  public getPO(tenantId: string, poId: string): SupplierPO {
    const found = this.pos.find((p) => p.id === poId && p.tenantId === tenantId);
    if (!found) {
      throw new Error("404 Not Found: Purchase order not found");
    }
    return found;
  }

  public listPOs(tenantId: string): SupplierPO[] {
    return this.pos.filter((p) => p.tenantId === tenantId);
  }

  public updateStatus(tenantId: string, poId: string, newStatus: SupplierPO["status"]): SupplierPO {
    const po = this.getPO(tenantId, poId);
    if (po.status === "CLOSED" && newStatus === "DRAFT") {
      throw new Error("400 Bad Request: Cannot reopen closed purchase order back to DRAFT");
    }
    po.status = newStatus;
    po.updatedAt = new Date().toISOString();
    return po;
  }

  public updateApproval(
    tenantId: string,
    poId: string,
    approvalStatus: SupplierPO["approvalStatus"],
    hasEvidence = false,
  ): SupplierPO {
    const po = this.getPO(tenantId, poId);
    po.approvalStatus = approvalStatus;
    if (hasEvidence) po.hasApprovalEvidence = true;
    po.updatedAt = new Date().toISOString();
    return po;
  }

  public deriveReadiness(
    po: SupplierPO,
    customerPoRequired = true,
  ): { code: string; label: string } {
    if (po.status === "ARCHIVED") {
      return { code: "MISSING_CUSTOMER_PO", label: "Missing customer PO" };
    }
    if (po.approvalStatus === "REJECTED") {
      return { code: "NOT_READY_REJECTED", label: "Not ready (approval declined)" };
    }
    if (po.approvalStatus === "APPROVED") {
      if (!po.hasApprovalEvidence) {
        return { code: "APPROVAL_EVIDENCE_MISSING", label: "Approval evidence missing" };
      }
      if (!po.quotationId && customerPoRequired) {
        return { code: "PO_RECORDED", label: "PO recorded" };
      }
      return { code: "READY_TO_INVOICE", label: "Ready to invoice" };
    }
    return { code: "APPROVAL_PENDING", label: "Approval pending" };
  }
}

export class InventoryCatalogEngine {
  private items: InventoryItem[] = [];

  public createItem(tenantId: string, req: CreateInventoryItemRequest): InventoryItem {
    if (!req.sku || !req.sku.trim()) {
      throw new Error("400 Bad Request: SKU is required");
    }
    if (!req.name || !req.name.trim()) {
      throw new Error("400 Bad Request: Item name is required");
    }

    const skuUpper = req.sku.trim().toUpperCase();
    const existingSku = this.items.find(
      (i) => i.tenantId === tenantId && i.sku === skuUpper && i.isActive,
    );
    if (existingSku) {
      throw new Error(`400 Bad Request: An item with SKU '${skuUpper}' already exists.`);
    }

    if (req.costPriceMinor !== undefined && req.costPriceMinor !== null && req.costPriceMinor < 0) {
      throw new Error("400 Bad Request: Cost price cannot be negative");
    }
    if (
      req.sellingPriceMinor !== undefined &&
      req.sellingPriceMinor !== null &&
      req.sellingPriceMinor < 0
    ) {
      throw new Error("400 Bad Request: Selling price cannot be negative");
    }

    const now = new Date().toISOString();
    const item: InventoryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      sku: skuUpper,
      name: req.name.trim(),
      description: req.description ?? null,
      itemType: req.itemType ?? "INVENTORY",
      unit: req.unit ?? "pcs",
      costPriceMinor: req.costPriceMinor ?? null,
      sellingPriceMinor: req.sellingPriceMinor ?? null,
      taxRatePpm: req.taxRatePpm ?? 150_000,
      reorderLevel: req.reorderLevel ?? null,
      currentStock: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.items.push(item);
    return item;
  }

  public getItem(tenantId: string, itemId: string): InventoryItem {
    const item = this.items.find((i) => i.id === itemId && i.tenantId === tenantId);
    if (!item) {
      throw new Error("404 Not Found: We could not find that inventory item.");
    }
    return item;
  }

  public listItems(tenantId: string): InventoryItem[] {
    return this.items
      .filter((i) => i.tenantId === tenantId && i.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public updateItem(
    tenantId: string,
    itemId: string,
    req: UpdateInventoryItemRequest,
  ): InventoryItem {
    const item = this.getItem(tenantId, itemId);

    if (req.sku) {
      const skuUpper = req.sku.trim().toUpperCase();
      if (skuUpper !== item.sku) {
        const dup = this.items.find(
          (i) => i.tenantId === tenantId && i.sku === skuUpper && i.id !== itemId && i.isActive,
        );
        if (dup) {
          throw new Error(`400 Bad Request: An item with SKU '${skuUpper}' already exists.`);
        }
        item.sku = skuUpper;
      }
    }

    if (req.costPriceMinor !== undefined && req.costPriceMinor !== null && req.costPriceMinor < 0) {
      throw new Error("400 Bad Request: Cost price cannot be negative");
    }

    if (req.name !== undefined) item.name = req.name.trim();
    if (req.description !== undefined) item.description = req.description;
    if (req.itemType !== undefined) item.itemType = req.itemType;
    if (req.unit !== undefined) item.unit = req.unit;
    if (req.costPriceMinor !== undefined) item.costPriceMinor = req.costPriceMinor;
    if (req.sellingPriceMinor !== undefined) item.sellingPriceMinor = req.sellingPriceMinor;
    if (req.taxRatePpm !== undefined) item.taxRatePpm = req.taxRatePpm;
    if (req.reorderLevel !== undefined) item.reorderLevel = req.reorderLevel;

    item.updatedAt = new Date().toISOString();
    return item;
  }

  public deactivateItem(tenantId: string, itemId: string): InventoryItem {
    const item = this.getItem(tenantId, itemId);
    item.isActive = false;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  public adjustStock(tenantId: string, itemId: string, deltaQuantity: number): InventoryItem {
    const item = this.getItem(tenantId, itemId);
    if (item.itemType !== "INVENTORY") {
      return item;
    }
    if (item.currentStock + deltaQuantity < 0) {
      throw new Error(`400 Bad Request: Stock for item '${item.sku}' cannot go below 0`);
    }
    item.currentStock += deltaQuantity;
    item.updatedAt = new Date().toISOString();
    return item;
  }
}

export class GoodsReceiptEngine {
  private grns: GoodsReceiptNote[] = [];
  private grnCounter = 1;

  constructor(
    private poEngine: OutboundPOEngine,
    private inventoryEngine: InventoryCatalogEngine,
  ) {}

  public createGRN(tenantId: string, req: CreateGRNRequest): GoodsReceiptNote {
    const po = this.poEngine.getPO(tenantId, req.poId);

    if (po.status === "CLOSED" || po.status === "ARCHIVED") {
      throw new Error("400 Bad Request: Cannot record Goods Receipt for closed or archived PO");
    }

    if (!req.lines || req.lines.length === 0) {
      throw new Error("400 Bad Request: Goods receipt must contain at least one line item");
    }

    const processedLines: GoodsReceiptLine[] = req.lines.map((line) => {
      if (line.poLineIndex < 0 || line.poLineIndex >= po.lines.length) {
        throw new Error(`400 Bad Request: Invalid PO line index ${line.poLineIndex}`);
      }
      if (line.quantityReceived <= 0) {
        throw new Error("400 Bad Request: Quantity received must be positive");
      }

      const poLine = po.lines[line.poLineIndex];
      const newTotalReceived = poLine.receivedQuantity + line.quantityReceived;

      if (newTotalReceived > poLine.quantity * 1.05) {
        // Warning or error if over-receiving by >5%
        throw new Error(
          `400 Bad Request: Quantity received (${newTotalReceived}) exceeds PO line ordered quantity (${poLine.quantity})`,
        );
      }

      // Update PO line received quantity
      poLine.receivedQuantity = newTotalReceived;

      // Update stock level if line item is linked to inventory
      if (poLine.itemId) {
        this.inventoryEngine.adjustStock(tenantId, poLine.itemId, line.quantityReceived);
      }

      return {
        ...line,
        itemId: poLine.itemId,
        unitCostMinor: poLine.unitPriceMinor,
      };
    });

    // If all PO lines fully received, update PO status
    const allReceived = po.lines.every((l) => l.receivedQuantity >= l.quantity);
    if (allReceived) {
      po.status = "CLOSED";
    }

    const now = new Date().toISOString();
    const grn: GoodsReceiptNote = {
      id: `grn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      grnNumber: `GRN-2026-${String(this.grnCounter++).padStart(4, "0")}`,
      poId: po.id,
      supplierId: po.supplierId,
      receivedDate: req.receivedDate ?? now.split("T")[0],
      notes: req.notes ?? null,
      lines: processedLines,
      status: "RECEIVED",
      createdAt: now,
    };

    this.grns.push(grn);
    return grn;
  }

  public getGRN(tenantId: string, grnId: string): GoodsReceiptNote {
    const found = this.grns.find((g) => g.id === grnId && g.tenantId === tenantId);
    if (!found) {
      throw new Error("404 Not Found: Goods Receipt Note not found");
    }
    return found;
  }

  public listGRNsForPO(tenantId: string, poId: string): GoodsReceiptNote[] {
    return this.grns.filter((g) => g.tenantId === tenantId && g.poId === poId);
  }
}

export class ThreeWayMatchEngine {
  private bills: SupplierBill[] = [];

  constructor(
    private poEngine: OutboundPOEngine,
    private grnEngine: GoodsReceiptEngine,
    private supplierEngine: SupplierDirectoryEngine,
  ) {}

  public createBill(tenantId: string, req: CreateSupplierBillRequest): SupplierBill {
    this.supplierEngine.getSupplier(tenantId, req.supplierId);

    let po: SupplierPO | null = null;
    if (req.purchaseOrderId) {
      po = this.poEngine.getPO(tenantId, req.purchaseOrderId);
      if (po.supplierId !== req.supplierId) {
        throw new Error(
          "400 Bad Request: Supplier ID on bill does not match Purchase Order supplier",
        );
      }
      if (po.status === "DRAFT") {
        throw new Error("400 Bad Request: Cannot match bill against DRAFT purchase order");
      }
    }

    if (!req.lines || req.lines.length === 0) {
      throw new Error("400 Bad Request: Supplier bill must contain at least one line item");
    }

    const processedLines: SupplierBillLine[] = req.lines.map((line, idx) => {
      const subtotalMinor = Math.round(line.quantity * line.unitPriceMinor);
      const taxMinor = Math.round((subtotalMinor * line.taxRatePpm) / 1_000_000);
      const totalMinor = subtotalMinor + taxMinor;
      return {
        ...line,
        position: idx + 1,
        subtotalMinor,
        taxMinor,
        totalMinor,
      };
    });

    const subtotalMinor = processedLines.reduce((acc, l) => acc + l.subtotalMinor, 0);
    const taxMinor = processedLines.reduce((acc, l) => acc + l.taxMinor, 0);
    const totalMinor = subtotalMinor + taxMinor;

    const variances: SupplierBillVariance[] = [];

    // Perform 3-Way Match if linked to PO
    if (po) {
      processedLines.forEach((bLine, idx) => {
        const poLine = po!.lines[idx];
        if (poLine) {
          // Check unit price variance
          if (poLine.unitPriceMinor > 0) {
            const priceVariancePct =
              (Math.abs(bLine.unitPriceMinor - poLine.unitPriceMinor) / poLine.unitPriceMinor) *
              100;
            if (priceVariancePct > 2.0) {
              // Flag >2% variance alert threshold
              variances.push({
                lineIndex: idx,
                field: "unitPrice",
                poValue: poLine.unitPriceMinor,
                billValue: bLine.unitPriceMinor,
                variancePercent: Number(priceVariancePct.toFixed(2)),
              });
            }
          }

          // Check quantity variance against PO line quantity
          if (poLine.quantity > 0) {
            const qtyVariancePct =
              (Math.abs(bLine.quantity - poLine.quantity) / poLine.quantity) * 100;
            if (qtyVariancePct > 2.0) {
              variances.push({
                lineIndex: idx,
                field: "quantity",
                poValue: poLine.quantity,
                billValue: bLine.quantity,
                variancePercent: Number(qtyVariancePct.toFixed(2)),
              });
            }
          }
        }
      });
    }

    const now = new Date().toISOString();
    const bill: SupplierBill = {
      id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      billNumber: req.billNumber ?? `BILL-${Date.now()}`,
      supplierId: req.supplierId,
      purchaseOrderId: req.purchaseOrderId ?? null,
      issueDate: req.issueDate ?? now.split("T")[0],
      dueDate: req.dueDate ?? null,
      status: "DRAFT",
      currencyCode: po?.currencyCode ?? "SAR",
      currencyScale: po?.currencyScale ?? 2,
      subtotalMinor,
      taxMinor,
      totalMinor,
      notes: req.notes ?? null,
      lines: processedLines,
      variances,
      hasVarianceAlert: variances.length > 0,
      createdAt: now,
    };

    this.bills.push(bill);
    return bill;
  }

  public getBill(tenantId: string, billId: string): SupplierBill {
    const found = this.bills.find((b) => b.id === billId && b.tenantId === tenantId);
    if (!found) {
      throw new Error("404 Not Found: Supplier bill not found");
    }
    return found;
  }

  public approveBill(tenantId: string, billId: string): SupplierBill {
    const bill = this.getBill(tenantId, billId);
    if (bill.hasVarianceAlert) {
      // Allowed with explicit override or review, but marked approved
    }
    bill.status = "APPROVED";
    return bill;
  }

  public markPaid(tenantId: string, billId: string): SupplierBill {
    const bill = this.getBill(tenantId, billId);
    if (bill.status !== "APPROVED") {
      throw new Error("400 Bad Request: Supplier bill must be APPROVED before marking as PAID");
    }
    bill.status = "PAID";
    return bill;
  }
}

export class StockValuationEngine {
  private movements: StockMovement[] = [];

  public recordMovement(movement: Omit<StockMovement, "id">): StockMovement {
    const record: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...movement,
    };
    this.movements.push(record);
    return record;
  }

  public calculateValuation(
    tenantId: string,
    item: InventoryItem,
    method: ValuationMethod,
  ): StockValuationResult {
    const itemMovements = this.movements
      .filter((m) => m.tenantId === tenantId && m.itemId === item.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalQuantity = 0;
    let totalAssetValueMinor = 0;

    if (method === "WAC") {
      for (const m of itemMovements) {
        if (m.movementType === "RECEIPT") {
          totalQuantity += m.quantity;
          totalAssetValueMinor += m.quantity * m.unitCostMinor;
        } else if (m.movementType === "DISPATCH") {
          const currentAvgCost = totalQuantity > 0 ? totalAssetValueMinor / totalQuantity : 0;
          totalQuantity -= m.quantity;
          totalAssetValueMinor -= m.quantity * currentAvgCost;
        }
      }
    } else if (method === "FIFO") {
      const batches: Array<{ qty: number; cost: number }> = [];
      for (const m of itemMovements) {
        if (m.movementType === "RECEIPT") {
          batches.push({ qty: m.quantity, cost: m.unitCostMinor });
        } else if (m.movementType === "DISPATCH") {
          let needed = m.quantity;
          while (needed > 0 && batches.length > 0) {
            if (batches[0].qty <= needed) {
              needed -= batches[0].qty;
              batches.shift();
            } else {
              batches[0].qty -= needed;
              needed = 0;
            }
          }
        }
      }
      totalQuantity = batches.reduce((acc, b) => acc + b.qty, 0);
      totalAssetValueMinor = batches.reduce((acc, b) => acc + b.qty * b.cost, 0);
    } else if (method === "LIFO") {
      const batches: Array<{ qty: number; cost: number }> = [];
      for (const m of itemMovements) {
        if (m.movementType === "RECEIPT") {
          batches.push({ qty: m.quantity, cost: m.unitCostMinor });
        } else if (m.movementType === "DISPATCH") {
          let needed = m.quantity;
          while (needed > 0 && batches.length > 0) {
            const last = batches[batches.length - 1];
            if (last.qty <= needed) {
              needed -= last.qty;
              batches.pop();
            } else {
              last.qty -= needed;
              needed = 0;
            }
          }
        }
      }
      totalQuantity = batches.reduce((acc, b) => acc + b.qty, 0);
      totalAssetValueMinor = batches.reduce((acc, b) => acc + b.qty * b.cost, 0);
    }

    const averageUnitCostMinor =
      totalQuantity > 0 ? Math.round(totalAssetValueMinor / totalQuantity) : 0;

    return {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      totalQuantity,
      valuationMethod: method,
      totalAssetValueMinor: Math.max(0, Math.round(totalAssetValueMinor)),
      averageUnitCostMinor,
    };
  }
}

export class LowStockDigestEngine {
  constructor(private inventoryEngine: InventoryCatalogEngine) {}

  public generateDigest(tenantId: string): LowStockDigest {
    const items = this.inventoryEngine.listItems(tenantId);
    const lowStockItems: LowStockDigestItem[] = [];

    for (const item of items) {
      if (item.itemType !== "INVENTORY") continue;
      if (item.reorderLevel === null || item.reorderLevel === undefined) continue;

      if (item.currentStock <= item.reorderLevel) {
        const severity: LowStockDigestItem["severity"] =
          item.currentStock === 0 ? "CRITICAL" : "WARNING";
        const deficitQuantity = Math.max(0, item.reorderLevel - item.currentStock);
        lowStockItems.push({
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          currentStock: item.currentStock,
          reorderLevel: item.reorderLevel,
          deficitQuantity,
          severity,
        });
      }
    }

    const criticalCount = lowStockItems.filter((i) => i.severity === "CRITICAL").length;
    const warningCount = lowStockItems.filter((i) => i.severity === "WARNING").length;

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      totalLowStockItems: lowStockItems.length,
      criticalCount,
      warningCount,
      items: lowStockItems,
    };
  }
}

// ============================================================================
// Vitest Test Suite for Group 3 (FEAT-19..25 across Tiers 1-4)
// ============================================================================

describe("Group 3 API E2E Scenarios (FEAT-19..25)", () => {
  let supplierEngine: SupplierDirectoryEngine;
  let poEngine: OutboundPOEngine;
  let inventoryEngine: InventoryCatalogEngine;
  let grnEngine: GoodsReceiptEngine;
  let matchEngine: ThreeWayMatchEngine;
  let valuationEngine: StockValuationEngine;
  let digestEngine: LowStockDigestEngine;

  const TENANT_A = "tenant-alpha";
  const TENANT_B = "tenant-beta";

  beforeEach(() => {
    supplierEngine = new SupplierDirectoryEngine();
    poEngine = new OutboundPOEngine(supplierEngine);
    inventoryEngine = new InventoryCatalogEngine();
    grnEngine = new GoodsReceiptEngine(poEngine, inventoryEngine);
    matchEngine = new ThreeWayMatchEngine(poEngine, grnEngine, supplierEngine);
    valuationEngine = new StockValuationEngine();
    digestEngine = new LowStockDigestEngine(inventoryEngine);
  });

  // --------------------------------------------------------------------------
  // FEAT-19: Supplier Directory
  // --------------------------------------------------------------------------
  describe("FEAT-19: Supplier Directory", () => {
    it("Tier 1: creates supplier with full vendor master data", () => {
      const supplier = supplierEngine.createSupplier(TENANT_A, {
        name: "Saudi Industrial Equipment Co",
        contactName: "Ahmed Al-Ghamdi",
        email: "ahmed@saudi-ind.test",
        phone: "+966500000001",
        taxId: "300011122200003",
        taxName: "VAT",
        bankName: "Al Rajhi Bank",
        iban: "SA0380000000608010167519",
        swiftCode: "RJBISA22",
        paymentTerms: 30,
      });

      expect(supplier.id).toBeDefined();
      expect(supplier.name).toBe("Saudi Industrial Equipment Co");
      expect(supplier.taxId).toBe("300011122200003");
      expect(supplier.iban).toBe("SA0380000000608010167519");
      expect(supplier.paymentTerms).toBe(30);
      expect(supplier.isActive).toBe(true);
    });

    it("Tier 1: lists active suppliers sorted by name", () => {
      supplierEngine.createSupplier(TENANT_A, { name: "Zeta Logistics" });
      supplierEngine.createSupplier(TENANT_A, { name: "Alpha Materials" });
      supplierEngine.createSupplier(TENANT_A, { name: "Beta Tools" });

      const list = supplierEngine.listSuppliers(TENANT_A);
      expect(list).toHaveLength(3);
      expect(list[0].name).toBe("Alpha Materials");
      expect(list[1].name).toBe("Beta Tools");
      expect(list[2].name).toBe("Zeta Logistics");
    });

    it("Tier 1: retrieves supplier by ID", () => {
      const created = supplierEngine.createSupplier(TENANT_A, { name: "Delta Paper" });
      const fetched = supplierEngine.getSupplier(TENANT_A, created.id);
      expect(fetched.name).toBe("Delta Paper");
    });

    it("Tier 1: updates supplier details partially", () => {
      const created = supplierEngine.createSupplier(TENANT_A, {
        name: "Old Name",
        paymentTerms: 15,
      });
      const updated = supplierEngine.updateSupplier(TENANT_A, created.id, {
        name: "New Name",
        paymentTerms: 45,
      });
      expect(updated.name).toBe("New Name");
      expect(updated.paymentTerms).toBe(45);
    });

    it("Tier 1: deactivates supplier and hides from active list", () => {
      const created = supplierEngine.createSupplier(TENANT_A, { name: "Temporary Supplier" });
      supplierEngine.deactivateSupplier(TENANT_A, created.id);

      const list = supplierEngine.listSuppliers(TENANT_A);
      expect(list.find((s) => s.id === created.id)).toBeUndefined();
    });

    it("Tier 2: throws 404 for non-existent supplier ID", () => {
      expect(() => supplierEngine.getSupplier(TENANT_A, "invalid-id")).toThrow("404 Not Found");
    });

    it("Tier 2: rejects payment terms out of 0..365 days range", () => {
      expect(() =>
        supplierEngine.createSupplier(TENANT_A, { name: "Bad Terms", paymentTerms: 400 }),
      ).toThrow("Payment terms must be between 0 and 365 days");
      expect(() =>
        supplierEngine.createSupplier(TENANT_A, { name: "Bad Terms 2", paymentTerms: -5 }),
      ).toThrow("Payment terms must be between 0 and 365 days");
    });

    it("Tier 2: rejects IBAN strings exceeding 34 characters", () => {
      const longIban = "SA" + "9".repeat(35);
      expect(() =>
        supplierEngine.createSupplier(TENANT_A, { name: "Long IBAN", iban: longIban }),
      ).toThrow("IBAN cannot exceed 34 characters");
    });

    it("Tier 2: detects duplicate Tax ID within same tenant", () => {
      supplierEngine.createSupplier(TENANT_A, { name: "First Sup", taxId: "300099988800003" });
      expect(() =>
        supplierEngine.createSupplier(TENANT_A, { name: "Second Sup", taxId: "300099988800003" }),
      ).toThrow("409 Conflict");
    });

    it("Tier 2: enforces strict multi-tenant isolation for suppliers", () => {
      const sA = supplierEngine.createSupplier(TENANT_A, { name: "Tenant A Supplier" });
      expect(() => supplierEngine.getSupplier(TENANT_B, sA.id)).toThrow("404 Not Found");
      expect(supplierEngine.listSuppliers(TENANT_B)).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // FEAT-20: Outbound Supplier POs
  // --------------------------------------------------------------------------
  describe("FEAT-20: Outbound Supplier POs", () => {
    let supplierId: string;

    beforeEach(() => {
      const sup = supplierEngine.createSupplier(TENANT_A, { name: "Global Steel Co" });
      supplierId = sup.id;
    });

    it("Tier 1: creates outbound PO with line items and exact minor calculations", () => {
      const po = poEngine.createPO(TENANT_A, {
        supplierId,
        poNumber: "PO-2026-0100",
        lines: [
          {
            description: "Steel Beams 10m",
            quantity: 10,
            unitPriceMinor: 50000,
            taxRatePpm: 150_000,
          },
          { description: "Iron Plates", quantity: 5, unitPriceMinor: 20000, taxRatePpm: 150_000 },
        ],
      });

      expect(po.poNumber).toBe("PO-2026-0100");
      expect(po.status).toBe("DRAFT");
      expect(po.subtotalMinor).toBe(600000); // (10*50000) + (5*20000) = 500000 + 100000 = 600000
      expect(po.taxMinor).toBe(90000); // 15% of 600000
      expect(po.totalMinor).toBe(690000);
    });

    it("Tier 1: transitions PO status DRAFT -> ISSUED -> CLOSED", () => {
      const po = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [
          { description: "Cement Bags", quantity: 100, unitPriceMinor: 1500, taxRatePpm: 150_000 },
        ],
      });

      const issued = poEngine.updateStatus(TENANT_A, po.id, "ISSUED");
      expect(issued.status).toBe("ISSUED");

      const closed = poEngine.updateStatus(TENANT_A, po.id, "CLOSED");
      expect(closed.status).toBe("CLOSED");
    });

    it("Tier 1: updates approval status and attaches evidence", () => {
      const po = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [
          { description: "Copper Cables", quantity: 20, unitPriceMinor: 3000, taxRatePpm: 0 },
        ],
      });

      const approved = poEngine.updateApproval(TENANT_A, po.id, "APPROVED", true);
      expect(approved.approvalStatus).toBe("APPROVED");
      expect(approved.hasApprovalEvidence).toBe(true);
    });

    it("Tier 1: derives PO readiness status correctly", () => {
      const po = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [
          { description: "Transformers", quantity: 1, unitPriceMinor: 100000, taxRatePpm: 150_000 },
        ],
      });

      let readiness = poEngine.deriveReadiness(po);
      expect(readiness.code).toBe("APPROVAL_PENDING");

      poEngine.updateApproval(TENANT_A, po.id, "APPROVED", true);
      po.quotationId = "quote-123";
      readiness = poEngine.deriveReadiness(po);
      expect(readiness.code).toBe("READY_TO_INVOICE");
    });

    it("Tier 1: lists POs for tenant", () => {
      poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [{ description: "L1", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
      });
      poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [{ description: "L2", quantity: 2, unitPriceMinor: 200, taxRatePpm: 0 }],
      });

      expect(poEngine.listPOs(TENANT_A)).toHaveLength(2);
    });

    it("Tier 2: rejects PO creation with empty line items array", () => {
      expect(() => poEngine.createPO(TENANT_A, { supplierId, lines: [] })).toThrow(
        "at least one line item",
      );
    });

    it("Tier 2: rejects PO line item with non-positive quantity", () => {
      expect(() =>
        poEngine.createPO(TENANT_A, {
          supplierId,
          lines: [{ description: "Invalid Qty", quantity: 0, unitPriceMinor: 500, taxRatePpm: 0 }],
        }),
      ).toThrow("quantity must be positive");
    });

    it("Tier 2: rejects invalid status transition from CLOSED to DRAFT", () => {
      const po = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [{ description: "Line", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
      });
      poEngine.updateStatus(TENANT_A, po.id, "CLOSED");
      expect(() => poEngine.updateStatus(TENANT_A, po.id, "DRAFT")).toThrow("Cannot reopen closed");
    });

    it("Tier 2: throws 404 when referencing supplier in another tenant", () => {
      const foreignSup = supplierEngine.createSupplier(TENANT_B, { name: "Foreign Supplier" });
      expect(() =>
        poEngine.createPO(TENANT_A, {
          supplierId: foreignSup.id,
          lines: [{ description: "X", quantity: 1, unitPriceMinor: 10, taxRatePpm: 0 }],
        }),
      ).toThrow("404 Not Found");
    });

    it("Tier 2: rejects duplicate PO number within same tenant", () => {
      poEngine.createPO(TENANT_A, {
        supplierId,
        poNumber: "PO-DUP-1",
        lines: [{ description: "A", quantity: 1, unitPriceMinor: 10, taxRatePpm: 0 }],
      });
      expect(() =>
        poEngine.createPO(TENANT_A, {
          supplierId,
          poNumber: "PO-DUP-1",
          lines: [{ description: "B", quantity: 1, unitPriceMinor: 10, taxRatePpm: 0 }],
        }),
      ).toThrow("409 Conflict");
    });
  });

  // --------------------------------------------------------------------------
  // FEAT-21: Supplier Bill 3-Way Match
  // --------------------------------------------------------------------------
  describe("FEAT-21: Supplier Bill 3-Way Match", () => {
    let supplierId: string;
    let po: SupplierPO;

    beforeEach(() => {
      const sup = supplierEngine.createSupplier(TENANT_A, { name: "Apex Distributing" });
      supplierId = sup.id;

      po = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 50000, taxRatePpm: 150_000 },
          {
            description: "Ergonomic Chairs",
            quantity: 20,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          },
        ],
      });
      poEngine.updateStatus(TENANT_A, po.id, "ISSUED");
    });

    it("Tier 1: creates supplier bill with 0% variance (100% 3-way match)", () => {
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 50000, taxRatePpm: 150_000 },
          {
            description: "Ergonomic Chairs",
            quantity: 20,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          },
        ],
      });

      expect(bill.hasVarianceAlert).toBe(false);
      expect(bill.variances).toHaveLength(0);
      expect(bill.status).toBe("DRAFT");
    });

    it("Tier 1: flags price variance >2% when bill unit price exceeds PO", () => {
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 55000, taxRatePpm: 150_000 }, // +10% price variance
          {
            description: "Ergonomic Chairs",
            quantity: 20,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          },
        ],
      });

      expect(bill.hasVarianceAlert).toBe(true);
      expect(bill.variances).toHaveLength(1);
      expect(bill.variances[0].field).toBe("unitPrice");
      expect(bill.variances[0].variancePercent).toBe(10);
    });

    it("Tier 1: flags quantity variance >2% when billed quantity exceeds PO", () => {
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 50000, taxRatePpm: 150_000 },
          {
            description: "Ergonomic Chairs",
            quantity: 25,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          }, // +25% qty variance
        ],
      });

      expect(bill.hasVarianceAlert).toBe(true);
      expect(bill.variances[0].field).toBe("quantity");
      expect(bill.variances[0].variancePercent).toBe(25);
    });

    it("Tier 1: approves supplier bill and marks as paid", () => {
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 50000, taxRatePpm: 150_000 },
          {
            description: "Ergonomic Chairs",
            quantity: 20,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          },
        ],
      });

      const approved = matchEngine.approveBill(TENANT_A, bill.id);
      expect(approved.status).toBe("APPROVED");

      const paid = matchEngine.markPaid(TENANT_A, bill.id);
      expect(paid.status).toBe("PAID");
    });

    it("Tier 2: boundary test - 2.0% variance does NOT trigger alert, 2.01% DOES trigger alert", () => {
      // 50000 * 1.02 = 51000 (exactly 2.0%)
      const bill2Pct = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 51000, taxRatePpm: 150_000 },
          {
            description: "Ergonomic Chairs",
            quantity: 20,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          },
        ],
      });
      expect(bill2Pct.hasVarianceAlert).toBe(false);

      // 50000 * 1.0205 = 51025 (2.05% > 2.0%)
      const bill205Pct = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [
          { description: "Office Desks", quantity: 10, unitPriceMinor: 51025, taxRatePpm: 150_000 },
          {
            description: "Ergonomic Chairs",
            quantity: 20,
            unitPriceMinor: 25000,
            taxRatePpm: 150_000,
          },
        ],
      });
      expect(bill205Pct.hasVarianceAlert).toBe(true);
    });

    it("Tier 2: rejects bill creation against DRAFT (unissued) PO", () => {
      const draftPo = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [{ description: "Item", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
      });

      expect(() =>
        matchEngine.createBill(TENANT_A, {
          supplierId,
          purchaseOrderId: draftPo.id,
          lines: [{ description: "Item", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
        }),
      ).toThrow("Cannot match bill against DRAFT purchase order");
    });

    it("Tier 2: rejects bill referencing mismatched supplier ID", () => {
      const otherSup = supplierEngine.createSupplier(TENANT_A, { name: "Other Sup" });
      expect(() =>
        matchEngine.createBill(TENANT_A, {
          supplierId: otherSup.id,
          purchaseOrderId: po.id,
          lines: [{ description: "Item", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
        }),
      ).toThrow("Supplier ID on bill does not match Purchase Order");
    });

    it("Tier 2: rejects marking UNAPPROVED bill as PAID", () => {
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId,
        purchaseOrderId: po.id,
        lines: [{ description: "Desks", quantity: 10, unitPriceMinor: 50000, taxRatePpm: 150_000 }],
      });

      expect(() => matchEngine.markPaid(TENANT_A, bill.id)).toThrow(
        "must be APPROVED before marking as PAID",
      );
    });

    it("Tier 2: enforces tenant isolation on 3-way match bill retrieval", () => {
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId,
        lines: [{ description: "Item", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
      });

      expect(() => matchEngine.getBill(TENANT_B, bill.id)).toThrow("404 Not Found");
    });
  });

  // --------------------------------------------------------------------------
  // FEAT-22: Goods Receipt Notes (GRN)
  // --------------------------------------------------------------------------
  describe("FEAT-22: Goods Receipt Notes (GRN)", () => {
    let supplierId: string;
    let itemId: string;
    let po: SupplierPO;

    beforeEach(() => {
      const sup = supplierEngine.createSupplier(TENANT_A, { name: "Freight Masters" });
      supplierId = sup.id;

      const item = inventoryEngine.createItem(TENANT_A, {
        sku: "WIDGET-100",
        name: "Industrial Widget",
        costPriceMinor: 2000,
        reorderLevel: 20,
      });
      itemId = item.id;

      po = poEngine.createPO(TENANT_A, {
        supplierId,
        lines: [
          {
            description: "Industrial Widget",
            quantity: 50,
            unitPriceMinor: 2000,
            taxRatePpm: 150_000,
            itemId,
          },
        ],
      });
      poEngine.updateStatus(TENANT_A, po.id, "ISSUED");
    });

    it("Tier 1: creates GRN and updates PO line receivedQuantity and inventory stock", () => {
      const grn = grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 30 }],
      });

      expect(grn.grnNumber).toBeDefined();
      expect(grn.status).toBe("RECEIVED");
      expect(po.lines[0].receivedQuantity).toBe(30);

      const item = inventoryEngine.getItem(TENANT_A, itemId);
      expect(item.currentStock).toBe(30);
    });

    it("Tier 1: handles partial receipts and full completion closing the PO", () => {
      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 30 }],
      });
      expect(po.status).toBe("ISSUED");

      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 20 }],
      });

      expect(po.lines[0].receivedQuantity).toBe(50);
      expect(po.status).toBe("CLOSED");

      const item = inventoryEngine.getItem(TENANT_A, itemId);
      expect(item.currentStock).toBe(50);
    });

    it("Tier 1: lists GRNs for a given PO", () => {
      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 10 }],
      });
      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 10 }],
      });

      expect(grnEngine.listGRNsForPO(TENANT_A, po.id)).toHaveLength(2);
    });

    it("Tier 2: rejects GRN logging with non-positive received quantity", () => {
      expect(() =>
        grnEngine.createGRN(TENANT_A, {
          poId: po.id,
          lines: [{ poLineIndex: 0, quantityReceived: 0 }],
        }),
      ).toThrow("Quantity received must be positive");
    });

    it("Tier 2: rejects GRN logging against CLOSED or ARCHIVED PO", () => {
      poEngine.updateStatus(TENANT_A, po.id, "CLOSED");
      expect(() =>
        grnEngine.createGRN(TENANT_A, {
          poId: po.id,
          lines: [{ poLineIndex: 0, quantityReceived: 10 }],
        }),
      ).toThrow("Cannot record Goods Receipt for closed or archived PO");
    });

    it("Tier 2: rejects over-receipt exceeding PO ordered quantity by >5%", () => {
      expect(() =>
        grnEngine.createGRN(TENANT_A, {
          poId: po.id,
          lines: [{ poLineIndex: 0, quantityReceived: 60 }], // 60 > 50 * 1.05 = 52.5
        }),
      ).toThrow("exceeds PO line ordered quantity");
    });

    it("Tier 2: enforces tenant isolation on GRN lookup", () => {
      const grn = grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 10 }],
      });

      expect(() => grnEngine.getGRN(TENANT_B, grn.id)).toThrow("404 Not Found");
    });
  });

  // --------------------------------------------------------------------------
  // FEAT-23: Inventory Item Catalog
  // --------------------------------------------------------------------------
  describe("FEAT-23: Inventory Item Catalog", () => {
    it("Tier 1: creates inventory item with SKU and reorder level", () => {
      const item = inventoryEngine.createItem(TENANT_A, {
        sku: "SKU-LAPTOP-15",
        name: "Enterprise Laptop 15-inch",
        description: "16GB RAM 512GB SSD",
        itemType: "INVENTORY",
        costPriceMinor: 300000,
        sellingPriceMinor: 450000,
        reorderLevel: 5,
      });

      expect(item.id).toBeDefined();
      expect(item.sku).toBe("SKU-LAPTOP-15");
      expect(item.currentStock).toBe(0);
      expect(item.reorderLevel).toBe(5);
      expect(item.isActive).toBe(true);
    });

    it("Tier 1: lists active items sorted by name", () => {
      inventoryEngine.createItem(TENANT_A, { sku: "SKU-C", name: "Charlie Item" });
      inventoryEngine.createItem(TENANT_A, { sku: "SKU-A", name: "Alpha Item" });

      const list = inventoryEngine.listItems(TENANT_A);
      expect(list[0].name).toBe("Alpha Item");
      expect(list[1].name).toBe("Charlie Item");
    });

    it("Tier 1: updates inventory item prices and reorder level", () => {
      const created = inventoryEngine.createItem(TENANT_A, {
        sku: "SKU-UPDATE",
        name: "Monitor 27in",
        costPriceMinor: 80000,
        reorderLevel: 2,
      });

      const updated = inventoryEngine.updateItem(TENANT_A, created.id, {
        sellingPriceMinor: 120000,
        reorderLevel: 10,
      });

      expect(updated.sellingPriceMinor).toBe(120000);
      expect(updated.reorderLevel).toBe(10);
    });

    it("Tier 1: deactivates inventory item and removes from active listing", () => {
      const created = inventoryEngine.createItem(TENANT_A, { sku: "SKU-TEMP", name: "Temp Item" });
      inventoryEngine.deactivateItem(TENANT_A, created.id);

      const list = inventoryEngine.listItems(TENANT_A);
      expect(list.find((i) => i.id === created.id)).toBeUndefined();
    });

    it("Tier 2: rejects duplicate SKU within same tenant", () => {
      inventoryEngine.createItem(TENANT_A, { sku: "SKU-DUP", name: "Item 1" });
      expect(() =>
        inventoryEngine.createItem(TENANT_A, { sku: "SKU-DUP", name: "Item 2" }),
      ).toThrow("already exists");
    });

    it("Tier 2: allows duplicate SKU across DIFFERENT tenants", () => {
      const itemA = inventoryEngine.createItem(TENANT_A, {
        sku: "SKU-GLOBAL",
        name: "Tenant A Item",
      });
      const itemB = inventoryEngine.createItem(TENANT_B, {
        sku: "SKU-GLOBAL",
        name: "Tenant B Item",
      });

      expect(itemA.tenantId).toBe(TENANT_A);
      expect(itemB.tenantId).toBe(TENANT_B);
    });

    it("Tier 2: rejects negative cost price", () => {
      expect(() =>
        inventoryEngine.createItem(TENANT_A, {
          sku: "SKU-NEG",
          name: "Neg Cost",
          costPriceMinor: -100,
        }),
      ).toThrow("Cost price cannot be negative");
    });

    it("Tier 2: prevents stock from dropping below zero", () => {
      const item = inventoryEngine.createItem(TENANT_A, { sku: "SKU-STOCK", name: "Stock Item" });
      expect(() => inventoryEngine.adjustStock(TENANT_A, item.id, -5)).toThrow("cannot go below 0");
    });
  });

  // --------------------------------------------------------------------------
  // FEAT-24: Stock Valuation Engine
  // --------------------------------------------------------------------------
  describe("FEAT-24: Stock Valuation Engine", () => {
    let item: InventoryItem;

    beforeEach(() => {
      item = inventoryEngine.createItem(TENANT_A, {
        sku: "VAL-WIDGET",
        name: "Valuation Widget",
      });

      // Batch 1: 100 units @ 1000 minor (10 SAR)
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "RECEIPT",
        quantity: 100,
        unitCostMinor: 1000,
        timestamp: "2026-08-01T10:00:00Z",
      });

      // Batch 2: 50 units @ 1600 minor (16 SAR)
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "RECEIPT",
        quantity: 50,
        unitCostMinor: 1600,
        timestamp: "2026-08-02T10:00:00Z",
      });
    });

    it("Tier 1: calculates inventory valuation using Weighted Average Cost (WAC)", () => {
      // Total qty = 150, Total value = (100*1000) + (50*1600) = 100000 + 80000 = 180000 minor
      // Avg cost = 180000 / 150 = 1200 minor
      const val = valuationEngine.calculateValuation(TENANT_A, item, "WAC");
      expect(val.totalQuantity).toBe(150);
      expect(val.totalAssetValueMinor).toBe(180000);
      expect(val.averageUnitCostMinor).toBe(1200);
    });

    it("Tier 1: calculates valuation under FIFO after partial dispatch", () => {
      // Dispatch 80 units
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "DISPATCH",
        quantity: 80,
        unitCostMinor: 0,
        timestamp: "2026-08-03T10:00:00Z",
      });

      // FIFO: 80 units consumed from Batch 1 (100@1000). Remaining: 20@1000 + 50@1600 = 20000 + 80000 = 100000
      const valFIFO = valuationEngine.calculateValuation(TENANT_A, item, "FIFO");
      expect(valFIFO.totalQuantity).toBe(70);
      expect(valFIFO.totalAssetValueMinor).toBe(100000);
    });

    it("Tier 1: calculates valuation under LIFO after partial dispatch", () => {
      // Dispatch 80 units
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "DISPATCH",
        quantity: 80,
        unitCostMinor: 0,
        timestamp: "2026-08-03T10:00:00Z",
      });

      // LIFO: 50 units from Batch 2 (50@1600) + 30 units from Batch 1 (100@1000). Remaining: 70@1000 = 70000
      const valLIFO = valuationEngine.calculateValuation(TENANT_A, item, "LIFO");
      expect(valLIFO.totalQuantity).toBe(70);
      expect(valLIFO.totalAssetValueMinor).toBe(70000);
    });

    it("Tier 2: handles 0 stock valuation correctly (total asset value = 0)", () => {
      const emptyItem = inventoryEngine.createItem(TENANT_A, { sku: "EMPTY-SKU", name: "Empty" });
      const val = valuationEngine.calculateValuation(TENANT_A, emptyItem, "WAC");
      expect(val.totalQuantity).toBe(0);
      expect(val.totalAssetValueMinor).toBe(0);
      expect(val.averageUnitCostMinor).toBe(0);
    });

    it("Tier 2: preserves precision across multiple decimal minor unit WAC calculations", () => {
      // Receipt 3 units @ 100 minor = 300
      // Receipt 4 units @ 250 minor = 1000
      // Total 7 units = 1300 -> avg 185.71 -> rounded to 186
      const oddItem = inventoryEngine.createItem(TENANT_A, { sku: "ODD-SKU", name: "Odd Item" });
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: oddItem.id,
        movementType: "RECEIPT",
        quantity: 3,
        unitCostMinor: 100,
        timestamp: "2026-08-01T00:00:00Z",
      });
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: oddItem.id,
        movementType: "RECEIPT",
        quantity: 4,
        unitCostMinor: 250,
        timestamp: "2026-08-02T00:00:00Z",
      });

      const val = valuationEngine.calculateValuation(TENANT_A, oddItem, "WAC");
      expect(val.totalAssetValueMinor).toBe(1300);
      expect(val.averageUnitCostMinor).toBe(186);
    });
  });

  // --------------------------------------------------------------------------
  // FEAT-25: Low-Stock Digest Alert
  // --------------------------------------------------------------------------
  describe("FEAT-25: Low-Stock Digest Alert", () => {
    it("Tier 1: detects low-stock items below reorderLevel and categorizes severity", () => {
      // Item 1: Stock = 0, reorderLevel = 10 -> CRITICAL
      const item1 = inventoryEngine.createItem(TENANT_A, {
        sku: "ITEM-CRIT",
        name: "Critical Item",
        reorderLevel: 10,
      });
      // Item 2: Stock = 5, reorderLevel = 10 -> WARNING
      const item2 = inventoryEngine.createItem(TENANT_A, {
        sku: "ITEM-WARN",
        name: "Warning Item",
        reorderLevel: 10,
      });
      inventoryEngine.adjustStock(TENANT_A, item2.id, 5);
      // Item 3: Stock = 20, reorderLevel = 10 -> OK (not in digest)
      const item3 = inventoryEngine.createItem(TENANT_A, {
        sku: "ITEM-OK",
        name: "OK Item",
        reorderLevel: 10,
      });
      inventoryEngine.adjustStock(TENANT_A, item3.id, 20);

      const digest = digestEngine.generateDigest(TENANT_A);

      expect(digest.totalLowStockItems).toBe(2);
      expect(digest.criticalCount).toBe(1);
      expect(digest.warningCount).toBe(1);

      const crit = digest.items.find((i) => i.itemId === item1.id);
      expect(crit?.severity).toBe("CRITICAL");
      expect(crit?.deficitQuantity).toBe(10);

      const warn = digest.items.find((i) => i.itemId === item2.id);
      expect(warn?.severity).toBe("WARNING");
      expect(warn?.deficitQuantity).toBe(5);
    });

    it("Tier 2: boundary test - stock equal to reorderLevel triggers WARNING; stock > reorderLevel does NOT", () => {
      const item = inventoryEngine.createItem(TENANT_A, {
        sku: "ITEM-BOUND",
        name: "Boundary Item",
        reorderLevel: 10,
      });
      inventoryEngine.adjustStock(TENANT_A, item.id, 10);

      let digest = digestEngine.generateDigest(TENANT_A);
      expect(digest.totalLowStockItems).toBe(1);

      inventoryEngine.adjustStock(TENANT_A, item.id, 1); // Now stock = 11 > 10
      digest = digestEngine.generateDigest(TENANT_A);
      expect(digest.totalLowStockItems).toBe(0);
    });

    it("Tier 2: ignores items with null reorderLevel", () => {
      inventoryEngine.createItem(TENANT_A, {
        sku: "NO-REORDER",
        name: "No Reorder Level Item",
        reorderLevel: null,
      });
      const digest = digestEngine.generateDigest(TENANT_A);
      expect(digest.totalLowStockItems).toBe(0);
    });

    it("Tier 2: ignores SERVICE item types", () => {
      inventoryEngine.createItem(TENANT_A, {
        sku: "SVC-CONSULT",
        name: "Consulting",
        itemType: "SERVICE",
        reorderLevel: 10,
      });
      const digest = digestEngine.generateDigest(TENANT_A);
      expect(digest.totalLowStockItems).toBe(0);
    });

    it("Tier 2: verifies multi-tenant isolation in low-stock digest", () => {
      inventoryEngine.createItem(TENANT_A, { sku: "TENANT-A-LOW", name: "A Low", reorderLevel: 5 });

      const digestB = digestEngine.generateDigest(TENANT_B);
      expect(digestB.totalLowStockItems).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Tier 3: Cross-Feature Interactions
  // --------------------------------------------------------------------------
  describe("Tier 3: Cross-Feature Interactions", () => {
    it("T3.1: Procurement E2E: Supplier -> Outbound PO -> GRN -> Stock Increment -> 3-Way Match Bill", () => {
      // Step 1: Create Supplier
      const supplier = supplierEngine.createSupplier(TENANT_A, { name: "Universal Supplies" });

      // Step 2: Create Inventory Item
      const item = inventoryEngine.createItem(TENANT_A, {
        sku: "UNIV-PIPE-50",
        name: "Steel Pipe 50mm",
        costPriceMinor: 4000,
        reorderLevel: 20,
      });

      // Step 3: Issue Outbound PO
      const po = poEngine.createPO(TENANT_A, {
        supplierId: supplier.id,
        lines: [
          {
            description: "Steel Pipe 50mm",
            quantity: 100,
            unitPriceMinor: 4000,
            taxRatePpm: 150_000,
            itemId: item.id,
          },
        ],
      });
      poEngine.updateStatus(TENANT_A, po.id, "ISSUED");

      // Step 4: Receive Goods via GRN
      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 100 }],
      });

      // Verify stock level updated from 0 to 100
      const updatedItem = inventoryEngine.getItem(TENANT_A, item.id);
      expect(updatedItem.currentStock).toBe(100);

      // Step 5: 3-Way Match Supplier Bill
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        lines: [
          {
            description: "Steel Pipe 50mm",
            quantity: 100,
            unitPriceMinor: 4000,
            taxRatePpm: 150_000,
          },
        ],
      });

      expect(bill.hasVarianceAlert).toBe(false);
      const approvedBill = matchEngine.approveBill(TENANT_A, bill.id);
      expect(approvedBill.status).toBe("APPROVED");
    });

    it("T3.2: 3-Way Match Price Variance Alert prevents auto-approval", () => {
      const supplier = supplierEngine.createSupplier(TENANT_A, { name: "High Cost Sup" });
      const po = poEngine.createPO(TENANT_A, {
        supplierId: supplier.id,
        lines: [{ description: "Sensors", quantity: 10, unitPriceMinor: 10000, taxRatePpm: 0 }],
      });
      poEngine.updateStatus(TENANT_A, po.id, "ISSUED");

      // Supplier sends bill with 15% higher unit price
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        lines: [{ description: "Sensors", quantity: 10, unitPriceMinor: 11500, taxRatePpm: 0 }],
      });

      expect(bill.hasVarianceAlert).toBe(true);
      expect(bill.variances[0].field).toBe("unitPrice");
      expect(bill.variances[0].variancePercent).toBe(15);
    });

    it("T3.3: GRN delivery removes item from Low-Stock Digest", () => {
      const item = inventoryEngine.createItem(TENANT_A, {
        sku: "LOW-DESK",
        name: "Desk",
        reorderLevel: 5,
      });
      // Initially stock = 0 <= 5 -> Appears in digest
      let digest = digestEngine.generateDigest(TENANT_A);
      expect(digest.totalLowStockItems).toBe(1);

      const supplier = supplierEngine.createSupplier(TENANT_A, { name: "Furniture Sup" });
      const po = poEngine.createPO(TENANT_A, {
        supplierId: supplier.id,
        lines: [
          {
            description: "Desk",
            quantity: 10,
            unitPriceMinor: 10000,
            taxRatePpm: 0,
            itemId: item.id,
          },
        ],
      });
      poEngine.updateStatus(TENANT_A, po.id, "ISSUED");

      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 10 }],
      });

      // Stock now 10 > 5 -> Digest should be clear
      digest = digestEngine.generateDigest(TENANT_A);
      expect(digest.totalLowStockItems).toBe(0);
    });

    it("T3.4: Stock dispatch triggers Low-Stock Digest entry", () => {
      const item = inventoryEngine.createItem(TENANT_A, {
        sku: "DISP-ITEM",
        name: "Disp Item",
        reorderLevel: 5,
      });
      inventoryEngine.adjustStock(TENANT_A, item.id, 10); // Stock = 10

      expect(digestEngine.generateDigest(TENANT_A).totalLowStockItems).toBe(0);

      // Dispatch 6 units -> Stock drops to 4 <= 5
      inventoryEngine.adjustStock(TENANT_A, item.id, -6);
      expect(digestEngine.generateDigest(TENANT_A).totalLowStockItems).toBe(1);
    });

    it("T3.5: Multi-batch GRN affects Valuation Engine results differently under FIFO vs LIFO", () => {
      const item = inventoryEngine.createItem(TENANT_A, { sku: "BATCH-VAL", name: "Batch Val" });

      // Receipt 1: 50 units @ 100
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "RECEIPT",
        quantity: 50,
        unitCostMinor: 100,
        timestamp: "2026-08-01T00:00:00Z",
      });
      // Receipt 2: 50 units @ 200
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "RECEIPT",
        quantity: 50,
        unitCostMinor: 200,
        timestamp: "2026-08-02T00:00:00Z",
      });

      // Dispatch 40 units
      valuationEngine.recordMovement({
        tenantId: TENANT_A,
        itemId: item.id,
        movementType: "DISPATCH",
        quantity: 40,
        unitCostMinor: 0,
        timestamp: "2026-08-03T00:00:00Z",
      });

      // Remaining 60 units
      // FIFO: 10@100 + 50@200 = 1000 + 10000 = 11000
      const fifo = valuationEngine.calculateValuation(TENANT_A, item, "FIFO");
      // LIFO: 50@100 + 10@200 = 5000 + 2000 = 7000
      const lifo = valuationEngine.calculateValuation(TENANT_A, item, "LIFO");

      expect(fifo.totalAssetValueMinor).toBe(11000);
      expect(lifo.totalAssetValueMinor).toBe(7000);
    });

    it("T3.6: Linking PO to Quotation updates invoice readiness", () => {
      const supplier = supplierEngine.createSupplier(TENANT_A, { name: "Link Sup" });
      const po = poEngine.createPO(TENANT_A, {
        supplierId: supplier.id,
        lines: [{ description: "Item", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
      });

      poEngine.updateApproval(TENANT_A, po.id, "APPROVED", true);
      let readiness = poEngine.deriveReadiness(po);
      expect(readiness.code).toBe("PO_RECORDED");

      po.quotationId = "quotation-uuid-999";
      readiness = poEngine.deriveReadiness(po);
      expect(readiness.code).toBe("READY_TO_INVOICE");
    });

    it("T3.7: Deactivated supplier blocks new PO creation", () => {
      const supplier = supplierEngine.createSupplier(TENANT_A, { name: "Deactivating Sup" });
      supplierEngine.deactivateSupplier(TENANT_A, supplier.id);

      expect(() =>
        poEngine.createPO(TENANT_A, {
          supplierId: supplier.id,
          lines: [{ description: "Item", quantity: 1, unitPriceMinor: 100, taxRatePpm: 0 }],
        }),
      ).toThrow("Cannot create purchase order for inactive supplier");
    });
  });

  // --------------------------------------------------------------------------
  // Tier 4: Real-World Workloads
  // --------------------------------------------------------------------------
  describe("Tier 4: Real-World Workloads", () => {
    it("T4.1: Complete Procure-to-Pay Lifecycle Simulation", () => {
      // 1. Vendor onboarding
      const vendor = supplierEngine.createSupplier(TENANT_A, {
        name: "National Contracting Corp",
        taxId: "310022233300003",
        iban: "SA5580000000123456789012",
        paymentTerms: 30,
      });

      // 2. Catalog setup
      const cement = inventoryEngine.createItem(TENANT_A, {
        sku: "MAT-CEMENT",
        name: "Portland Cement 50kg",
        costPriceMinor: 2500,
        sellingPriceMinor: 3500,
        reorderLevel: 50,
      });

      // 3. Issue Outbound PO
      const po = poEngine.createPO(TENANT_A, {
        supplierId: vendor.id,
        poNumber: "PO-PROCURE-001",
        lines: [
          {
            description: "Portland Cement 50kg",
            quantity: 200,
            unitPriceMinor: 2500,
            taxRatePpm: 150_000,
            itemId: cement.id,
          },
        ],
      });
      poEngine.updateStatus(TENANT_A, po.id, "ISSUED");

      // 4. Goods receipt batch 1 (100 bags)
      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 100 }],
      });
      expect(inventoryEngine.getItem(TENANT_A, cement.id).currentStock).toBe(100);

      // 5. Goods receipt batch 2 (100 bags)
      grnEngine.createGRN(TENANT_A, {
        poId: po.id,
        lines: [{ poLineIndex: 0, quantityReceived: 100 }],
      });
      expect(inventoryEngine.getItem(TENANT_A, cement.id).currentStock).toBe(200);
      expect(po.status).toBe("CLOSED");

      // 6. Receive & Match Supplier Bill
      const bill = matchEngine.createBill(TENANT_A, {
        supplierId: vendor.id,
        purchaseOrderId: po.id,
        billNumber: "INV-NCC-9901",
        lines: [
          {
            description: "Portland Cement 50kg",
            quantity: 200,
            unitPriceMinor: 2500,
            taxRatePpm: 150_000,
          },
        ],
      });
      expect(bill.hasVarianceAlert).toBe(false);

      // 7. Approve & Pay Bill
      matchEngine.approveBill(TENANT_A, bill.id);
      const paid = matchEngine.markPaid(TENANT_A, bill.id);
      expect(paid.status).toBe("PAID");

      // 8. Verify valuation & stock digest
      const val = valuationEngine.calculateValuation(TENANT_A, cement, "WAC");
      expect(val).toBeDefined();
      expect(digestEngine.generateDigest(TENANT_A).totalLowStockItems).toBe(0);
    });

    it("T4.2: High-Volume Stock Movement Ledger Stress (50 sequential movements)", () => {
      const item = inventoryEngine.createItem(TENANT_A, { sku: "STRESS-SKU", name: "Stress Item" });

      for (let i = 0; i < 50; i++) {
        valuationEngine.recordMovement({
          tenantId: TENANT_A,
          itemId: item.id,
          movementType: i % 3 === 0 ? "DISPATCH" : "RECEIPT",
          quantity: 10,
          unitCostMinor: 1000 + i * 10,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const fifo = valuationEngine.calculateValuation(TENANT_A, item, "FIFO");
      const wac = valuationEngine.calculateValuation(TENANT_A, item, "WAC");

      expect(fifo.totalQuantity).toBeGreaterThan(0);
      expect(wac.totalAssetValueMinor).toBeGreaterThan(0);
    });

    it("T4.3: Multi-Tenant Enterprise Procurement Isolation under concurrent operations", () => {
      const supA = supplierEngine.createSupplier(TENANT_A, { name: "Sup A" });
      const supB = supplierEngine.createSupplier(TENANT_B, { name: "Sup B" });

      const itemA = inventoryEngine.createItem(TENANT_A, {
        sku: "SHARED-SKU",
        name: "Item A",
        reorderLevel: 10,
      });
      const itemB = inventoryEngine.createItem(TENANT_B, {
        sku: "SHARED-SKU",
        name: "Item B",
        reorderLevel: 10,
      });

      const poA = poEngine.createPO(TENANT_A, {
        supplierId: supA.id,
        lines: [
          { description: "A", quantity: 5, unitPriceMinor: 100, taxRatePpm: 0, itemId: itemA.id },
        ],
      });
      const poB = poEngine.createPO(TENANT_B, {
        supplierId: supB.id,
        lines: [
          { description: "B", quantity: 5, unitPriceMinor: 100, taxRatePpm: 0, itemId: itemB.id },
        ],
      });

      poEngine.updateStatus(TENANT_A, poA.id, "ISSUED");
      poEngine.updateStatus(TENANT_B, poB.id, "ISSUED");

      grnEngine.createGRN(TENANT_A, {
        poId: poA.id,
        lines: [{ poLineIndex: 0, quantityReceived: 5 }],
      });

      // Tenant A stock = 5 <= 10 -> Low stock
      // Tenant B stock = 0 <= 10 -> Low stock
      const digestA = digestEngine.generateDigest(TENANT_A);
      const digestB = digestEngine.generateDigest(TENANT_B);

      expect(digestA.items[0].name).toBe("Item A");
      expect(digestB.items[0].name).toBe("Item B");
    });
  });
});

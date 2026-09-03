import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { CreditNotesService } from "../credit-notes/credit-notes.service.js";
import { LeadsService } from "../crm/leads.service.js";
import { OpportunitiesService } from "../crm/opportunities.service.js";
import { CustomersService } from "../customers/customers.service.js";
import { DatabaseService } from "../database/database.service.js";
import { DeliveryNotesService } from "../delivery-notes/delivery-notes.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { SalesOrdersService } from "../sales-orders/sales-orders.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";
// Unique per test run so re-running this suite against a persistent (non-ephemeral) local dev
// database doesn't collide with a previous run's rows on the email unique constraint.
const RUN_ID = crypto.randomUUID().slice(0, 8);

// This suite exists specifically because the seven services under test cast every Prisma query
// result through `as unknown as <LocalInterface>` (see the journal entry from this session for
// why), which defeats TypeScript's structural checking of Prisma `include`/`data` shapes against
// the real generated client types -- three real bugs (wrong field name, wrong relation name,
// missing required columns) compiled and typechecked cleanly while being 100% broken at runtime.
// Only a round-trip against a real Postgres database, through the real Prisma client, catches
// that class of bug. A unit test with a mocked `DatabaseService` cannot: the mock never validates
// field or relation names against the schema.
describe.runIf(databaseEnabled)("phase 1 modules journey with PostgreSQL boundaries", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let customers: CustomersService;
  let suppliers: SuppliersService;
  let inventory: InventoryService;
  let projects: ProjectsService;
  let leads: LeadsService;
  let opportunities: OpportunitiesService;
  let salesOrders: SalesOrdersService;
  let deliveryNotes: DeliveryNotesService;
  let creditNotes: CreditNotesService;

  async function setUpBusinessWithCustomer(label: string) {
    const owner = await identity.signUp({
      displayName: `${label} Owner`,
      email: `${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-owner-${RUN_ID}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: `${label} Co`,
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      `integration-business-${label}`,
    );
    const customer = await customers.create(
      owner.id,
      business.id,
      {
        name: `${label} Customer`,
        email: `${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-customer-${RUN_ID}@example.test`,
        phone: null,
        addressLine1: "King Fahd Road",
        addressLine2: null,
        city: "Riyadh",
        postalCode: null,
        countryCode: "SA",
      },
      `integration-customer-${label}`,
    );
    return { owner, business, customer };
  }

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    const configuration = new ConfigurationService(database, access);
    // This suite never exercises a password reset, so the mail transport is stubbed rather than
    // pointed at Mailpit; a real transport would make the suite depend on SMTP being up.
    identity = new IdentityService(database, {
      sendPasswordReset: async () => "stubbed-message-id",
    } as never);
    platform = new PlatformService(database, access, configuration);
    customers = new CustomersService(database, access, { isConfigured: () => false } as never);
    suppliers = new SuppliersService(database, access);
    inventory = new InventoryService(database, access);
    projects = new ProjectsService(database, access);
    leads = new LeadsService(database, access);
    // This suite exercises only opportunities.create, never the quotation
    // conversion, so the quotation engine is stubbed rather than fully wired.
    opportunities = new OpportunitiesService(database, access, {} as never);
    salesOrders = new SalesOrdersService(database, access, inventory);
    deliveryNotes = new DeliveryNotesService(database, access, inventory);
    creditNotes = new CreditNotesService(database, access);
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  it("creates a supplier and deactivates it", async () => {
    const { owner, business } = await setUpBusinessWithCustomer("Supplier");
    const supplier = await suppliers.create(
      owner.id,
      business.id,
      {
        name: "Acme Supplies LLC",
        contactName: null,
        email: null,
        phone: null,
        taxId: null,
        paymentTerms: null,
        notes: null,
      },
      "integration-supplier-create",
    );
    expect(supplier.isActive).toBe(true);

    const deactivated = await suppliers.deactivate(
      owner.id,
      business.id,
      supplier.id,
      "integration-supplier-deactivate",
    );
    expect(deactivated.isActive).toBe(false);
  }, 30_000);

  it("creates an inventory item with a nonzero tax rate", async () => {
    const { owner, business } = await setUpBusinessWithCustomer("Inventory");
    const item = await inventory.create(
      owner.id,
      business.id,
      {
        sku: "SKU-100",
        name: "Widget",
        description: null,
        itemType: "INVENTORY",
        unit: "each",
        costPriceMinor: "1000",
        sellingPriceMinor: "2000",
        taxRatePpm: 150_000,
        reorderLevel: 5,
      },
      "integration-inventory-create",
    );
    // This is the exact field this session found renamed to the DB column name (`ratePpm`)
    // instead of the real Prisma field (`taxRatePpm`) -- asserting on it here is deliberate.
    expect(item.taxRatePpm).toBe(150_000);
    expect(item.sku).toBe("SKU-100");
  }, 30_000);

  it("values persisted stock movements with FIFO and AVCO", async () => {
    const { owner, business } = await setUpBusinessWithCustomer("Valuation");
    const item = await inventory.create(
      owner.id,
      business.id,
      {
        sku: `SKU-VALUATION-${RUN_ID}`,
        name: "Valuation Widget",
        description: null,
        itemType: "INVENTORY",
        unit: "each",
        costPriceMinor: "10000",
        sellingPriceMinor: "20000",
        taxRatePpm: 0,
        reorderLevel: null,
      },
      "integration-valuation-item",
    );
    const location = await inventory.createLocation(
      owner.id,
      business.id,
      { code: `VAL-${RUN_ID}`, name: "Valuation Warehouse", isDefault: true },
      "integration-valuation-location",
    );
    const movement = async (
      quantity: number,
      movementType: "RECEIPT" | "DISPATCH" | "ADJUSTMENT",
      unitCostMinor: string,
      requestId: string,
    ) =>
      inventory.recordMovement(
        owner.id,
        business.id,
        {
          itemId: item.id,
          locationId: location.id,
          movementType,
          quantity,
          unitCostMinor,
        },
        requestId,
      );
    await movement(10, "RECEIPT", "10000", "integration-valuation-receipt-a");
    await movement(10, "RECEIPT", "20000", "integration-valuation-receipt-b");
    await movement(5, "DISPATCH", "0", "integration-valuation-dispatch");
    await movement(5, "ADJUSTMENT", "10000", "integration-valuation-adjustment-in");
    await movement(-5, "ADJUSTMENT", "0", "integration-valuation-adjustment-out");

    await expect(
      inventory.valuation(owner.id, business.id, item.id, location.id, "FIFO"),
    ).resolves.toMatchObject({
      valuationMethod: "FIFO",
      totalQuantity: 15,
      totalAssetValueMinor: "250000",
      averageUnitCostMinor: "16667",
    });
    await expect(
      inventory.valuation(owner.id, business.id, item.id, location.id, "AVCO"),
    ).resolves.toMatchObject({
      valuationMethod: "AVCO",
      totalQuantity: 15,
      totalAssetValueMinor: "206250",
      averageUnitCostMinor: "13750",
    });

    const transferLocation = await inventory.createLocation(
      owner.id,
      business.id,
      { code: `VAL-XFER-${RUN_ID}`, name: "Valuation Transfer Warehouse" },
      "integration-valuation-transfer-location",
    );
    await inventory.transferStock(
      owner.id,
      business.id,
      {
        itemId: item.id,
        fromLocationId: location.id,
        toLocationId: transferLocation.id,
        quantity: 1,
      },
      "integration-valuation-transfer",
    );
    await expect(
      inventory.valuation(owner.id, business.id, item.id, transferLocation.id, "FIFO"),
    ).resolves.toMatchObject({
      totalQuantity: 1,
      totalAssetValueMinor: "16667",
      averageUnitCostMinor: "16667",
    });
    await expect(
      inventory.valuation(owner.id, business.id, item.id, transferLocation.id, "AVCO"),
    ).resolves.toMatchObject({
      totalQuantity: 1,
      totalAssetValueMinor: "13750",
      averageUnitCostMinor: "13750",
    });
  }, 30_000);

  it("creates a project linked to a customer", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("Project");
    const project = await projects.create(
      owner.id,
      business.id,
      {
        name: "Website Revamp",
        customerId: customer.id,
        description: null,
        startDate: null,
        endDate: null,
        budgetMinor: "500000",
        notes: null,
      },
      "integration-project-create",
    );
    expect(project.customer?.id).toBe(customer.id);
    expect(project.status).toBe("ACTIVE");
  }, 30_000);

  it("creates a lead, converts it, and creates an opportunity referencing the lead", async () => {
    const { owner, business } = await setUpBusinessWithCustomer("Crm");
    const lead = await leads.create(
      owner.id,
      business.id,
      {
        name: "Jane Prospect",
        company: "Prospect Inc",
        email: null,
        phone: null,
        source: "referral",
        estimatedValue: null,
        currencyCode: null,
        notes: null,
      },
      "integration-lead-create",
    );
    expect(lead.status).toBe("NEW");

    const converted = await leads.convert(
      owner.id,
      business.id,
      lead.id,
      "integration-lead-convert",
    );
    expect(converted.status).toBe("CONVERTED");
    expect(converted.convertedAt).not.toBeNull();
    // Converting a lead now progresses it into a linked opportunity.
    expect(converted.opportunityId).not.toBeNull();

    // This is the exact relation this session found misnamed (`quotation` instead of the real
    // `quote` relation on Opportunity) -- creating and reading one back is deliberate here.
    const opportunity = await opportunities.create(
      owner.id,
      business.id,
      {
        leadId: lead.id,
        name: "Website Revamp Deal",
        stage: "PROSPECTING",
        probability: 50,
        amountMinor: "500000",
        currencyCode: "SAR",
        expectedCloseDate: null,
        notes: null,
      },
      "integration-opportunity-create",
    );
    expect(opportunity.lead?.id).toBe(lead.id);
    expect(opportunity.quotation).toBeNull();
  }, 30_000);

  it("creates a sales order, confirms it, then cancels it", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("SalesOrder");
    const salesOrder = await salesOrders.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: [
          {
            description: "Consulting services",
            quantity: "1",
            unitPrice: "500.00",
            taxRatePercent: "15",
          },
        ],
      },
      "integration-sales-order-create",
    );
    // This is the exact bug this session found: currencyScale read from a model (BusinessSettings)
    // that doesn't have that field, which threw before any row was ever written.
    expect(salesOrder.number).toBe("SO-0001");
    expect(salesOrder.totalMinor).toBe("57500");
    expect(salesOrder.status).toBe("DRAFT");

    const confirmed = await salesOrders.confirm(
      owner.id,
      business.id,
      salesOrder.id,
      "integration-sales-order-confirm",
    );
    expect(confirmed.status).toBe("CONFIRMED");

    const cancelled = await salesOrders.cancel(
      owner.id,
      business.id,
      salesOrder.id,
      "integration-sales-order-cancel",
    );
    expect(cancelled.status).toBe("CANCELLED");
  }, 30_000);

  it("creates a delivery note sourced from a sales order and marks it delivered", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("DeliveryNote");
    const salesOrder = await salesOrders.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: [
          { description: "Widgets", quantity: "3", unitPrice: "50.00", taxRatePercent: "15" },
        ],
      },
      "integration-delivery-note-source-so",
    );

    // This is the exact bug this session found: create() never set the required validUntil /
    // currencyCode / currencyScale / subtotalMinor / taxMinor / totalMinor columns on Document.
    const deliveryNote = await deliveryNotes.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        salesOrderId: salesOrder.id,
        deliveryDate: undefined,
        notes: null,
        lines: [{ description: "3x widgets", quantity: "3" }],
      },
      "integration-delivery-note-create",
    );
    expect(deliveryNote.number).toBe("DN-0001");
    expect(deliveryNote.salesOrder?.id).toBe(salesOrder.id);
    expect(deliveryNote.status).toBe("DRAFT");

    const delivered = await deliveryNotes.markDelivered(
      owner.id,
      business.id,
      deliveryNote.id,
      "integration-delivery-note-deliver",
    );
    expect(delivered.status).toBe("DELIVERED");
  }, 30_000);

  it("accepts a delivery date earlier than the issue date", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("BackdatedDelivery");

    // The synthetic valid_until must not be taken from deliveryDate: `documents_dates_check`
    // requires valid_until >= issue_date, so a backdated delivery — which the request schema
    // accepts — would be rejected by the database.
    const deliveryNote = await deliveryNotes.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        deliveryDate: "2020-01-01",
        notes: null,
        lines: [{ description: "Delivered last year", quantity: "1" }],
      },
      "integration-delivery-note-backdated",
    );

    expect(deliveryNote.status).toBe("DRAFT");
  }, 30_000);

  it("accepts a sales order whose delivery date precedes its issue date", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("BackdatedSalesOrder");

    const salesOrder = await salesOrders.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        deliveryDate: "2020-01-01",
        lines: [{ description: "Widgets", quantity: "1", unitPrice: "10.00", taxRatePercent: "0" }],
      },
      "integration-sales-order-backdated",
    );

    expect(salesOrder.status).toBe("DRAFT");
  }, 30_000);

  it("creates a credit note against an invoice and issues it", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("CreditNote");
    const creditNote = await creditNotes.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        reason: "BILLING_ERROR",
        lines: [
          {
            description: "Refund adjustment",
            quantity: "1",
            unitPrice: "100.00",
            taxRatePercent: "15",
          },
        ],
      },
      "integration-credit-note-create",
    );
    expect(creditNote.number).toBe("CN-0001");
    expect(creditNote.totalMinor).toBe("11500");
    expect(creditNote.status).toBe("DRAFT");

    const issued = await creditNotes.issue(
      owner.id,
      business.id,
      creditNote.id,
      "integration-credit-note-issue",
    );
    expect(issued.status).toBe("ISSUED");
  }, 30_000);

  it("reserves stock on confirmation and dispatches it on delivery", async () => {
    const { owner, business, customer } = await setUpBusinessWithCustomer("Reservation");
    const item = await inventory.create(
      owner.id,
      business.id,
      { sku: "RES-001", name: "Reserved widget", costPriceMinor: "100" },
      "integration-reservation-item",
    );
    const location = await inventory.createLocation(
      owner.id,
      business.id,
      { code: "MAIN", name: "Main", isDefault: true },
      "integration-reservation-location",
    );
    await inventory.recordMovement(
      owner.id,
      business.id,
      {
        itemId: item.id,
        locationId: location.id,
        movementType: "RECEIPT",
        quantity: 10,
        unitCostMinor: "100",
      },
      "integration-reservation-receipt",
    );
    const order = await salesOrders.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: [
          {
            inventoryItemId: item.id,
            description: "Reserved widget",
            quantity: "4",
            unitPrice: "2.00",
            taxRatePercent: "0",
          },
        ],
      },
      "integration-reservation-order",
    );
    await salesOrders.confirm(owner.id, business.id, order.id, "integration-reservation-confirm");
    expect((await inventory.listReservations(owner.id, business.id, order.id))[0]?.status).toBe(
      "RESERVED",
    );
    expect(
      (await inventory.atp(owner.id, business.id, item.id, location.id)).availableQuantity,
    ).toBe(6);

    const note = await deliveryNotes.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        salesOrderId: order.id,
        lines: [{ description: "Reserved widget", quantity: "4" }],
      },
      "integration-reservation-note",
    );
    await deliveryNotes.markDelivered(
      owner.id,
      business.id,
      note.id,
      "integration-reservation-deliver",
    );
    expect((await inventory.listReservations(owner.id, business.id, order.id))[0]?.status).toBe(
      "FULFILLED",
    );
    expect(
      (await inventory.onHand(owner.id, business.id, item.id, location.id)).quantityOnHand,
    ).toBe(6);
    expect(
      (await inventory.atp(owner.id, business.id, item.id, location.id)).availableQuantity,
    ).toBe(6);
  });
});

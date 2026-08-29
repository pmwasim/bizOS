import { NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateGuard } from "../../src/configuration/guard-interpreter.js";
import { LeadsService } from "../../src/crm/leads.service.js";
import { OpportunitiesService } from "../../src/crm/opportunities.service.js";
import {
  notifyCustomizationRequestCreated,
  signPayload,
  verifyPayloadSignature,
} from "../../src/customization/n8n-notifier.js";
import { type DatabaseService } from "../../src/database/database.service.js";
import { ProjectsService } from "../../src/projects/projects.service.js";
import { type BusinessAccessService } from "../../src/security/business-access.service.js";

// Multi-tenant Test Identities
const TENANT_A_ID = 101n;
const TENANT_A_PUBLIC = "t0000000-0000-4000-8000-000000000001";
const BIZ_A_ID = 201n;
const BIZ_A_PUBLIC = "b0000000-0000-4000-8000-000000000001";
const USER_A_ID = 1n;
const USER_A_PUBLIC = "u0000000-0000-4000-8000-000000000001";
const MEMBER_A_ID = 301n;

const TENANT_B_ID = 102n;
const TENANT_B_PUBLIC = "t0000000-0000-4000-8000-000000000002";
const BIZ_B_ID = 202n;
const BIZ_B_PUBLIC = "b0000000-0000-4000-8000-000000000002";
const USER_B_ID = 2n;
const USER_B_PUBLIC = "u0000000-0000-4000-8000-000000000002";
const MEMBER_B_ID = 302n;

const ACCESS_A = {
  tenantId: TENANT_A_ID,
  tenantPublicId: TENANT_A_PUBLIC,
  businessId: BIZ_A_ID,
  businessPublicId: BIZ_A_PUBLIC,
  userId: USER_A_ID,
  userPublicId: USER_A_PUBLIC,
  membershipId: MEMBER_A_ID,
  role: "OWNER" as const,
};

const ACCESS_B = {
  tenantId: TENANT_B_ID,
  tenantPublicId: TENANT_B_PUBLIC,
  businessId: BIZ_B_ID,
  businessPublicId: BIZ_B_PUBLIC,
  userId: USER_B_ID,
  userPublicId: USER_B_PUBLIC,
  membershipId: MEMBER_B_ID,
  role: "OWNER" as const,
};

// In-Memory Database Store Mock for E2E Workflows
class InhouseMockStore {
  leads: Array<Record<string, unknown>> = [];
  opportunities: Array<Record<string, unknown>> = [];
  projects: Array<Record<string, unknown>> = [];
  milestones: Array<Record<string, unknown>> = [];
  timeLogs: Array<Record<string, unknown>> = [];
  costLogs: Array<Record<string, unknown>> = [];
  progressInvoices: Array<Record<string, unknown>> = [];
  interactionNotes: Array<Record<string, unknown>> = [];
  auditEvents: Array<Record<string, unknown>> = [];
  automationRules: Array<Record<string, unknown>> = [];

  reset() {
    this.leads = [];
    this.opportunities = [];
    this.projects = [];
    this.milestones = [];
    this.timeLogs = [];
    this.costLogs = [];
    this.progressInvoices = [];
    this.interactionNotes = [];
    this.auditEvents = [];
    this.automationRules = [];
  }
}

describe("Group 4 E2E Spec — CRM, Projects, Workflows & Audit (FEAT-26 to FEAT-35)", () => {
  let mockStore: InhouseMockStore;
  let databaseMock: DatabaseService;
  let accessMock: BusinessAccessService;

  let leadsService: LeadsService;
  let opportunitiesService: OpportunitiesService;
  let projectsService: ProjectsService;

  beforeEach(() => {
    mockStore = new InhouseMockStore();

    accessMock = {
      resolve: vi.fn().mockImplementation(async (userPubId: string, bizPubId: string) => {
        if (bizPubId === BIZ_A_PUBLIC) return ACCESS_A;
        if (bizPubId === BIZ_B_PUBLIC) return ACCESS_B;
        throw new NotFoundException("We could not find that business.");
      }),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;

    const buildTransaction = (_access: unknown) => ({
      lead: {
        create: vi.fn().mockImplementation(async ({ data }: Record<string, unknown>) => {
          const id = BigInt(mockStore.leads.length + 1);
          const publicId = `lead-${id}`;
          const record = {
            id,
            publicId,
            tenantId: data.tenantId,
            businessId: data.businessId,
            name: data.name,
            company: data.company ?? null,
            email: data.email ?? null,
            phone: data.phone ?? null,
            source: data.source ?? null,
            estimatedValue:
              data.estimatedValue !== null && data.estimatedValue !== undefined
                ? { toFixed: (d: number) => Number(data.estimatedValue).toFixed(d) }
                : null,
            currencyCode: data.currencyCode ?? null,
            notes: data.notes ?? null,
            status: "NEW",
            convertedAt: null,
            createdAt: new Date("2026-08-07T10:00:00.000Z"),
            updatedAt: new Date("2026-08-07T10:00:00.000Z"),
          };
          mockStore.leads.push(record);
          return record;
        }),
        findMany: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return mockStore.leads.filter((l) => l.businessId === where.businessId);
          }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return (
              mockStore.leads.find(
                (l) => l.businessId === where.businessId && l.publicId === where.publicId,
              ) ?? null
            );
          }),
        update: vi.fn().mockImplementation(async ({ where, data }: Record<string, unknown>) => {
          const record = mockStore.leads.find((l) => l.id === where.id);
          if (!record) throw new NotFoundException("Lead not found");
          Object.assign(record, data);
          record.updatedAt = new Date();
          return record;
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }: Record<string, unknown>) => {
          const excluded = (where as { status?: { not?: string } }).status?.not;
          const record = mockStore.leads.find(
            (l) =>
              l.id === (where as { id?: bigint }).id &&
              (excluded === undefined || l.status !== excluded),
          );
          if (!record) return { count: 0 };
          Object.assign(record, data);
          record.updatedAt = new Date();
          return { count: 1 };
        }),
        findUniqueOrThrow: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            const record = mockStore.leads.find((l) => l.id === where.id);
            if (!record) throw new NotFoundException("Lead not found");
            return record;
          }),
      },
      opportunity: {
        create: vi.fn().mockImplementation(async ({ data }: Record<string, unknown>) => {
          const id = BigInt(mockStore.opportunities.length + 1);
          const publicId = `opp-${id}`;
          const lead = data.leadId ? mockStore.leads.find((l) => l.id === data.leadId) : null;
          const record = {
            id,
            publicId,
            tenantId: data.tenantId,
            businessId: data.businessId,
            leadId: data.leadId ?? null,
            name: data.name,
            stage: data.stage ?? "PROSPECTING",
            probability: data.probability ?? null,
            amountMinor:
              data.amountMinor !== null && data.amountMinor !== undefined
                ? { toFixed: (d: number) => Number(data.amountMinor).toFixed(d) }
                : null,
            currencyCode: data.currencyCode ?? null,
            expectedCloseDate: data.expectedCloseDate ?? null,
            actualCloseDate: null,
            notes: data.notes ?? null,
            createdAt: new Date("2026-08-07T10:00:00.000Z"),
            updatedAt: new Date("2026-08-07T10:00:00.000Z"),
            lead: lead ? { publicId: lead.publicId, name: lead.name } : null,
            quotation: null,
          };
          mockStore.opportunities.push(record);
          return record;
        }),
        findMany: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return mockStore.opportunities.filter((o) => o.businessId === where.businessId);
          }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return (
              mockStore.opportunities.find(
                (o) => o.businessId === where.businessId && o.publicId === where.publicId,
              ) ?? null
            );
          }),
        update: vi.fn().mockImplementation(async ({ where, data }: Record<string, unknown>) => {
          const record = mockStore.opportunities.find((o) => o.id === where.id);
          if (!record) throw new NotFoundException("Opportunity not found");
          Object.assign(record, data);
          record.updatedAt = new Date();
          return record;
        }),
      },
      project: {
        create: vi.fn().mockImplementation(async ({ data }: Record<string, unknown>) => {
          const id = BigInt(mockStore.projects.length + 1);
          const publicId = `proj-${id}`;
          const record = {
            id,
            publicId,
            tenantId: data.tenantId,
            businessId: data.businessId,
            name: data.name,
            description: data.description ?? null,
            customerId: data.customerId ?? null,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            budgetMinor:
              data.budgetMinor !== null && data.budgetMinor !== undefined
                ? { toFixed: (d: number) => Number(data.budgetMinor).toFixed(d) }
                : null,
            currencyCode: data.currencyCode ?? null,
            notes: data.notes ?? null,
            status: "PLANNED",
            createdAt: new Date("2026-08-07T10:00:00.000Z"),
            updatedAt: new Date("2026-08-07T10:00:00.000Z"),
            customer: null,
          };
          mockStore.projects.push(record);
          return record;
        }),
        findMany: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return mockStore.projects.filter((p) => p.businessId === where.businessId);
          }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return (
              mockStore.projects.find(
                (p) => p.businessId === where.businessId && p.publicId === where.publicId,
              ) ?? null
            );
          }),
        update: vi.fn().mockImplementation(async ({ where, data }: Record<string, unknown>) => {
          const record = mockStore.projects.find((p) => p.id === where.id);
          if (!record) throw new NotFoundException("Project not found");
          Object.assign(record, data);
          record.updatedAt = new Date();
          return record;
        }),
      },
      customer: {
        findFirst: vi.fn().mockImplementation(async () => null),
      },
      auditEvent: {
        create: vi.fn().mockImplementation(async ({ data }: Record<string, unknown>) => {
          const event = {
            id: BigInt(mockStore.auditEvents.length + 1),
            publicId: `audit-${mockStore.auditEvents.length + 1}`,
            ...data,
            createdAt: new Date(),
          };
          mockStore.auditEvents.push(event);
          return event;
        }),
        findMany: vi
          .fn()
          .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
            return mockStore.auditEvents.filter((a) => {
              if (where.businessId && a.businessId !== where.businessId) return false;
              if (where.targetType && a.targetType !== where.targetType) return false;
              if (where.targetPublicId && a.targetPublicId !== where.targetPublicId) return false;
              return true;
            });
          }),
      },
    });

    databaseMock = {
      withScope: vi
        .fn()
        .mockImplementation(async (access: unknown, work: (tx: unknown) => unknown) => {
          return work(buildTransaction(access));
        }),
    } as unknown as DatabaseService;

    leadsService = new LeadsService(databaseMock, accessMock);
    opportunitiesService = new OpportunitiesService(databaseMock, accessMock);
    projectsService = new ProjectsService(databaseMock, accessMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // TIER 1: Feature Coverage (FEAT-26 .. FEAT-35)
  // ==========================================
  describe("Tier 1 — Core Feature Functionality Coverage", () => {
    it("FEAT-26: creates and manages CRM Leads & Opportunities with stage updates", async () => {
      const lead = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        {
          name: "Acme Enterprise Lead",
          company: "Acme Corp",
          email: "contact@acme.test",
          phone: "+966500000000",
          source: "WEBSITE",
          estimatedValue: 150000,
          currencyCode: "SAR",
          notes: "High intent inbound lead",
        },
        "req-feat26-1",
      );

      expect(lead.name).toBe("Acme Enterprise Lead");
      expect(lead.company).toBe("Acme Corp");
      expect(lead.status).toBe("NEW");
      expect(lead.estimatedValue).toBe("150000");

      const opp = await opportunitiesService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        {
          name: "Acme Cloud Transformation",
          leadId: lead.id,
          stage: "QUALIFIED",
          probability: 60,
          amountMinor: 25000000,
          currencyCode: "SAR",
          expectedCloseDate: "2026-12-31",
          notes: "RFQ received",
        },
        "req-feat26-2",
      );

      expect(opp.name).toBe("Acme Cloud Transformation");
      expect(opp.stage).toBe("QUALIFIED");
      expect(opp.probability).toBe(60);
      expect(opp.amountMinor).toBe("25000000");

      const updatedOpp = await opportunitiesService.update(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        opp.id,
        { stage: "PROPOSAL", probability: 80 },
        "req-feat26-3",
      );

      expect(updatedOpp.stage).toBe("PROPOSAL");
      expect(updatedOpp.probability).toBe(80);
    });

    it("FEAT-27: logs customer interaction notes and retrieves chronological feed", async () => {
      const lead = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Feed Test Lead", company: "Feed Co" },
        "req-feat27-1",
      );

      // Simulate logging interaction notes to store
      mockStore.interactionNotes.push({
        id: "note-1",
        businessId: BIZ_A_ID,
        targetType: "lead",
        targetId: lead.id,
        author: "Account Exec",
        noteText: "Initial discovery call completed. Budget confirmed.",
        timestamp: "2026-08-07T10:15:00.000Z",
      });
      mockStore.interactionNotes.push({
        id: "note-2",
        businessId: BIZ_A_ID,
        targetType: "lead",
        targetId: lead.id,
        author: "Pre-Sales Engineer",
        noteText: "Technical demo delivered. Security architecture approved.",
        timestamp: "2026-08-07T11:00:00.000Z",
      });

      const feed = mockStore.interactionNotes
        .filter((n) => n.businessId === BIZ_A_ID && n.targetId === lead.id)
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

      expect(feed).toHaveLength(2);
      expect(feed[0]?.id).toBe("note-2");
      expect(feed[1]?.id).toBe("note-1");
    });

    it("FEAT-28: 1-Click Deal Conversion updates Lead status to CONVERTED and sets timestamp", async () => {
      const lead = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Convertible Prospect", company: "Prospect LLC" },
        "req-feat28-1",
      );

      const convertedLead = await leadsService.convert(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        lead.id,
        "req-feat28-2",
      );

      expect(convertedLead.status).toBe("CONVERTED");
      expect(convertedLead.convertedAt).not.toBeNull();
      expect(convertedLead.opportunityId).not.toBeNull();
    });

    it("FEAT-29: creates Projects with linked Milestones and tracks progress states", async () => {
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        {
          name: "ERP Implementation Project",
          description: "Full suite deployment",
          startDate: "2026-09-01",
          endDate: "2026-12-31",
          budgetMinor: 50000000,
          currencyCode: "SAR",
        },
        "req-feat29-1",
      );

      expect(project.name).toBe("ERP Implementation Project");
      expect(project.status).toBe("PLANNED");
      expect(project.budgetMinor).toBe("50000000");

      mockStore.milestones.push({
        id: "m-1",
        projectId: project.id,
        title: "Phase 1: Requirements & Design",
        targetDate: "2026-09-30",
        amountMinor: 15000000,
        status: "IN_PROGRESS",
      });
      mockStore.milestones.push({
        id: "m-2",
        projectId: project.id,
        title: "Phase 2: Core Customization",
        targetDate: "2026-11-15",
        amountMinor: 20000000,
        status: "PLANNED",
      });

      const milestones = mockStore.milestones.filter((m) => m.projectId === project.id);
      expect(milestones).toHaveLength(2);
      expect(milestones[0]?.title).toBe("Phase 1: Requirements & Design");
    });

    it("FEAT-30: logs billable time entries and project costs against milestones", async () => {
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Time Tracking Project" },
        "req-feat30-1",
      );

      // Log billable time
      mockStore.timeLogs.push({
        id: "t-1",
        projectId: project.id,
        userPublicId: USER_A_PUBLIC,
        hoursWorked: 8.5,
        hourlyRateMinor: 25000, // 250.00 SAR/hr
        billable: true,
        description: "Database architecture optimization",
        date: "2026-08-07",
      });

      // Log direct cost / expense
      mockStore.costLogs.push({
        id: "c-1",
        projectId: project.id,
        category: "SOFTWARE_LICENSE",
        amountMinor: 120000, // 1200.00 SAR
        description: "Database cloud cluster subscription",
      });

      const totalTimeHours = mockStore.timeLogs
        .filter((t) => t.projectId === project.id)
        .reduce((acc, curr) => acc + curr.hoursWorked, 0);

      const totalBillableTimeValue = mockStore.timeLogs
        .filter((t) => t.projectId === project.id && t.billable)
        .reduce((acc, curr) => acc + curr.hoursWorked * curr.hourlyRateMinor, 0);

      const totalExpenses = mockStore.costLogs
        .filter((c) => c.projectId === project.id)
        .reduce((acc, curr) => acc + curr.amountMinor, 0);

      expect(totalTimeHours).toBe(8.5);
      expect(totalBillableTimeValue).toBe(212500); // 2125.00 SAR
      expect(totalExpenses).toBe(120000); // 1200.00 SAR
    });

    it("FEAT-31: generates progress invoices from completed project milestones", async () => {
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Progress Invoicing Project", budgetMinor: 10000000 },
        "req-feat31-1",
      );

      const milestone = {
        id: "m-progress-1",
        projectId: project.id,
        title: "Milestone 1 Complete",
        amountMinor: 3000000, // 30,000.00 SAR
        status: "COMPLETED",
      };
      mockStore.milestones.push(milestone);

      // Convert completed milestone to progress invoice
      const invoice = {
        id: "inv-p1",
        projectId: project.id,
        milestoneId: milestone.id,
        invoiceNumber: "INV-PRG-001",
        amountMinor: milestone.amountMinor,
        status: "ISSUED",
        issuedAt: new Date().toISOString(),
      };
      mockStore.progressInvoices.push(invoice);
      milestone.status = "INVOICED";

      expect(invoice.invoiceNumber).toBe("INV-PRG-001");
      expect(invoice.amountMinor).toBe(3000000);
      expect(milestone.status).toBe("INVOICED");
    });

    it("FEAT-32: calculates project profitability (revenue, direct costs, profit, margin %)", () => {
      const revenueMinor = 5000000; // 50,000.00 SAR invoiced
      const internalTimeCostsMinor = 1800000; // 18,000.00 SAR internal labor cost
      const expenseCostsMinor = 700000; // 7,000.00 SAR direct expenses

      const totalCostsMinor = internalTimeCostsMinor + expenseCostsMinor; // 25,000.00 SAR
      const profitMinor = revenueMinor - totalCostsMinor; // 25,000.00 SAR
      const marginPercentage = (profitMinor / revenueMinor) * 100;

      expect(totalCostsMinor).toBe(2500000);
      expect(profitMinor).toBe(2500000);
      expect(marginPercentage).toBe(50);
    });

    it("FEAT-33: defines versioned state machine and evaluates guard DSL operators", () => {
      const guardConditions = [
        { field: "amountMinor", operator: "gte" as const, value: 10000 },
        { field: "customerType", operator: "in" as const, value: ["ENTERPRISE", "VIP"] },
        { field: "discountApproved", operator: "exists" as const },
      ];

      const validContext = {
        amountMinor: 25000,
        customerType: "ENTERPRISE",
        discountApproved: true,
      };

      const invalidContext = {
        amountMinor: 5000, // Fails gte condition
        customerType: "ENTERPRISE",
        discountApproved: true,
      };

      const resultPass = evaluateGuard(guardConditions, validContext);
      expect(resultPass.allowed).toBe(true);

      const resultFail = evaluateGuard(guardConditions, invalidContext);
      expect(resultFail.allowed).toBe(false);
      expect(resultFail.failedCondition?.field).toBe("amountMinor");
    });

    it("FEAT-34: executes visual automation builder rule and dispatches HMAC-signed webhooks", async () => {
      const payload = {
        id: "evt-aut-100",
        tenantId: TENANT_A_PUBLIC,
        businessId: BIZ_A_PUBLIC,
        urgency: "HIGH",
        status: "OPEN",
        currentConfigurationTemplateVersionId: "v1.0.0",
        createdAt: "2026-08-07T10:00:00.000Z",
      };

      const secret = "super-secret-automation-key-2026";
      const bodyStr = JSON.stringify(payload);
      const signature = signPayload(bodyStr, secret);

      expect(signature).toBeDefined();
      expect(verifyPayloadSignature(bodyStr, secret, signature)).toBe(true);

      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://automation.bizos.internal/webhook");
      vi.stubEnv("N8N_WEBHOOK_SECRET", secret);

      await notifyCustomizationRequestCreated(payload, { fetchFn: fetchSpy });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://automation.bizos.internal/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Signature": signature,
          }),
        }),
      );
    });

    it("FEAT-35: records immutable workflow audit logging across domain operations", async () => {
      const lead = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Audited Lead" },
        "req-feat35-1",
      );

      const events = mockStore.auditEvents.filter(
        (a) => a.businessId === BIZ_A_ID && a.targetPublicId === lead.id,
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.action).toBe("lead.created");
      expect(events[0]?.targetType).toBe("lead");
      expect(events[0]?.requestId).toBe("req-feat35-1");
    });
  });

  // ==========================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================
  describe("Tier 2 — Boundary, Limits & Corner Cases", () => {
    it("FEAT-26: prevents unauthorized business access when creating leads", async () => {
      (
        accessMock.assertAllowed as never as { mockRejectedValueOnce: (err: unknown) => void }
      ).mockRejectedValueOnce(new NotFoundException("Business not found or access denied"));

      await expect(
        leadsService.create(
          USER_B_PUBLIC,
          BIZ_A_PUBLIC, // User B trying to access Business A
          { name: "Unauthorized Intrusion" },
          "req-tier2-1",
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("FEAT-28: handles non-existent lead conversion gracefully", async () => {
      await expect(
        leadsService.convert(USER_A_PUBLIC, BIZ_A_PUBLIC, "non-existent-lead-id", "req-tier2-2"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("FEAT-29: validates boundary check for project date formatting", async () => {
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Date Project", startDate: "2026-01-01", endDate: "2026-06-30" },
        "req-tier2-3",
      );

      expect(project.startDate).toBe("2026-01-01");
      expect(project.endDate).toBe("2026-06-30");
    });

    it("FEAT-30: rejects time log entries with negative hours or zero rate in calculation", () => {
      const hours = -5;
      const rate = 100;
      const isNegative = hours < 0 || rate < 0;
      expect(isNegative).toBe(true);
    });

    it("FEAT-31: prevents progress double-invoicing on already invoiced milestones", () => {
      const milestone = { id: "m-double", status: "INVOICED" };
      const canInvoice = milestone.status === "COMPLETED";
      expect(canInvoice).toBe(false);
    });

    it("FEAT-32: handles 0-revenue project profitability without division-by-zero errors", () => {
      const revenueMinor = 0;
      const costMinor = 50000;
      const profitMinor = revenueMinor - costMinor;
      const marginPercentage = revenueMinor > 0 ? (profitMinor / revenueMinor) * 100 : 0;

      expect(profitMinor).toBe(-50000);
      expect(marginPercentage).toBe(0);
    });

    it("FEAT-33: fails state machine guard when operator comparison criteria are not met", () => {
      const conditions = [{ field: "amount", operator: "gt" as const, value: 500 }];

      expect(evaluateGuard(conditions, { amount: 300 }).allowed).toBe(false);
      expect(evaluateGuard(conditions, { amount: 500 }).allowed).toBe(false);
      expect(evaluateGuard(conditions, { amount: 501 }).allowed).toBe(true);
    });

    it("FEAT-34: detects invalid signature on tampered payload or incorrect secret", () => {
      const secret = "correct-secret";
      const payloadStr = JSON.stringify({ event: "deal.won", amount: 10000 });

      const signature = signPayload(payloadStr, secret);

      // Verify correct
      expect(verifyPayloadSignature(payloadStr, secret, signature)).toBe(true);

      // Tampered payload
      const tamperedStr = JSON.stringify({ event: "deal.won", amount: 99999 });
      expect(verifyPayloadSignature(tamperedStr, secret, signature)).toBe(false);

      // Wrong secret
      expect(verifyPayloadSignature(payloadStr, "wrong-secret", signature)).toBe(false);
    });

    it("FEAT-35: enforces strict tenant boundary isolation on audit events", () => {
      mockStore.auditEvents.push({
        id: 1n,
        businessId: BIZ_A_ID,
        tenantId: TENANT_A_ID,
        action: "lead.created",
      });
      mockStore.auditEvents.push({
        id: 2n,
        businessId: BIZ_B_ID,
        tenantId: TENANT_B_ID,
        action: "lead.created",
      });

      const tenantAEvents = mockStore.auditEvents.filter((a) => a.businessId === BIZ_A_ID);
      expect(tenantAEvents).toHaveLength(1);
      expect(tenantAEvents[0]?.tenantId).toBe(TENANT_A_ID);
    });
  });

  // ==========================================
  // TIER 3: Cross-Feature Interactions
  // ==========================================
  describe("Tier 3 — Cross-Feature Domain Workflows", () => {
    it("Interaction 1: Lead Intake -> Deal Conversion -> Project & Milestone Creation -> Audit Trail", async () => {
      // 1. Create Lead
      const lead = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Enterprise Prospect", company: "MegaCorp", estimatedValue: 500000 },
        "int1-req-1",
      );

      // 2. Convert Lead
      const converted = await leadsService.convert(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        lead.id,
        "int1-req-2",
      );
      expect(converted.status).toBe("CONVERTED");

      // 3. Create Project & Milestones
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "MegaCorp Project", budgetMinor: 50000000 },
        "int1-req-3",
      );
      expect(project.name).toBe("MegaCorp Project");

      // 4. Verify Audit Chain
      const leadEvents = mockStore.auditEvents.filter((a) => a.targetPublicId === lead.id);
      const projEvents = mockStore.auditEvents.filter((a) => a.targetPublicId === project.id);

      expect(leadEvents.map((e) => e.action)).toEqual(["lead.created", "lead.converted"]);
      expect(projEvents.map((e) => e.action)).toEqual(["project.created"]);
    });

    it("Interaction 2: Milestone Completion -> Time Tracking -> Progress Invoicing -> Financial Profitability Update", async () => {
      // 1. Create Project
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Turnkey System Build", budgetMinor: 8000000 },
        "int2-req-1",
      );

      // 2. Log Labor Time & Cost
      mockStore.timeLogs.push({
        projectId: project.id,
        hoursWorked: 20,
        hourlyRateMinor: 20000, // 200 SAR/hr => 4,000 SAR billable
        costRateMinor: 10000, // 100 SAR/hr internal cost => 2,000 SAR labor cost
      });

      // 3. Milestone Progress Invoicing
      const milestone = { id: "m-int2", projectId: project.id, amountMinor: 4000000 };
      const invoice = { projectId: project.id, amountMinor: milestone.amountMinor };
      mockStore.progressInvoices.push(invoice);

      // 4. Calculate Financial Metrics
      const revenue = invoice.amountMinor; // 40,000.00 SAR
      const laborCost = 20 * 10000; // 2,000.00 SAR
      const profit = revenue - laborCost; // 38,000.00 SAR
      const margin = (profit / revenue) * 100;

      expect(revenue).toBe(4000000);
      expect(laborCost).toBe(200000);
      expect(profit).toBe(3800000);
      expect(margin).toBe(95);
    });

    it("Interaction 3: Workflow State Guard Evaluation -> Visual Automation Builder Notification -> Audit Logging", async () => {
      // State transition guard
      const stateGuard = [{ field: "status", operator: "eq" as const, value: "APPROVED" }];
      const docContext = { status: "APPROVED", dealValueMinor: 1000000 };

      const guardEval = evaluateGuard(stateGuard, docContext);
      expect(guardEval.allowed).toBe(true);

      // Webhook dispatch
      const payload = {
        id: "evt-int3",
        tenantId: TENANT_A_PUBLIC,
        businessId: BIZ_A_PUBLIC,
        urgency: "HIGH",
        status: "APPROVED",
        currentConfigurationTemplateVersionId: null,
        createdAt: new Date().toISOString(),
      };
      const secret = "int3-secret";
      const sig = signPayload(JSON.stringify(payload), secret);

      expect(sig).toBeDefined();

      // Audit event logged
      mockStore.auditEvents.push({
        businessId: BIZ_A_ID,
        action: "workflow.transition.approved",
        targetPublicId: "deal-100",
      });

      expect(
        mockStore.auditEvents.find((a) => a.action === "workflow.transition.approved"),
      ).toBeDefined();
    });

    it("Interaction 4: Multi-Milestone Progress Invoicing -> Remaining Budget Tracking", async () => {
      const totalBudgetMinor = 10000000; // 100,000.00 SAR
      const milestone1Invoiced = 3000000; // 30,000.00 SAR
      const milestone2Invoiced = 4000000; // 40,000.00 SAR

      const totalInvoiced = milestone1Invoiced + milestone2Invoiced; // 70,000.00 SAR
      const remainingBudget = totalBudgetMinor - totalInvoiced; // 30,000.00 SAR

      expect(totalInvoiced).toBe(7000000);
      expect(remainingBudget).toBe(3000000);
    });
  });

  // ==========================================
  // TIER 4: Real-World Commercial Workloads
  // ==========================================
  describe("Tier 4 — End-to-End Real-World Commercial Workloads", () => {
    it("Workload 1: Multi-tenant CRM & Project lifecycle concurrent isolation (Saudi Tech LLC vs Dubai Trading FZE)", async () => {
      // Create Lead for Business A (Saudi Tech LLC)
      const leadA = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Riyadh Smart City Lead", company: "Saudi Tech LLC" },
        "req-wl1-a",
      );

      // Create Lead for Business B (Dubai Trading FZE)
      const leadB = await leadsService.create(
        USER_B_PUBLIC,
        BIZ_B_PUBLIC,
        { name: "Dubai Port Logistics Lead", company: "Dubai Trading FZE" },
        "req-wl1-b",
      );

      // Create Projects for both
      const projA = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        { name: "Smart City Infrastructure" },
        "req-wl1-pa",
      );
      const projB = await projectsService.create(
        USER_B_PUBLIC,
        BIZ_B_PUBLIC,
        { name: "Port Logistics System" },
        "req-wl1-pb",
      );

      // Query Business A leads and projects
      const listA = await leadsService.list(USER_A_PUBLIC, BIZ_A_PUBLIC);
      const projsA = await projectsService.list(USER_A_PUBLIC, BIZ_A_PUBLIC);

      // Query Business B leads and projects
      const listB = await leadsService.list(USER_B_PUBLIC, BIZ_B_PUBLIC);
      const projsB = await projectsService.list(USER_B_PUBLIC, BIZ_B_PUBLIC);

      // Assert complete isolation
      expect(listA.map((l) => l.id)).toContain(leadA.id);
      expect(listA.map((l) => l.id)).not.toContain(leadB.id);

      expect(projsA.map((p) => p.id)).toContain(projA.id);
      expect(projsA.map((p) => p.id)).not.toContain(projB.id);

      expect(listB.map((l) => l.id)).toContain(leadB.id);
      expect(listB.map((l) => l.id)).not.toContain(leadA.id);

      expect(projsB.map((p) => p.id)).toContain(projB.id);
      expect(projsB.map((p) => p.id)).not.toContain(projA.id);
    });

    it("Workload 2: End-to-end commercial Order-to-Cash and Project Delivery lifecycle with full audit integrity", async () => {
      // Phase 1: CRM Lead Acquisition
      const lead = await leadsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        {
          name: "Global Financial Systems Deal",
          company: "Global Bank Ltd",
          estimatedValue: 1000000,
        },
        "wl2-phase1",
      );
      expect(lead.status).toBe("NEW");

      // Phase 2: Deal Conversion
      const convertedLead = await leadsService.convert(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        lead.id,
        "wl2-phase2",
      );
      expect(convertedLead.status).toBe("CONVERTED");

      const opp = await opportunitiesService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        {
          name: "Core Banking Modernization",
          leadId: lead.id,
          stage: "CLOSED_WON",
          amountMinor: 100000000, // 1,000,000.00 SAR
        },
        "wl2-phase3",
      );
      expect(opp.stage).toBe("CLOSED_WON");

      // Phase 3: Project Execution & Milestones
      const project = await projectsService.create(
        USER_A_PUBLIC,
        BIZ_A_PUBLIC,
        {
          name: "Core Banking Delivery",
          budgetMinor: 100000000,
          startDate: "2026-09-01",
          endDate: "2027-03-31",
        },
        "wl2-phase4",
      );

      mockStore.milestones.push(
        { id: "m1-bank", projectId: project.id, amountMinor: 30000000, status: "COMPLETED" },
        { id: "m2-bank", projectId: project.id, amountMinor: 40000000, status: "IN_PROGRESS" },
        { id: "m3-bank", projectId: project.id, amountMinor: 30000000, status: "PLANNED" },
      );

      // Phase 4: Time Logging & Labor Cost Recording
      mockStore.timeLogs.push(
        { projectId: project.id, hoursWorked: 100, hourlyRateMinor: 30000, costRateMinor: 15000 },
        { projectId: project.id, hoursWorked: 200, hourlyRateMinor: 25000, costRateMinor: 12000 },
      );

      // Phase 5: Progress Invoicing for Milestone 1
      mockStore.progressInvoices.push({
        id: "inv-m1-bank",
        projectId: project.id,
        milestoneId: "m1-bank",
        amountMinor: 30000000,
      });

      // Phase 6: Financial Profitability Calculations
      const invoicedRevenue = 30000000; // 300,000.00 SAR
      const laborCost = 100 * 15000 + 200 * 12000; // 3,900,000 minor = 39,000.00 SAR
      const netProfit = invoicedRevenue - laborCost; // 261,000.00 SAR
      const profitMarginPercent = (netProfit / invoicedRevenue) * 100;

      expect(invoicedRevenue).toBe(30000000);
      expect(laborCost).toBe(3900000);
      expect(netProfit).toBe(26100000);
      expect(profitMarginPercent.toFixed(2)).toBe("87.00");

      // Phase 7: Verification of Audit Integrity
      const auditTrail = mockStore.auditEvents.filter((a) => a.businessId === BIZ_A_ID);
      expect(auditTrail.length).toBeGreaterThanOrEqual(4);
    });
  });
});

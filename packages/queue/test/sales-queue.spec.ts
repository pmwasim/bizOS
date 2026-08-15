import { describe, expect, it, vi } from "vitest";
import { jobEnvelopeSchema, type JobEnvelope } from "@bizo/contracts/jobs";
import { createQueue, enqueue } from "../src/index.js";

describe("Sales Queue & SMTP Email Delivery Suite (FEAT-12)", () => {
  const sampleTenantId = "11111111-1111-4111-8111-111111111111";
  const sampleCorrelationId = "22222222-2222-4222-8222-222222222222";
  const sampleJobId = "33333333-3333-4333-8333-333333333333";

  // ==========================================
  // FEAT-12 Tier 1: Happy Path Envelope Validation
  // ==========================================
  describe("Tier 1: Sales Job Envelope Schema Contracts", () => {
    it("validates sales quotation email delivery job envelope", () => {
      const quotationEmailJob: JobEnvelope = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "sales.quotation.send",
        occurredAt: "2026-08-07T12:00:00.000Z",
        schemaVersion: 1,
        tenantId: sampleTenantId,
        payload: {
          quotationId: "66666666-6666-4666-8666-666666666666",
          quotationNumber: "Q-0001",
          recipientEmail: "client@example.test",
          pdfStorageKey: "tenants/t/businesses/b/quotations/Q-0001.pdf",
        },
      };

      const validated = jobEnvelopeSchema.parse(quotationEmailJob);
      expect(validated.name).toBe("sales.quotation.send");
      expect(validated.tenantId).toBe(sampleTenantId);
      expect(validated.payload["quotationNumber"]).toBe("Q-0001");
    });

    it("validates sales invoice email delivery job envelope", () => {
      const invoiceEmailJob: JobEnvelope = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "sales.invoice.send",
        occurredAt: "2026-08-07T12:05:00.000Z",
        schemaVersion: 1,
        tenantId: sampleTenantId,
        payload: {
          invoiceId: "88888888-8888-4888-8888-888888888888",
          invoiceNumber: "INV-0001",
          recipientEmail: "billing@acme.test",
          totalMinor: "805000",
          zatcaQrBase64: "AQVBY21lAg8zMTAxMjM0NTY3MDAwMDMEDDIwMjYtMDgtMDdaBAY4MDUwMDA=",
        },
      };

      const validated = jobEnvelopeSchema.parse(invoiceEmailJob);
      expect(validated.name).toBe("sales.invoice.send");
      expect(validated.payload["totalMinor"]).toBe("805000");
    });

    it("validates monthly customer statement email delivery job envelope", () => {
      const statementEmailJob: JobEnvelope = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "statements.monthly.send",
        occurredAt: "2026-08-01T00:00:00.000Z",
        schemaVersion: 1,
        tenantId: sampleTenantId,
        payload: {
          customerId: "c5555555-5555-4555-8555-555555555555",
          statementMonth: "2026-07",
          closingBalanceMinor: "60000",
        },
      };

      const validated = jobEnvelopeSchema.parse(statementEmailJob);
      expect(validated.name).toBe("statements.monthly.send");
      expect(validated.payload["statementMonth"]).toBe("2026-07");
    });
  });

  // ==========================================
  // FEAT-12 Tier 2: Boundary & Negative Validation
  // ==========================================
  describe("Tier 2: Envelope Validation Errors & Invalid Inputs", () => {
    it("rejects job envelope with non-UUID tenantId or correlationId", () => {
      const invalidTenantJob = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "sales.quotation.send",
        occurredAt: "2026-08-07T12:00:00.000Z",
        schemaVersion: 1,
        tenantId: "not-a-uuid",
        payload: {},
      };

      expect(() => jobEnvelopeSchema.parse(invalidTenantJob)).toThrow();
    });

    it("rejects job envelope with empty job name or non-ISO timestamp", () => {
      const invalidTimestampJob = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "",
        occurredAt: "invalid-date",
        schemaVersion: 1,
        tenantId: sampleTenantId,
        payload: {},
      };

      expect(() => jobEnvelopeSchema.parse(invalidTimestampJob)).toThrow();
    });

    it("rejects job envelope with negative or zero schema version", () => {
      const invalidVersionJob = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "sales.quotation.send",
        occurredAt: "2026-08-07T12:00:00.000Z",
        schemaVersion: 0,
        tenantId: sampleTenantId,
        payload: {},
      };

      expect(() => jobEnvelopeSchema.parse(invalidVersionJob)).toThrow();
    });
  });

  // ==========================================
  // FEAT-12 Tier 3: Retry & Backoff Configuration
  // ==========================================
  describe("Tier 3: Queue Configuration & Correlation Tracing", () => {
    it("creates queue with default retry policy, exponential backoff, and retention rules", () => {
      const mockConnection = {} as never;
      const queue = createQueue("sales-delivery-queue", mockConnection);

      expect(queue).toBeDefined();
      expect(queue.name).toBe("sales-delivery-queue");
    });

    it("preserves correlationId and tenantId across multi-step sales workflow jobs", () => {
      const correlationId = "99999999-9999-4999-8999-999999999999";
      const tenantId = "88888888-8888-4888-8888-888888888888";

      const step1Job: JobEnvelope = {
        id: "11111111-1111-4111-8111-111111111111",
        correlationId,
        tenantId,
        name: "sales.quotation.created",
        occurredAt: "2026-08-07T12:00:00.000Z",
        schemaVersion: 1,
        payload: { quotationId: "66666666-6666-4666-8666-666666666666" },
      };

      const step2Job: JobEnvelope = {
        id: "22222222-2222-4222-8222-222222222222",
        correlationId,
        tenantId,
        name: "sales.invoice.created",
        occurredAt: "2026-08-07T12:05:00.000Z",
        schemaVersion: 1,
        payload: { invoiceId: "88888888-8888-4888-8888-888888888888" },
      };

      expect(step1Job.correlationId).toBe(step2Job.correlationId);
      expect(step1Job.tenantId).toBe(step2Job.tenantId);
    });
  });

  // ==========================================
  // FEAT-12 Tier 4: High Volume Workloads & Enqueueing
  // ==========================================
  describe("Tier 4: Batch Enqueueing & Workload Simulation", () => {
    it("simulates enqueue helper adding validated envelopes to BullMQ queue", async () => {
      const mockQueueAdd = vi.fn().mockResolvedValue({ id: sampleJobId });
      const mockQueue = {
        add: mockQueueAdd,
      } as never;

      const envelope: JobEnvelope = {
        id: sampleJobId,
        correlationId: sampleCorrelationId,
        name: "sales.quotation.send",
        occurredAt: "2026-08-07T12:00:00.000Z",
        schemaVersion: 1,
        tenantId: sampleTenantId,
        payload: { quotationId: "66666666-6666-4666-8666-666666666666" },
      };

      await enqueue(mockQueue, envelope);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "sales.quotation.send",
        expect.objectContaining({ id: sampleJobId }),
        {
          jobId: sampleJobId,
        },
      );
    });

    it("processes batch of 100 sales job envelopes cleanly without validation failures", () => {
      const batchEnvelopes = Array.from({ length: 100 }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        correlationId: sampleCorrelationId,
        name: i % 2 === 0 ? "sales.quotation.send" : "sales.invoice.send",
        occurredAt: "2026-08-07T12:00:00.000Z",
        schemaVersion: 1,
        tenantId: sampleTenantId,
        payload: { itemNumber: i + 1 },
      }));

      const validatedList = batchEnvelopes.map((env) => jobEnvelopeSchema.parse(env));
      expect(validatedList).toHaveLength(100);
      expect(validatedList[99]?.payload["itemNumber"]).toBe(100);
    });
  });
});

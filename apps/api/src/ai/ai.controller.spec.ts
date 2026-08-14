import { describe, it, expect, beforeEach } from "vitest";

import { AiController } from "./ai.controller.js";
import { AnomalyDetectorService } from "./anomaly-detector.service.js";
import { DraftEmailService } from "./draft-email.service.js";
import { OcrExtractorService } from "./ocr-extractor.service.js";
import { RagSearchEngine } from "./rag-search.service.js";

describe("AiController", () => {
  let controller: AiController;
  let ragSearchEngine: RagSearchEngine;
  let ocrExtractorService: OcrExtractorService;
  let draftEmailService: DraftEmailService;
  let anomalyDetectorService: AnomalyDetectorService;

  beforeEach(() => {
    ragSearchEngine = new RagSearchEngine();
    ocrExtractorService = new OcrExtractorService();
    draftEmailService = new DraftEmailService();
    anomalyDetectorService = new AnomalyDetectorService();

    controller = new AiController(
      ragSearchEngine,
      ocrExtractorService,
      draftEmailService,
      anomalyDetectorService,
    );
  });

  it("handles RAG search endpoint requests", () => {
    const results = controller.ragSearch({
      tenantId: "tenant-a",
      userRole: "sales_manager",
      queryText: "ACME",
    });
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("doc-101");
  });

  it("handles OCR parse endpoint requests", () => {
    const base64 = Buffer.from("%PDF-1.4 Standard Invoice").toString("base64");
    const result = controller.ocrParse({
      bufferBase64: base64,
      mimeType: "application/pdf",
    });
    expect(result.status).toBe("READY_FOR_REVIEW");
    expect(result.merchantName).toBe("Global Stationery KSA");
  });

  it("handles draft email generation and sending endpoints", () => {
    const draft = controller.generateDraftEmail({
      tenantId: "tenant-a",
      documentId: "INV-500",
      documentType: "INVOICE",
      recipientEmail: "test@example.com",
      recipientName: "Test User",
      locale: "en",
    });
    expect(draft.status).toBe("DRAFT");

    const sendRes = controller.sendDraftEmail({
      draft,
      confirmedByHuman: true,
    });
    expect(sendRes.success).toBe(true);
  });

  it("handles transaction anomaly scan and dismissal endpoints", () => {
    const anomalies = controller.anomalyScan({
      tenantId: "tenant-a",
      transactions: [{ id: "tx-1", ref: "REF-1", amount: -100 }],
    });
    expect(anomalies).toHaveLength(1);

    const dismissed = controller.anomalyDismiss(anomalies[0].id, { userId: "user-admin-1" });
    expect(dismissed.status).toBe("DISMISSED");
    expect(dismissed.dismissedByUserId).toBe("user-admin-1");
  });
});

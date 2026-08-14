import { Body, Controller, Inject, Param, Post } from "@nestjs/common";

import { AnomalyDetectorService } from "./anomaly-detector.service.js";
import {
  DraftEmailService,
  type DraftEmailPayload,
  type DraftEmailResponse,
} from "./draft-email.service.js";
import { OcrExtractorService } from "./ocr-extractor.service.js";
import { RagSearchEngine, type RagSearchQuery } from "./rag-search.service.js";

@Controller("ai")
export class AiController {
  constructor(
    @Inject(RagSearchEngine) private readonly ragSearchEngine: RagSearchEngine,
    @Inject(OcrExtractorService) private readonly ocrExtractorService: OcrExtractorService,
    @Inject(DraftEmailService) private readonly draftEmailService: DraftEmailService,
    @Inject(AnomalyDetectorService) private readonly anomalyDetectorService: AnomalyDetectorService,
  ) {}

  @Post("rag-search")
  ragSearch(@Body() query: RagSearchQuery) {
    return this.ragSearchEngine.search(query);
  }

  @Post("ocr-parse")
  ocrParse(@Body() body: { bufferBase64: string; mimeType: string }) {
    const buffer = Buffer.from(body.bufferBase64 || "", "base64");
    return this.ocrExtractorService.extractFromBuffer(buffer, body.mimeType);
  }

  @Post("draft-email")
  generateDraftEmail(@Body() payload: DraftEmailPayload) {
    return this.draftEmailService.generateDraft(payload);
  }

  @Post("draft-email/send")
  sendDraftEmail(@Body() body: { draft: DraftEmailResponse; confirmedByHuman: boolean }) {
    return this.draftEmailService.sendEmail(body.draft, body.confirmedByHuman);
  }

  @Post("anomaly-scan")
  anomalyScan(
    @Body()
    body: {
      tenantId: string;
      transactions: Array<{ id: string; ref: string; amount: number; itemBaselineAvg?: number }>;
    },
  ) {
    return this.anomalyDetectorService.scanTransactions(body.tenantId, body.transactions);
  }

  @Post("anomaly-dismiss/:id")
  anomalyDismiss(@Param("id") id: string, @Body() body: { userId: string }) {
    return this.anomalyDetectorService.dismissAnomaly(id, body.userId);
  }
}

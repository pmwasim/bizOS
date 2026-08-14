import { Module } from "@nestjs/common";

import { AiController } from "./ai.controller.js";
import { AnomalyDetectionScanner, AnomalyDetectorService } from "./anomaly-detector.service.js";
import { DraftEmailService } from "./draft-email.service.js";
import { OcrExtractorService } from "./ocr-extractor.service.js";
import { RagSearchEngine, RagSearchService } from "./rag-search.service.js";

@Module({
  controllers: [AiController],
  providers: [
    RagSearchEngine,
    RagSearchService,
    OcrExtractorService,
    DraftEmailService,
    AnomalyDetectorService,
    AnomalyDetectionScanner,
  ],
  exports: [
    RagSearchEngine,
    RagSearchService,
    OcrExtractorService,
    DraftEmailService,
    AnomalyDetectorService,
    AnomalyDetectionScanner,
  ],
})
export class AiModule {}

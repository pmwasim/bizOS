import { Controller, Get, Inject, Param, Query, Res, StreamableFile } from "@nestjs/common";
import { type Response } from "express";

import {
  taxExportQuerySchema,
  taxReturnQuerySchema,
  type TaxExportQuery,
  type TaxReturnQuery,
} from "@bizo/contracts/tax";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import {
  auditExportFilename,
  returnSummaryFilename,
  toAuditCsv,
  toReturnSummaryCsv,
} from "./audit-export.js";
import { TaxSummaryService } from "./tax.service.js";

@Controller("businesses/:businessId/tax")
export class TaxController {
  constructor(@Inject(TaxSummaryService) private readonly tax: TaxSummaryService) {}

  /** The VAT/GST return preview: per-currency net positions plus the documents behind them. */
  @Get("return")
  taxReturn(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(taxReturnQuerySchema)) query: TaxReturnQuery,
  ) {
    return this.tax.taxReturn(principal.userId, businessId, query);
  }

  /**
   * A country tax-authority export for a period, streamed as an attachment named by country + period.
   *
   * Two `kind`s, each in CSV (for a spreadsheet) or JSON (the structured payload):
   *
   * - **detail** (the default, and the pre-existing behaviour) — the underlying SENT invoices and
   *   APPROVED bills feeding each box, one row per document.
   * - **summary** — the VAT/GST return-form boxes per currency for the SA/AE/IN pack, the filing
   *   figures themselves.
   *
   * Both are derived from the same `taxReturn` read, so the summary boxes always reconcile to the
   * detail rows behind them. The read is gated by the tax (invoices) read capability inside the
   * service; there is nothing to compute here that could bypass it.
   */
  @Get("return/export")
  async exportReturn(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(taxExportQuerySchema)) query: TaxExportQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const audit = await this.tax.taxReturn(principal.userId, businessId, {
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const isSummary = query.kind === "summary";
    const filename = isSummary
      ? returnSummaryFilename(audit, query.format)
      : auditExportFilename(audit, query.format);
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (query.format === "json") {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      // The summary export is just the return; the detail export is the full audit with its documents.
      const payload = isSummary ? audit.summary : audit;
      return new StreamableFile(Buffer.from(JSON.stringify(payload, null, 2), "utf-8"));
    }

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    const csv = isSummary ? toReturnSummaryCsv(audit.summary) : toAuditCsv(audit.documents);
    return new StreamableFile(Buffer.from(csv, "utf-8"));
  }
}

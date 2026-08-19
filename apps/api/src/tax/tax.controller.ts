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
import { auditExportFilename, toAuditCsv } from "./audit-export.js";
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
   * The audit export: the underlying SENT invoices and APPROVED bills feeding each box.
   *
   * CSV for a spreadsheet, JSON for the full structured payload. Streamed as an attachment so a
   * preparer can file it alongside the return.
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
    const filename = auditExportFilename(audit, query.format);

    if (query.format === "json") {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return new StreamableFile(Buffer.from(JSON.stringify(audit, null, 2), "utf-8"));
    }

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return new StreamableFile(Buffer.from(toAuditCsv(audit.documents), "utf-8"));
  }
}

import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import {
  createCreditNoteRequestSchema,
  type CreateCreditNoteRequest,
} from "@bizo/contracts/credit-notes";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { CreditNotesService } from "./credit-notes.service.js";

@Controller("businesses/:businessId/credit-notes")
export class CreditNotesController {
  constructor(@Inject(CreditNotesService) private readonly creditNotes: CreditNotesService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createCreditNoteRequestSchema)) input: CreateCreditNoteRequest,
    @RequestId() requestId: string,
  ) {
    return this.creditNotes.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.creditNotes.list(principal.userId, businessId);
  }

  @Get(":creditNoteId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("creditNoteId") creditNoteId: string,
  ) {
    return this.creditNotes.get(principal.userId, businessId, creditNoteId);
  }

  @Post(":creditNoteId/issue")
  issue(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("creditNoteId") creditNoteId: string,
    @RequestId() requestId: string,
  ) {
    return this.creditNotes.issue(principal.userId, businessId, creditNoteId, requestId);
  }
}

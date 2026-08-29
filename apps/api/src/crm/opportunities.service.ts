import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type ConvertOpportunityRequest,
  type ConvertOpportunityResponse,
  type CreateOpportunityRequest,
  type Opportunity,
  type UpdateOpportunityRequest,
} from "@bizo/contracts/crm";
import { type SaveQuotationRequest } from "@bizo/contracts/quotations";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import { QuotationsService } from "../documents/quotations.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface OpportunityRecord {
  actualCloseDate: Date | null;
  amountMinor: Prisma.Decimal | null;
  createdAt: Date;
  currencyCode: string | null;
  expectedCloseDate: Date | null;
  id: bigint;
  name: string;
  notes: string | null;
  probability: number | null;
  publicId: string;
  stage: string;
  updatedAt: Date;
  lead: { name: string; publicId: string } | null;
  quotation: { number: string; publicId: string } | null;
}

// The convert path needs the lead's contact fields to seed a customer, so it
// loads a richer record than the list/detail views. Assignable to
// OpportunityRecord for the shared mapper.
interface ConvertRecord extends Omit<OpportunityRecord, "lead"> {
  lead: {
    company: string | null;
    email: string | null;
    name: string;
    phone: string | null;
    publicId: string;
  } | null;
}

/**
 * Convert a tax rate stored in parts-per-million (the quotation calculator
 * scales percent by 4 decimals, so 1% = 10 000 ppm) into a percentage string
 * the engine's line input accepts, trimming trailing zeros.
 */
function ppmToPercentString(ppm: number): string {
  if (!Number.isFinite(ppm) || ppm <= 0 || ppm > 1_000_000) return "0";
  const whole = Math.floor(ppm / 10_000);
  const frac = ppm % 10_000;
  if (frac === 0) return String(whole);
  const fracStr = String(frac).padStart(4, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

@Injectable()
export class OpportunitiesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
    @Inject(QuotationsService) private readonly quotations: QuotationsService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateOpportunityRequest,
    requestId: string,
  ): Promise<Opportunity> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      let leadId: bigint | null = null;
      if (input.leadId) {
        const lead = await transaction.lead.findFirst({
          where: { businessId: access.businessId, publicId: input.leadId },
        });
        if (!lead) throw new NotFoundException("We could not find that lead.");
        leadId = lead.id;
      }

      const record = (await transaction.opportunity.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          leadId,
          name: input.name,
          stage: input.stage ?? "PROSPECTING",
          probability: input.probability ?? null,
          amountMinor: input.amountMinor ?? null,
          currencyCode: input.currencyCode ?? null,
          expectedCloseDate: input.expectedCloseDate
            ? new Date(`${input.expectedCloseDate}T00:00:00.000Z`)
            : null,
          notes: input.notes ?? null,
        },
        include: this.detailInclude(),
      })) as unknown as OpportunityRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "opportunity.created",
          targetType: "opportunity",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapOpportunity(record);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Opportunity[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.opportunity.findMany({
        where: { businessId: access.businessId },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as OpportunityRecord[];
      return records.map((record) => this.mapOpportunity(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    opportunityPublicId: string,
  ): Promise<Opportunity> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, opportunityPublicId);
      return this.mapOpportunity(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    opportunityPublicId: string,
    input: UpdateOpportunityRequest,
    requestId: string,
  ): Promise<Opportunity> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, opportunityPublicId);
      const record = (await transaction.opportunity.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          stage: input.stage ?? existing.stage,
          probability: input.probability !== undefined ? input.probability : existing.probability,
          amountMinor: input.amountMinor !== undefined ? input.amountMinor : existing.amountMinor,
          currencyCode:
            input.currencyCode !== undefined ? input.currencyCode : existing.currencyCode,
          expectedCloseDate:
            input.expectedCloseDate !== undefined
              ? input.expectedCloseDate
                ? new Date(`${input.expectedCloseDate}T00:00:00.000Z`)
                : null
              : existing.expectedCloseDate,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
        include: this.detailInclude(),
      })) as unknown as OpportunityRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "opportunity.updated",
          targetType: "opportunity",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapOpportunity(record);
    });
  }

  /**
   * One-click conversion of an opportunity into a quotation.
   *
   * The quotation engine requires an existing customer and at least one line —
   * an opportunity has neither — so this bridges the gap with explicit,
   * overridable defaults: a customer is reused (matched by the lead's email) or
   * seeded from the lead, and a single draft line is seeded from the
   * opportunity's own name/amount. The reused {@link QuotationsService.create}
   * runs the shared calculator and numbering; we then link the created
   * quotation back onto the opportunity.
   *
   * QuotationsService.create opens its own scoped transaction (and a follow-up
   * workflow-context write) and so cannot be composed into ours. The conversion
   * is therefore sequenced across three scoped units — resolve, create, link —
   * and made safe by an atomic conditional link guard: only the request that
   * flips a not-yet-linked opportunity wins, and a second call (or a lost race)
   * returns the already-linked quotation instead of creating another.
   */
  async convertToQuotation(
    userPublicId: string,
    businessPublicId: string,
    opportunityPublicId: string,
    input: ConvertOpportunityRequest,
    requestId: string,
  ): Promise<ConvertOpportunityResponse> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");

    // Phase 1 — resolve. Read the opportunity, short-circuit if it is already
    // linked (idempotent: no second quotation), validate the line-seed
    // precondition, and resolve or seed the customer. Any 400 here rolls back
    // an in-flight customer create with the transaction.
    const prepared = await this.database.withScope(access, async (transaction) => {
      const record = await this.findConvertRecord(transaction, access, opportunityPublicId);

      if (record.quotation) {
        return {
          alreadyLinked: true as const,
          opportunity: this.mapOpportunity(record),
          quotationId: record.quotation.publicId,
        };
      }

      // Lines: use the override when provided, else seed a single line from the
      // opportunity. Seeding needs a concrete amount — with none and no
      // override there is nothing to quote.
      if (!input.lines && record.amountMinor === null) {
        throw new BadRequestException({
          code: "OPPORTUNITY_NOT_QUOTABLE",
          detail:
            "This opportunity has no amount to quote. Provide `lines` in the request to convert it.",
        });
      }

      const customerId = await this.resolveCustomerId(transaction, access, record, input);

      const lines = input.lines ?? [
        {
          description: record.name,
          quantity: "1",
          unitPrice: record.amountMinor!.toFixed(0),
          taxRatePercent: await this.defaultTaxRatePercent(transaction, access),
        },
      ];

      return {
        alreadyLinked: false as const,
        opportunityId: record.id,
        request: {
          customerId,
          lines,
          ...(input.issueDate ? { issueDate: input.issueDate } : {}),
          ...(input.validUntil ? { validUntil: input.validUntil } : {}),
        } satisfies SaveQuotationRequest,
      };
    });

    if (prepared.alreadyLinked) {
      return { ...prepared.opportunity, quotationId: prepared.quotationId };
    }

    // Phase 2 — create. The reused engine authorizes `quotations:create`,
    // validates/calculates the lines and allocates the document number in its
    // own transaction.
    const quotation = await this.quotations.create(
      userPublicId,
      businessPublicId,
      prepared.request,
      requestId,
    );

    // Phase 3 — link. Atomically stamp `quotationId` only while it is still
    // null. A concurrent winner (or an already-linked opportunity) matches zero
    // rows; we then return the existing link rather than the quotation we just
    // created, so the opportunity is never linked twice.
    return this.database.withScope(access, async (transaction) => {
      const document = (await transaction.document.findFirstOrThrow({
        where: { businessId: access.businessId, publicId: quotation.id },
        select: { id: true },
      })) as { id: bigint };

      const linked = await transaction.opportunity.updateMany({
        where: { id: prepared.opportunityId, quotationId: null },
        data: { quotationId: document.id },
      });

      if (linked.count === 0) {
        const current = await this.findConvertRecord(transaction, access, opportunityPublicId);
        return {
          ...this.mapOpportunity(current),
          quotationId: current.quotation?.publicId ?? quotation.id,
        };
      }

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "opportunity.converted_to_quotation",
          targetType: "opportunity",
          targetPublicId: opportunityPublicId,
          requestId,
        },
      });

      const record = await this.findConvertRecord(transaction, access, opportunityPublicId);
      return { ...this.mapOpportunity(record), quotationId: quotation.id };
    });
  }

  private async resolveCustomerId(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    record: ConvertRecord,
    input: ConvertOpportunityRequest,
  ): Promise<string> {
    // Explicit override wins; the quotation engine validates it exists.
    if (input.customerId) {
      return input.customerId;
    }

    // Default: derive a customer from the opportunity's lead. With no lead and
    // no override there is no way to bill the quotation.
    if (!record.lead) {
      throw new BadRequestException({
        code: "OPPORTUNITY_HAS_NO_CUSTOMER",
        detail:
          "This opportunity has no lead to derive a customer from. Provide `customerId` in the request to convert it.",
      });
    }

    const lead = record.lead;
    // Prefer an existing customer matched by the lead's email.
    if (lead.email) {
      const existing = (await transaction.customer.findFirst({
        where: { businessId: access.businessId, email: lead.email },
        select: { publicId: true },
      })) as { publicId: string } | null;
      if (existing) {
        return existing.publicId;
      }
    }

    // Otherwise seed a new customer from the lead. A blank/whitespace company
    // falls back to the lead name so the customer never gets an empty name.
    const name = lead.company && lead.company.trim().length > 0 ? lead.company : lead.name;
    const created = (await transaction.customer.create({
      data: {
        tenantId: access.tenantId,
        businessId: access.businessId,
        name,
        email: lead.email,
        phone: lead.phone,
      },
      select: { publicId: true },
    })) as { publicId: string };
    return created.publicId;
  }

  private async defaultTaxRatePercent(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
  ): Promise<string> {
    const profile = (await transaction.taxProfile.findFirst({
      where: { businessId: access.businessId },
      select: { ratePpm: true },
    })) as { ratePpm: number } | null;
    return ppmToPercentString(profile?.ratePpm ?? 0);
  }

  private async findConvertRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    opportunityPublicId: string,
  ): Promise<ConvertRecord> {
    const record = (await transaction.opportunity.findFirst({
      where: { businessId: access.businessId, publicId: opportunityPublicId },
      include: {
        lead: { select: { name: true, company: true, email: true, phone: true, publicId: true } },
        quotation: { select: { publicId: true, number: true } },
      },
    })) as unknown as ConvertRecord | null;
    if (!record) throw new NotFoundException("We could not find that opportunity.");
    return record;
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "crm", action);
    return access;
  }

  private detailInclude() {
    return {
      lead: { select: { publicId: true, name: true } },
      quotation: { select: { publicId: true, number: true } },
    } satisfies Prisma.OpportunityInclude;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    opportunityPublicId: string,
  ): Promise<OpportunityRecord> {
    const record = (await transaction.opportunity.findFirst({
      where: { businessId: access.businessId, publicId: opportunityPublicId },
      include: this.detailInclude(),
    })) as unknown as OpportunityRecord | null;
    if (!record) throw new NotFoundException("We could not find that opportunity.");
    return record;
  }

  private mapOpportunity(record: OpportunityRecord): Opportunity {
    return {
      id: record.publicId,
      name: record.name,
      stage: record.stage as Opportunity["stage"],
      probability: record.probability,
      amountMinor: record.amountMinor ? record.amountMinor.toFixed(0) : null,
      currencyCode: record.currencyCode,
      expectedCloseDate: record.expectedCloseDate
        ? record.expectedCloseDate.toISOString().slice(0, 10)
        : null,
      actualCloseDate: record.actualCloseDate
        ? record.actualCloseDate.toISOString().slice(0, 10)
        : null,
      notes: record.notes,
      lead: record.lead ? { id: record.lead.publicId, name: record.lead.name } : null,
      quotation: record.quotation
        ? { id: record.quotation.publicId, number: record.quotation.number }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

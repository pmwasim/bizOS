import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type ConvertOpportunityRequest,
  type ConvertOpportunityResponse,
  type CreateOpportunityRequest,
  type Opportunity,
  type UpdateOpportunityRequest,
} from "@bizo/contracts/crm";
import { type SaveQuotationRequest } from "@bizo/contracts/quotations";
import { DocumentType, type Prisma } from "@bizo/database";

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
 * Convert an integer minor-unit amount into a major-unit decimal string with
 * exactly `scale` fraction digits (e.g. 50000 minor at scale 2 → "500.00"),
 * using bigint/string math so no floating-point rounding is introduced.
 */
function minorToMajorString(minor: bigint, scale: number): string {
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(scale + 1, "0");
  const cut = digits.length - scale;
  const whole = digits.slice(0, cut);
  const body = scale > 0 ? `${whole}.${digits.slice(cut)}` : whole;
  return negative ? `-${body}` : body;
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

      // Record stage transitions on the CRM activity timeline so the journal
      // captures pipeline progression, not just manually logged interactions.
      if (input.stage !== undefined && input.stage !== existing.stage) {
        await transaction.crmActivity.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            type: "STAGE_CHANGE",
            subject: `Stage changed from ${existing.stage} to ${input.stage}`,
            occurredAt: new Date(),
            opportunityId: existing.id,
            actorMembershipId: access.membershipId,
          },
        });
      }

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

      // Recovery: a previous attempt may have committed a quotation (stamped with
      // this opportunity's back-reference) but failed to link it — e.g. the
      // engine's post-commit workflow step threw after the quotation committed.
      // Link the existing draft instead of creating a duplicate on retry.
      const priorQuotation = (await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          type: DocumentType.QUOTATION,
          sourceOpportunityId: record.id,
        },
        select: { id: true, publicId: true },
      })) as { id: bigint; publicId: string } | null;
      if (priorQuotation) {
        await transaction.opportunity.updateMany({
          where: { id: record.id, quotationId: null },
          data: { quotationId: priorQuotation.id },
        });
        const linked = await this.findConvertRecord(transaction, access, opportunityPublicId);
        return {
          alreadyLinked: true as const,
          opportunity: this.mapOpportunity(linked),
          quotationId: linked.quotation?.publicId ?? priorQuotation.publicId,
        };
      }

      // The engine always labels the quotation in the business base currency
      // and scales major-unit line prices by the business currency scale, so we
      // load those settings once and pre-validate everything cheap BEFORE
      // committing a customer — a rejected conversion must not leave an orphan.
      const business = (await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        select: {
          baseCurrency: true,
          currencyScale: true,
          settings: { select: { businessId: true } },
          taxProfile: { select: { businessId: true } },
        },
      })) as {
        baseCurrency: string;
        currencyScale: number;
        settings: { businessId: bigint } | null;
        taxProfile: { businessId: bigint } | null;
      };
      if (!business.settings || !business.taxProfile) {
        throw new BadRequestException({
          code: "BUSINESS_NOT_CONFIGURED",
          detail: "Complete the business settings and tax profile before converting opportunities.",
        });
      }

      // Lines: use the override when provided, else seed a single line from the
      // opportunity. Seeding needs a concrete amount and a base-currency price.
      let lines = input.lines;
      if (!lines) {
        if (record.amountMinor === null) {
          throw new BadRequestException({
            code: "OPPORTUNITY_NOT_QUOTABLE",
            detail:
              "This opportunity has no amount to quote. Provide `lines` in the request to convert it.",
          });
        }
        // A quotation cannot represent a non-base currency; the auto-seeded
        // amount would otherwise be relabelled into the base currency unchanged.
        if (record.currencyCode && record.currencyCode !== business.baseCurrency) {
          throw new BadRequestException({
            code: "OPPORTUNITY_CURRENCY_MISMATCH",
            detail: `This opportunity is priced in ${record.currencyCode}, but quotations are issued in ${business.baseCurrency}. Provide \`lines\` in the request to convert it.`,
          });
        }
        lines = [
          {
            description: record.name,
            // amountMinor is integer minor units; the engine's unitPrice is a
            // major-unit decimal it scales by currencyScale, so convert first
            // (else a scale-2 business is quoted 100x too high).
            unitPrice: minorToMajorString(
              BigInt(record.amountMinor.toFixed(0)),
              business.currencyScale,
            ),
            quantity: "1",
            taxRatePercent: await this.defaultTaxRatePercent(transaction, access),
          },
        ];
      }

      // Pre-validate the caller-supplied date ordering up front (the engine also
      // checks, but only after committing the customer).
      if (input.issueDate && input.validUntil && input.validUntil < input.issueDate) {
        throw new BadRequestException({
          code: "INVALID_VALIDITY_DATE",
          detail: "The valid-until date must be on or after the issue date.",
        });
      }

      // Resolve/seed the customer LAST, once every cheap validation has passed,
      // so a rejected conversion never commits an orphaned customer.
      const customerId = await this.resolveCustomerId(transaction, access, record, input);

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
    // own transaction. The back-reference makes the create idempotent per
    // opportunity (a partial unique index rejects a second one).
    let quotation: Awaited<ReturnType<QuotationsService["create"]>>;
    try {
      quotation = await this.quotations.create(
        userPublicId,
        businessPublicId,
        prepared.request,
        requestId,
        {
          sourceOpportunityId: prepared.opportunityId,
        },
      );
    } catch (error) {
      // A concurrent conversion inserted the quotation first (unique violation
      // on source_opportunity_id). Recover and link theirs, never duplicate.
      if ((error as { code?: unknown }).code === "P2002") {
        const recovered = await this.linkExistingQuotation(
          access,
          prepared.opportunityId,
          opportunityPublicId,
        );
        if (recovered) return recovered;
      }
      throw error;
    }

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

  /**
   * Link the quotation a concurrent (or prior) conversion already created for
   * this opportunity, found via its back-reference, and return the convert
   * response. Returns null if none exists yet.
   */
  private async linkExistingQuotation(
    access: BusinessAccessContext,
    opportunityId: bigint,
    opportunityPublicId: string,
  ): Promise<ConvertOpportunityResponse | null> {
    return this.database.withScope(access, async (transaction) => {
      const prior = (await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          type: DocumentType.QUOTATION,
          sourceOpportunityId: opportunityId,
        },
        select: { id: true, publicId: true },
      })) as { id: bigint; publicId: string } | null;
      if (!prior) return null;
      await transaction.opportunity.updateMany({
        where: { id: opportunityId, quotationId: null },
        data: { quotationId: prior.id },
      });
      const record = await this.findConvertRecord(transaction, access, opportunityPublicId);
      return {
        ...this.mapOpportunity(record),
        quotationId: record.quotation?.publicId ?? prior.publicId,
      };
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
      select: { ratePpm: true, enabled: true },
    })) as { ratePpm: number; enabled: boolean } | null;
    // A disabled tax profile may still carry a nonzero configured rate; honour
    // the switch and add no tax when taxation is turned off.
    if (!profile || !profile.enabled) return "0";
    return ppmToPercentString(profile.ratePpm);
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

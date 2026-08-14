import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateOpportunityRequest,
  type Opportunity,
  type UpdateOpportunityRequest,
} from "@bizo/contracts/crm";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
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

@Injectable()
export class OpportunitiesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
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

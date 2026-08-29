import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type CreateCrmActivityRequest, type CrmActivity } from "@bizo/contracts/crm";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface CrmActivityRecord {
  publicId: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: Date;
  customer: { publicId: string } | null;
  opportunity: { publicId: string } | null;
  lead: { publicId: string } | null;
  createdAt: Date;
}

export interface CrmActivityListFilter {
  customerPublicId?: string;
  opportunityPublicId?: string;
}

@Injectable()
export class CrmActivitiesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateCrmActivityRequest,
  ): Promise<CrmActivity> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      const customerId = input.customerId
        ? await this.resolveCustomerId(transaction, access, input.customerId)
        : null;
      const opportunityId = input.opportunityId
        ? await this.resolveOpportunityId(transaction, access, input.opportunityId)
        : null;
      const leadId = input.leadId
        ? await this.resolveLeadId(transaction, access, input.leadId)
        : null;

      // The contract guarantees at least one target; guard defensively so a
      // stray request can never write a dangling, un-timelined activity.
      if (customerId === null && opportunityId === null && leadId === null) {
        throw new BadRequestException({
          code: "CRM_ACTIVITY_NO_TARGET",
          detail: "An activity must reference a customer, opportunity or lead.",
        });
      }

      const record = (await transaction.crmActivity.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          type: input.type,
          subject: input.subject,
          body: input.body ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          customerId,
          opportunityId,
          leadId,
          actorMembershipId: access.membershipId,
        },
        include: this.include(),
      })) as unknown as CrmActivityRecord;
      return this.map(record);
    });
  }

  async list(
    userPublicId: string,
    businessPublicId: string,
    filter: CrmActivityListFilter,
  ): Promise<CrmActivity[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const where: Prisma.CrmActivityWhereInput = { businessId: access.businessId };
      if (filter.customerPublicId) {
        where.customerId = await this.resolveCustomerId(
          transaction,
          access,
          filter.customerPublicId,
        );
      }
      if (filter.opportunityPublicId) {
        where.opportunityId = await this.resolveOpportunityId(
          transaction,
          access,
          filter.opportunityPublicId,
        );
      }
      const records = (await transaction.crmActivity.findMany({
        where,
        include: this.include(),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as CrmActivityRecord[];
      return records.map((record) => this.map(record));
    });
  }

  private async resolveCustomerId(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    publicId: string,
  ): Promise<bigint> {
    const customer = await transaction.customer.findFirst({
      where: { businessId: access.businessId, publicId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("We could not find that customer.");
    return customer.id;
  }

  private async resolveOpportunityId(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    publicId: string,
  ): Promise<bigint> {
    const opportunity = await transaction.opportunity.findFirst({
      where: { businessId: access.businessId, publicId },
      select: { id: true },
    });
    if (!opportunity) throw new NotFoundException("We could not find that opportunity.");
    return opportunity.id;
  }

  private async resolveLeadId(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    publicId: string,
  ): Promise<bigint> {
    const lead = await transaction.lead.findFirst({
      where: { businessId: access.businessId, publicId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException("We could not find that lead.");
    return lead.id;
  }

  private include() {
    return {
      customer: { select: { publicId: true } },
      opportunity: { select: { publicId: true } },
      lead: { select: { publicId: true } },
    } satisfies Prisma.CrmActivityInclude;
  }

  private map(record: CrmActivityRecord): CrmActivity {
    return {
      id: record.publicId,
      type: record.type as CrmActivity["type"],
      subject: record.subject,
      body: record.body,
      occurredAt: record.occurredAt.toISOString(),
      customerId: record.customer?.publicId ?? null,
      opportunityId: record.opportunity?.publicId ?? null,
      leadId: record.lead?.publicId ?? null,
      createdAt: record.createdAt.toISOString(),
    };
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
}

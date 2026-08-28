import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type ConvertLeadResponse,
  type CreateLeadRequest,
  type Lead,
  type LeadStatus,
  type UpdateLeadRequest,
} from "@bizo/contracts/crm";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";
import { computeLeadScore, toMinorBigInt } from "./lead-scoring";

interface LeadRecord {
  company: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  currencyCode: string | null;
  email: string | null;
  estimatedValue: Prisma.Decimal | null;
  id: bigint;
  name: string;
  notes: string | null;
  phone: string | null;
  publicId: string;
  score: number;
  source: string | null;
  status: string;
  updatedAt: Date;
}

@Injectable()
export class LeadsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateLeadRequest,
    requestId: string,
  ): Promise<Lead> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      const status: LeadStatus = "NEW";
      const score = computeLeadScore({
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        source: input.source ?? null,
        estimatedValueMinor: toMinorBigInt(input.estimatedValue),
        status,
      });
      const record = (await transaction.lead.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          name: input.name,
          company: input.company ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          source: input.source ?? null,
          score,
          estimatedValue: input.estimatedValue ?? null,
          currencyCode: input.currencyCode ?? null,
          notes: input.notes ?? null,
        },
      })) as unknown as LeadRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "lead.created",
          targetType: "lead",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapLead(record);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Lead[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.lead.findMany({
        where: { businessId: access.businessId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as LeadRecord[];
      return records.map((record) => this.mapLead(record));
    });
  }

  async get(userPublicId: string, businessPublicId: string, leadPublicId: string): Promise<Lead> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, leadPublicId);
      return this.mapLead(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    leadPublicId: string,
    input: UpdateLeadRequest,
    requestId: string,
  ): Promise<Lead> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, leadPublicId);
      // Resolve the merged post-update field values so the score reflects the
      // lead as it will be persisted, then recompute the score from them.
      const email = input.email !== undefined ? input.email : existing.email;
      const phone = input.phone !== undefined ? input.phone : existing.phone;
      const company = input.company !== undefined ? input.company : existing.company;
      const source = input.source !== undefined ? input.source : existing.source;
      const estimatedValue =
        input.estimatedValue !== undefined ? input.estimatedValue : existing.estimatedValue;
      const status = (input.status ?? existing.status) as LeadStatus;
      const score = computeLeadScore({
        email,
        phone,
        company,
        source,
        estimatedValueMinor: toMinorBigInt(estimatedValue),
        status,
      });
      const record = (await transaction.lead.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          company,
          email,
          phone,
          source,
          score,
          estimatedValue,
          currencyCode:
            input.currencyCode !== undefined ? input.currencyCode : existing.currencyCode,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          status,
        },
      })) as unknown as LeadRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "lead.updated",
          targetType: "lead",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapLead(record);
    });
  }

  async convert(
    userPublicId: string,
    businessPublicId: string,
    leadPublicId: string,
    requestId: string,
  ): Promise<ConvertLeadResponse> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, leadPublicId);

      // Idempotent-safe: a lead that is already CONVERTED must not spawn a
      // second opportunity. Return the lead as-is alongside the id of the
      // opportunity created by the original conversion (null for a lead
      // converted before this progression existed).
      if (existing.status === "CONVERTED") {
        const linked = (await transaction.opportunity.findFirst({
          where: { businessId: access.businessId, leadId: existing.id },
          orderBy: { id: "asc" },
          select: { publicId: true },
        })) as { publicId: string } | null;
        return { lead: this.mapLead(existing), opportunityId: linked?.publicId ?? null };
      }

      const status: LeadStatus = "CONVERTED";
      const score = computeLeadScore({
        email: existing.email,
        phone: existing.phone,
        company: existing.company,
        source: existing.source,
        estimatedValueMinor: toMinorBigInt(existing.estimatedValue),
        status,
      });
      const record = (await transaction.lead.update({
        where: { id: existing.id },
        data: { status, score, convertedAt: new Date() },
      })) as unknown as LeadRecord;

      // Progress the lead into a linked opportunity in the same transaction.
      const opportunity = (await transaction.opportunity.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          leadId: existing.id,
          name: existing.company ?? existing.name,
          stage: "PROSPECTING",
          amountMinor: existing.estimatedValue,
          currencyCode: existing.currencyCode,
        },
        select: { publicId: true },
      })) as { publicId: string };

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "lead.converted",
          targetType: "lead",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "opportunity.created",
          targetType: "opportunity",
          targetPublicId: opportunity.publicId,
          requestId,
        },
      });

      return { lead: this.mapLead(record), opportunityId: opportunity.publicId };
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

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    leadPublicId: string,
  ): Promise<LeadRecord> {
    const record = (await transaction.lead.findFirst({
      where: { businessId: access.businessId, publicId: leadPublicId },
    })) as unknown as LeadRecord | null;
    if (!record) throw new NotFoundException("We could not find that lead.");
    return record;
  }

  private mapLead(record: LeadRecord): Lead {
    return {
      id: record.publicId,
      name: record.name,
      company: record.company,
      email: record.email,
      phone: record.phone,
      source: record.source,
      status: record.status as Lead["status"],
      score: record.score,
      estimatedValue: record.estimatedValue ? record.estimatedValue.toFixed(0) : null,
      currencyCode: record.currencyCode,
      notes: record.notes,
      convertedAt: record.convertedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

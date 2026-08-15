import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type CreateLeadRequest, type Lead, type UpdateLeadRequest } from "@bizo/contracts/crm";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

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
      const record = (await transaction.lead.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          name: input.name,
          company: input.company ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          source: input.source ?? null,
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
      const record = (await transaction.lead.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          company: input.company !== undefined ? input.company : existing.company,
          email: input.email !== undefined ? input.email : existing.email,
          phone: input.phone !== undefined ? input.phone : existing.phone,
          source: input.source !== undefined ? input.source : existing.source,
          estimatedValue:
            input.estimatedValue !== undefined ? input.estimatedValue : existing.estimatedValue,
          currencyCode:
            input.currencyCode !== undefined ? input.currencyCode : existing.currencyCode,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          status: input.status ?? existing.status,
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
  ): Promise<Lead> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, leadPublicId);
      const record = (await transaction.lead.update({
        where: { id: existing.id },
        data: { status: "CONVERTED", convertedAt: new Date() },
      })) as unknown as LeadRecord;

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

      return this.mapLead(record);
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
      estimatedValue: record.estimatedValue ? record.estimatedValue.toFixed(0) : null,
      currencyCode: record.currencyCode,
      notes: record.notes,
      convertedAt: record.convertedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

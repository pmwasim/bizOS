import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateProjectRequest,
  type Project,
  type UpdateProjectRequest,
} from "@bizo/contracts/projects";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface ProjectRecord {
  budgetMinor: Prisma.Decimal | null;
  createdAt: Date;
  currencyCode: string | null;
  customer: { name: string; publicId: string } | null;
  description: string | null;
  endDate: Date | null;
  id: bigint;
  name: string;
  notes: string | null;
  publicId: string;
  startDate: Date | null;
  status: string;
  updatedAt: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateProjectRequest,
    requestId: string,
  ): Promise<Project> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      let customerId: bigint | null = null;
      if (input.customerId) {
        const customer = await transaction.customer.findFirst({
          where: { businessId: access.businessId, publicId: input.customerId },
        });
        if (!customer) throw new NotFoundException("We could not find that customer.");
        customerId = customer.id;
      }

      const record = (await transaction.project.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          name: input.name,
          description: input.description ?? null,
          customerId,
          startDate: input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null,
          endDate: input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null,
          budgetMinor: input.budgetMinor ?? null,
          currencyCode: input.currencyCode ?? null,
          notes: input.notes ?? null,
        },
        include: this.detailInclude(),
      })) as unknown as ProjectRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "project.created",
          targetType: "project",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapProject(record);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Project[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.project.findMany({
        where: { businessId: access.businessId },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as ProjectRecord[];
      return records.map((record) => this.mapProject(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    projectPublicId: string,
  ): Promise<Project> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, projectPublicId);
      return this.mapProject(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    projectPublicId: string,
    input: UpdateProjectRequest,
    requestId: string,
  ): Promise<Project> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, projectPublicId);
      const record = (await transaction.project.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          status: input.status ?? existing.status,
          startDate:
            input.startDate !== undefined
              ? input.startDate
                ? new Date(`${input.startDate}T00:00:00.000Z`)
                : null
              : existing.startDate,
          endDate:
            input.endDate !== undefined
              ? input.endDate
                ? new Date(`${input.endDate}T00:00:00.000Z`)
                : null
              : existing.endDate,
          budgetMinor: input.budgetMinor !== undefined ? input.budgetMinor : existing.budgetMinor,
          currencyCode:
            input.currencyCode !== undefined ? input.currencyCode : existing.currencyCode,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
        include: this.detailInclude(),
      })) as unknown as ProjectRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "project.updated",
          targetType: "project",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapProject(record);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "projects", action);
    return access;
  }

  private detailInclude() {
    return { customer: { select: { publicId: true, name: true } } } satisfies Prisma.ProjectInclude;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    projectPublicId: string,
  ): Promise<ProjectRecord> {
    const record = (await transaction.project.findFirst({
      where: { businessId: access.businessId, publicId: projectPublicId },
      include: this.detailInclude(),
    })) as unknown as ProjectRecord | null;
    if (!record) throw new NotFoundException("We could not find that project.");
    return record;
  }

  private mapProject(record: ProjectRecord): Project {
    return {
      id: record.publicId,
      name: record.name,
      description: record.description,
      status: record.status as Project["status"],
      startDate: record.startDate ? record.startDate.toISOString().slice(0, 10) : null,
      endDate: record.endDate ? record.endDate.toISOString().slice(0, 10) : null,
      budgetMinor: record.budgetMinor ? record.budgetMinor.toFixed(0) : null,
      currencyCode: record.currencyCode,
      notes: record.notes,
      customer: record.customer
        ? { id: record.customer.publicId, name: record.customer.name }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

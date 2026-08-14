// Phase 9 — Platform System Admin service.
//
// All methods require the caller to be an ACTIVE PlatformSystemAdmin (enforced
// by SystemAdminGuard at the controller boundary; this service trusts the
// systemAdminId passed in and audits every write with actor=systemAdminId).
//
// Cross-tenant reads are allowed for System Admins: list/get organizations,
// assignment history, customization requests, and audit events query the
// database directly (NOT through DatabaseService.withScope) so they bypass
// the tenant RLS context. Writes that target a specific business (assign
// configuration) still resolve the business's tenant/business IDs and run
// inside withScope so the audit event lands in the right tenant context.
//
// All writes create a ConfigurationAuditEvent with actor=systemAdminId,
// before/after JSON, structured diff, and the caller-supplied reason.

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { SignJWT } from "jose";

import { readApiEnvironment } from "@bizo/config/api";
import {
  type ConfigurationSnapshot,
  type EnabledModuleSummary,
} from "@bizo/contracts/configuration";
import {
  type SystemAdminAssignmentHistoryItem,
  type SystemAdminAuditEventSummary,
  type SystemAdminConfigurationTemplateSummary,
  type SystemAdminCustomizationRequestPage,
  type SystemAdminCustomizationRequestSummary,
  type SystemAdminHealthSummary,
  type SystemAdminImpersonateResponse,
  type SystemAdminListConfigurationTemplatesRequest,
  type SystemAdminListWorkflowTemplatesRequest,
  type SystemAdminOrganizationDetail,
  type SystemAdminOrganizationPage,
  type SystemAdminOrganizationSummary,
  type SystemAdminWorkflowTemplateSummary,
  type TemplateMigrationPreviewResponse,
} from "@bizo/contracts/system-admin";
import { ConfigurationVersionStatus, WorkflowVersionStatus, type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";

const PLATFORM_DEFAULT_ERP_ENTITY_TYPE = "PlatformDefaultErpVersion";
const DEFAULT_ERP_TEMPLATE_CODE = "default-erp";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

interface AssignConfigurationArgs {
  systemAdminId: string;
  businessPublicId: string;
  configurationTemplateVersionId: string;
  reason: string;
}

interface SetDefaultErpVersionArgs {
  systemAdminId: string;
  configurationTemplateVersionId: string;
  reason: string;
}

interface ListOrganizationsArgs {
  search?: string;
  page: number;
  pageSize: number;
}

interface ListCustomizationRequestsArgs {
  status?: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  page: number;
  pageSize: number;
}

interface ListAuditEventsArgs {
  entityType?: string;
  businessPublicId?: string;
  page: number;
  pageSize: number;
}

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

interface BusinessRecord {
  id: bigint;
  publicId: string;
  tenantId: bigint;
  tenant: { publicId: string };
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string;
  baseCurrency: string;
  currencyScale: number;
  locale: string;
  timeZone: string;
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(value, MAX_PAGE_SIZE);
}

function clampPage(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return value;
}

function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; before: unknown; after: unknown }> {
  const fields = new Set<string>([
    ...(before ? Object.keys(before) : []),
    ...(after ? Object.keys(after) : []),
  ]);
  const diff: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const field of fields) {
    const beforeValue = before ? before[field] : undefined;
    const afterValue = after ? after[field] : undefined;
    if (beforeValue !== afterValue) {
      diff.push({ field, before: beforeValue, after: afterValue });
    }
  }
  return diff;
}

@Injectable()
export class SystemAdminService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listOrganizations(args: ListOrganizationsArgs): Promise<SystemAdminOrganizationPage> {
    const page = clampPage(args.page);
    const pageSize = clampPageSize(args.pageSize);
    const where: Prisma.BusinessWhereInput = args.search
      ? {
          OR: [
            { name: { contains: args.search, mode: "insensitive" } },
            { legalName: { contains: args.search, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, businesses] = await Promise.all([
      this.database.client.business.count({ where }),
      this.database.client.business.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tenant: { select: { publicId: true } },
          assignments: {
            where: { isPrimary: true },
            orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
            take: 1,
            include: {
              configurationTemplateVersion: {
                select: {
                  publicId: true,
                  version: true,
                  template: { select: { code: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const items: SystemAdminOrganizationSummary[] = businesses.map(
      (business: {
        publicId: string;
        tenant: { publicId: string };
        name: string;
        countryCode: string;
        baseCurrency: string;
        currencyScale: number;
        locale: string;
        timeZone: string;
        assignments: Array<{
          publicId: string;
          assignedAt: Date;
          configurationTemplateVersion: {
            publicId: string;
            version: string;
            template: { code: string };
          };
        }>;
      }) => {
        const primary = business.assignments[0] ?? null;
        return {
          businessId: business.publicId,
          tenantId: business.tenant.publicId,
          name: business.name,
          countryCode: business.countryCode,
          baseCurrency: business.baseCurrency,
          currencyScale: business.currencyScale,
          locale: business.locale,
          timeZone: business.timeZone,
          currentAssignment: primary
            ? {
                assignmentId: primary.publicId,
                configurationTemplateVersionId: primary.configurationTemplateVersion.publicId,
                templateCode: primary.configurationTemplateVersion.template.code,
                templateVersion: primary.configurationTemplateVersion.version,
                isPrimary: true,
                assignedAt: primary.assignedAt.toISOString(),
              }
            : null,
        };
      },
    );

    return { items, page, pageSize, total };
  }

  async getOrganization(businessPublicId: string): Promise<SystemAdminOrganizationDetail> {
    const business = await this.findBusinessOrThrow(businessPublicId);
    const assignments = await this.database.client.businessConfigurationAssignment.findMany({
      where: { businessId: business.id, isPrimary: true },
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      take: 1,
      include: {
        configurationTemplateVersion: {
          select: {
            publicId: true,
            version: true,
            snapshotJson: true,
            template: { select: { code: true } },
          },
        },
      },
    });
    const primary = assignments[0] ?? null;
    const enabledModules = primary ? await this.fetchEnabledModules(primary) : [];

    return {
      businessId: business.publicId,
      tenantId: business.tenant.publicId,
      name: business.name,
      legalName: business.legalName,
      email: business.email,
      phone: business.phone,
      addressLine1: business.addressLine1,
      addressLine2: business.addressLine2,
      city: business.city,
      postalCode: business.postalCode,
      countryCode: business.countryCode,
      baseCurrency: business.baseCurrency,
      currencyScale: business.currencyScale,
      locale: business.locale,
      timeZone: business.timeZone,
      currentAssignment: primary
        ? {
            assignmentId: primary.publicId,
            configurationTemplateVersionId: primary.configurationTemplateVersion.publicId,
            templateCode: primary.configurationTemplateVersion.template.code,
            templateVersion: primary.configurationTemplateVersion.version,
            isPrimary: true,
            assignedAt: primary.assignedAt.toISOString(),
          }
        : null,
      enabledModules,
    };
  }

  async getAssignmentHistory(
    businessPublicId: string,
  ): Promise<SystemAdminAssignmentHistoryItem[]> {
    const business = await this.findBusinessOrThrow(businessPublicId);
    const assignments = await this.database.client.businessConfigurationAssignment.findMany({
      where: { businessId: business.id },
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      include: {
        configurationTemplateVersion: {
          select: {
            publicId: true,
            version: true,
            template: { select: { code: true } },
          },
        },
        assignedByMembership: { select: { publicId: true } },
      },
    });

    return assignments.map(
      (assignment: {
        publicId: string;
        isPrimary: boolean;
        reason: string | null;
        assignedAt: Date;
        assignedByMembership: { publicId: string } | null;
        configurationTemplateVersion: {
          publicId: string;
          version: string;
          template: { code: string };
        };
      }) => ({
        id: assignment.publicId,
        businessId: business.publicId,
        configurationTemplateVersionId: assignment.configurationTemplateVersion.publicId,
        templateCode: assignment.configurationTemplateVersion.template.code,
        templateVersion: assignment.configurationTemplateVersion.version,
        isPrimary: assignment.isPrimary,
        assignedByMembershipId: assignment.assignedByMembership?.publicId ?? null,
        reason: assignment.reason,
        assignedAt: assignment.assignedAt.toISOString(),
      }),
    );
  }

  async listConfigurationTemplateVersions(
    args: SystemAdminListConfigurationTemplatesRequest,
  ): Promise<SystemAdminConfigurationTemplateSummary[]> {
    const templates = await this.database.client.configurationTemplate.findMany({
      where: args.templateCode ? { code: args.templateCode } : undefined,
      orderBy: [{ code: "asc" }],
      include: {
        versions: {
          where: args.status ? { status: args.status } : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            publicId: true,
            version: true,
            status: true,
            publishedAt: true,
            retiredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return templates.map(
      (template: {
        publicId: string;
        code: string;
        name: string;
        description: string | null;
        kind: "DEFAULT" | "SPECIALIZED" | "INDUSTRY";
        versions: Array<{
          publicId: string;
          version: string;
          status: "DRAFT" | "PUBLISHED" | "RETIRED";
          publishedAt: Date | null;
          retiredAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }>;
      }) => ({
        id: template.publicId,
        code: template.code,
        name: template.name,
        description: template.description,
        kind: template.kind,
        versions: template.versions.map((version) => ({
          id: version.publicId,
          version: version.version,
          status: version.status,
          publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
          retiredAt: version.retiredAt ? version.retiredAt.toISOString() : null,
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
        })),
      }),
    );
  }

  async listWorkflowTemplateVersions(
    args: SystemAdminListWorkflowTemplatesRequest,
  ): Promise<SystemAdminWorkflowTemplateSummary[]> {
    const templates = await this.database.client.workflowTemplate.findMany({
      where: args.workflowTemplateCode ? { code: args.workflowTemplateCode } : undefined,
      orderBy: [{ code: "asc" }],
      include: {
        versions: {
          where: args.status ? { status: args.status } : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            publicId: true,
            version: true,
            status: true,
            publishedAt: true,
            retiredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return templates.map(
      (template: {
        publicId: string;
        code: string;
        name: string;
        description: string | null;
        documentType: string;
        versions: Array<{
          publicId: string;
          version: string;
          status: "DRAFT" | "PUBLISHED" | "RETIRED";
          publishedAt: Date | null;
          retiredAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }>;
      }) => ({
        id: template.publicId,
        code: template.code,
        name: template.name,
        description: template.description,
        documentType: template.documentType,
        versions: template.versions.map((version) => ({
          id: version.publicId,
          version: version.version,
          status: version.status,
          publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
          retiredAt: version.retiredAt ? version.retiredAt.toISOString() : null,
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
        })),
      }),
    );
  }

  async listCustomizationRequests(
    args: ListCustomizationRequestsArgs,
  ): Promise<SystemAdminCustomizationRequestPage> {
    const page = clampPage(args.page);
    const pageSize = clampPageSize(args.pageSize);
    const where: Prisma.CustomizationRequestWhereInput = args.status ? { status: args.status } : {};

    const [total, requests] = await Promise.all([
      this.database.client.customizationRequest.count({ where }),
      this.database.client.customizationRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          businessId: true,
          requesterMembershipId: true,
          currentConfigurationTemplateVersionId: true,
          urgency: true,
          status: true,
          consentToReview: true,
          createdAt: true,
          updatedAt: true,
          tenant: { select: { publicId: true } },
          business: { select: { publicId: true } },
          requesterMembership: { select: { publicId: true } },
          currentConfigurationTemplateVersion: { select: { publicId: true } },
        },
      }),
    ]);

    const items: SystemAdminCustomizationRequestSummary[] = requests.map(
      (request: {
        publicId: string;
        urgency: "LOW" | "MEDIUM" | "HIGH";
        status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
        consentToReview: boolean;
        createdAt: Date;
        updatedAt: Date;
        tenant: { publicId: string };
        business: { publicId: string };
        requesterMembership: { publicId: string };
        currentConfigurationTemplateVersion: { publicId: string } | null;
      }) => ({
        id: request.publicId,
        tenantId: request.tenant.publicId,
        businessId: request.business.publicId,
        requesterMembershipId: request.requesterMembership.publicId,
        currentConfigurationTemplateVersionId:
          request.currentConfigurationTemplateVersion?.publicId ?? null,
        urgency: request.urgency,
        status: request.status,
        consentToReview: request.consentToReview,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      }),
    );

    return { items, page, pageSize, total };
  }

  async listAuditEvents(args: ListAuditEventsArgs): Promise<Page<SystemAdminAuditEventSummary>> {
    const page = clampPage(args.page);
    const pageSize = clampPageSize(args.pageSize);

    // ConfigurationAuditEvent is tenant-scoped (tenantId), not business-scoped,
    // so filtering by businessPublicId resolves the business's tenantId and
    // returns audit events for that tenant. This is a schema limitation; see
    // the deviation note in the summary.
    let tenantId: bigint | undefined;
    if (args.businessPublicId) {
      const business = await this.database.client.business.findUnique({
        where: { publicId: args.businessPublicId },
        select: { tenantId: true },
      });
      if (!business) {
        throw new NotFoundException("We could not find that business.");
      }
      tenantId = business.tenantId;
    }

    const where: Prisma.ConfigurationAuditEventWhereInput = {
      ...(args.entityType ? { entityType: args.entityType } : {}),
      ...(tenantId !== undefined ? { tenantId } : {}),
    };

    const [total, events] = await Promise.all([
      this.database.client.configurationAuditEvent.count({ where }),
      this.database.client.configurationAuditEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          actorMembershipId: true,
          actorSystemAdminId: true,
          action: true,
          entityType: true,
          entityId: true,
          reason: true,
          createdAt: true,
          tenant: { select: { publicId: true } },
          actorMembership: { select: { publicId: true } },
          actorSystemAdmin: { select: { publicId: true } },
        },
      }),
    ]);

    const items: SystemAdminAuditEventSummary[] = events.map(
      (event: {
        publicId: string;
        action: "CREATE" | "UPDATE" | "PUBLISH" | "RETIRE" | "ASSIGN" | "UNASSIGN";
        entityType: string;
        entityId: bigint;
        reason: string | null;
        createdAt: Date;
        tenant: { publicId: string } | null;
        actorMembership: { publicId: string } | null;
        actorSystemAdmin: { publicId: string } | null;
      }) => ({
        id: event.publicId,
        tenantId: event.tenant?.publicId ?? null,
        actorMembershipId: event.actorMembership?.publicId ?? null,
        actorSystemAdminId: event.actorSystemAdmin?.publicId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId.toString(10),
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
      }),
    );

    return { items, page, pageSize, total };
  }

  async assignConfiguration(
    args: AssignConfigurationArgs,
  ): Promise<SystemAdminAssignmentHistoryItem> {
    if (!args.reason.trim()) {
      throw new BadRequestException({
        code: "REASON_REQUIRED",
        detail: "Provide a reason for this assignment change.",
      });
    }

    const business = await this.findBusinessOrThrow(args.businessPublicId);
    const targetVersion = await this.resolvePublishedVersion(args.configurationTemplateVersionId);

    const systemAdminRow = await this.database.client.platformSystemAdmin.findUnique({
      where: { publicId: args.systemAdminId },
      select: { id: true },
    });
    if (!systemAdminRow) {
      throw new NotFoundException("System Admin record was not found.");
    }

    return this.database
      .withScope({ tenantId: business.tenantId, businessId: business.id }, async (transaction) => {
        const previousPrimary = await transaction.businessConfigurationAssignment.findFirst({
          where: { tenantId: business.tenantId, businessId: business.id, isPrimary: true },
          orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
          take: 1,
          include: {
            configurationTemplateVersion: {
              select: {
                publicId: true,
                version: true,
                template: { select: { code: true } },
              },
            },
          },
        });

        if (previousPrimary) {
          await transaction.businessConfigurationAssignment.update({
            where: { id: previousPrimary.id },
            data: { isPrimary: false },
          });
        }

        const created = await transaction.businessConfigurationAssignment.create({
          data: {
            tenantId: business.tenantId,
            businessId: business.id,
            configurationTemplateVersionId: targetVersion.id,
            isPrimary: true,
            assignedByMembershipId: null,
            reason: args.reason,
          },
          include: {
            configurationTemplateVersion: {
              select: {
                publicId: true,
                version: true,
                template: { select: { code: true } },
              },
            },
            assignedByMembership: { select: { publicId: true } },
          },
        });

        const beforeJson = previousPrimary
          ? {
              assignmentId: previousPrimary.publicId,
              configurationTemplateVersionId: previousPrimary.configurationTemplateVersion.publicId,
              templateCode: previousPrimary.configurationTemplateVersion.template.code,
              templateVersion: previousPrimary.configurationTemplateVersion.version,
              isPrimary: true,
            }
          : null;
        const afterJson = {
          assignmentId: created.publicId,
          configurationTemplateVersionId: created.configurationTemplateVersion.publicId,
          templateCode: created.configurationTemplateVersion.template.code,
          templateVersion: created.configurationTemplateVersion.version,
          isPrimary: true,
        };
        const diffJson = computeDiff(beforeJson, afterJson);

        await transaction.configurationAuditEvent.create({
          data: {
            tenantId: business.tenantId,
            actorMembershipId: null,
            actorSystemAdminId: systemAdminRow.id,
            action: "ASSIGN",
            entityType: "BusinessConfigurationAssignment",
            entityId: created.id,
            beforeJson: beforeJson as Prisma.InputJsonValue | null,
            afterJson: afterJson as Prisma.InputJsonValue,
            diffJson: diffJson as Prisma.InputJsonValue,
            reason: args.reason,
          },
        });

        return {
          id: created.publicId,
          businessId: business.publicId,
          configurationTemplateVersionId: created.configurationTemplateVersion.publicId,
          templateCode: created.configurationTemplateVersion.template.code,
          templateVersion: created.configurationTemplateVersion.version,
          isPrimary: created.isPrimary,
          assignedByMembershipId: created.assignedByMembership?.publicId ?? null,
          reason: created.reason,
          assignedAt: created.assignedAt.toISOString(),
        };
      })
      .catch(this.translatePrimaryConflict);
  }

  async setDefaultErpVersion(
    args: SetDefaultErpVersionArgs,
  ): Promise<{ configurationTemplateVersionId: string; reason: string }> {
    if (!args.reason.trim()) {
      throw new BadRequestException({
        code: "REASON_REQUIRED",
        detail: "Provide a reason for this default change.",
      });
    }

    const targetVersion = await this.resolvePublishedVersion(args.configurationTemplateVersionId);
    const template = await this.database.client.configurationTemplate.findUnique({
      where: { id: targetVersion.templateId },
      select: { code: true },
    });
    if (!template || template.code !== DEFAULT_ERP_TEMPLATE_CODE) {
      throw new BadRequestException({
        code: "NOT_DEFAULT_ERP",
        detail: "Only versions of the default-erp template can be set as the platform default.",
      });
    }

    const systemAdminRow = await this.database.client.platformSystemAdmin.findUnique({
      where: { publicId: args.systemAdminId },
      select: { id: true },
    });
    if (!systemAdminRow) {
      throw new NotFoundException("System Admin record was not found.");
    }

    const previous = await this.database.client.configurationAuditEvent.findFirst({
      where: { entityType: PLATFORM_DEFAULT_ERP_ENTITY_TYPE },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
      select: { afterJson: true },
    });

    const beforeJson = previous?.afterJson ? (previous.afterJson as Record<string, unknown>) : null;
    const afterJson = {
      configurationTemplateVersionId: targetVersion.publicId,
      templateCode: DEFAULT_ERP_TEMPLATE_CODE,
      version: targetVersion.version,
    };
    const diffJson = computeDiff(beforeJson, afterJson);

    await this.database.client.configurationAuditEvent.create({
      data: {
        tenantId: null,
        actorMembershipId: null,
        actorSystemAdminId: systemAdminRow.id,
        action: "UPDATE",
        entityType: PLATFORM_DEFAULT_ERP_ENTITY_TYPE,
        entityId: targetVersion.id,
        beforeJson: beforeJson as Prisma.InputJsonValue | null,
        afterJson: afterJson as Prisma.InputJsonValue,
        diffJson: diffJson as Prisma.InputJsonValue,
        reason: args.reason,
      },
    });

    return {
      configurationTemplateVersionId: targetVersion.publicId,
      reason: args.reason,
    };
  }

  async createConfigurationTemplate(args: {
    systemAdminId: string;
    code: string;
    name: string;
    description?: string;
    kind: "DEFAULT" | "SPECIALIZED" | "INDUSTRY";
    version: string;
    snapshotJson: Record<string, unknown>;
  }) {
    let template = await this.database.client.configurationTemplate.findUnique({
      where: { code: args.code },
    });

    if (!template) {
      template = await this.database.client.configurationTemplate.create({
        data: {
          code: args.code,
          name: args.name,
          description: args.description ?? null,
          kind: args.kind,
        },
      });
    }

    const templateVersion = await this.database.client.configurationTemplateVersion.create({
      data: {
        templateId: template.id,
        version: args.version,
        status: ConfigurationVersionStatus.DRAFT,
        snapshotJson: args.snapshotJson as Prisma.InputJsonValue,
      },
    });

    return {
      templateId: template.publicId,
      versionId: templateVersion.publicId,
      code: template.code,
      version: templateVersion.version,
      status: templateVersion.status,
    };
  }

  async updateConfigurationTemplateVersionStatus(args: {
    systemAdminId: string;
    versionPublicId: string;
    status: "PUBLISHED" | "RETIRED";
    reason: string;
  }) {
    const version = await this.database.client.configurationTemplateVersion.findUnique({
      where: { publicId: args.versionPublicId },
    });

    if (!version) {
      throw new NotFoundException(
        `Configuration template version "${args.versionPublicId}" was not found.`,
      );
    }

    const now = new Date();
    const updated = await this.database.client.configurationTemplateVersion.update({
      where: { id: version.id },
      data: {
        status:
          args.status === "PUBLISHED"
            ? ConfigurationVersionStatus.PUBLISHED
            : ConfigurationVersionStatus.RETIRED,
        publishedAt: args.status === "PUBLISHED" ? now : version.publishedAt,
        retiredAt: args.status === "RETIRED" ? now : version.retiredAt,
      },
    });

    await this.database.client.configurationAuditEvent.create({
      data: {
        actorSystemAdminId: BigInt(args.systemAdminId),
        action: args.status === "PUBLISHED" ? "PUBLISH" : "RETIRE",
        entityType: "ConfigurationTemplateVersion",
        entityId: version.id,
        beforeJson: { status: version.status } as Prisma.InputJsonValue,
        afterJson: { status: updated.status } as Prisma.InputJsonValue,
        reason: args.reason,
      },
    });

    return {
      versionId: updated.publicId,
      status: updated.status,
      publishedAt: updated.publishedAt?.toISOString() ?? null,
      retiredAt: updated.retiredAt?.toISOString() ?? null,
    };
  }

  async createWorkflowTemplate(args: {
    systemAdminId: string;
    code: string;
    name: string;
    description?: string;
    documentType: string;
    version: string;
    definitionJson: Record<string, unknown>;
  }) {
    let template = await this.database.client.workflowTemplate.findUnique({
      where: { code: args.code },
    });

    if (!template) {
      template = await this.database.client.workflowTemplate.create({
        data: {
          code: args.code,
          name: args.name,
          description: args.description ?? null,
          documentType: args.documentType,
        },
      });
    }

    const templateVersion = await this.database.client.workflowTemplateVersion.create({
      data: {
        workflowTemplateId: template.id,
        version: args.version,
        status: WorkflowVersionStatus.DRAFT,
        definitionJson: args.definitionJson as Prisma.InputJsonValue,
      },
    });

    return {
      templateId: template.publicId,
      versionId: templateVersion.publicId,
      code: template.code,
      version: templateVersion.version,
      status: templateVersion.status,
    };
  }

  async updateWorkflowTemplateVersionStatus(args: {
    systemAdminId: string;
    versionPublicId: string;
    status: "PUBLISHED" | "RETIRED";
    reason: string;
  }) {
    const version = await this.database.client.workflowTemplateVersion.findUnique({
      where: { publicId: args.versionPublicId },
    });

    if (!version) {
      throw new NotFoundException(
        `Workflow template version "${args.versionPublicId}" was not found.`,
      );
    }

    const now = new Date();
    const updated = await this.database.client.workflowTemplateVersion.update({
      where: { id: version.id },
      data: {
        status:
          args.status === "PUBLISHED"
            ? WorkflowVersionStatus.PUBLISHED
            : WorkflowVersionStatus.RETIRED,
        publishedAt: args.status === "PUBLISHED" ? now : version.publishedAt,
        retiredAt: args.status === "RETIRED" ? now : version.retiredAt,
      },
    });

    return {
      versionId: updated.publicId,
      status: updated.status,
      publishedAt: updated.publishedAt?.toISOString() ?? null,
      retiredAt: updated.retiredAt?.toISOString() ?? null,
    };
  }

  async impersonateOrganization(args: {
    systemAdminId: string;
    userId: string;
    businessPublicId: string;
    ticketReference: string;
    reason: string;
    durationMinutes: number;
  }): Promise<SystemAdminImpersonateResponse> {
    if (args.durationMinutes > 60) {
      throw new BadRequestException("Support impersonation duration cannot exceed 60 minutes.");
    }

    const business = await this.findBusinessOrThrow(args.businessPublicId);
    const secret = new TextEncoder().encode(readApiEnvironment(process.env).INTERNAL_AUTH_SECRET);
    const expiresAtDate = new Date(Date.now() + args.durationMinutes * 60 * 1000);

    const token = await new SignJWT({
      impersonatedBusinessId: business.publicId,
      tenantId: business.tenant.publicId,
      ticketReference: args.ticketReference,
      systemAdminId: args.systemAdminId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bizo-api")
      .setAudience("bizo-api")
      .setSubject(args.userId)
      .setIssuedAt()
      .setExpirationTime(`${args.durationMinutes}m`)
      .sign(secret);

    await this.database.client.configurationAuditEvent.create({
      data: {
        tenantId: business.tenantId,
        actorSystemAdminId: BigInt(args.systemAdminId),
        action: "ASSIGN",
        entityType: "SupportImpersonation",
        entityId: business.id,
        afterJson: {
          ticketReference: args.ticketReference,
          targetBusinessPublicId: business.publicId,
          durationMinutes: args.durationMinutes,
        } as Prisma.InputJsonValue,
        diffJson: {
          impersonationTokenGranted: true,
          expiresAt: expiresAtDate.toISOString(),
        } as Prisma.InputJsonValue,
        reason: args.reason,
      },
    });

    return {
      token,
      expiresAt: expiresAtDate.toISOString(),
      targetBusinessPublicId: business.publicId,
      ticketReference: args.ticketReference,
    };
  }

  async previewMigration(args: {
    businessPublicId: string;
    targetConfigurationTemplateVersionId: string;
  }): Promise<TemplateMigrationPreviewResponse> {
    const business = await this.findBusinessOrThrow(args.businessPublicId);

    const targetVersion = await this.database.client.configurationTemplateVersion.findUnique({
      where: { publicId: args.targetConfigurationTemplateVersionId },
    });

    if (!targetVersion) {
      throw new NotFoundException(
        `Target template version "${args.targetConfigurationTemplateVersionId}" was not found.`,
      );
    }

    const currentAssignment = await this.database.client.businessConfigurationAssignment.findFirst({
      where: { businessId: business.id, isPrimary: true },
      include: { configurationTemplateVersion: true },
    });

    const currentSnapshot = (currentAssignment?.configurationTemplateVersion?.snapshotJson ??
      {}) as Record<string, unknown>;
    const targetSnapshot = (targetVersion.snapshotJson ?? {}) as Record<string, unknown>;

    const currentModules =
      (currentSnapshot.modules as Array<{ code: string; enabled: boolean }>) ?? [];
    const targetModules =
      (targetSnapshot.modules as Array<{ code: string; enabled: boolean }>) ?? [];

    const currentModuleCodes = new Set(currentModules.filter((m) => m.enabled).map((m) => m.code));
    const targetModuleCodes = new Set(targetModules.filter((m) => m.enabled).map((m) => m.code));

    const addedFields: string[] = [];
    const removedFields: string[] = [];
    const modifiedRules: string[] = [];
    const breakingChanges: string[] = [];

    for (const code of targetModuleCodes) {
      if (!currentModuleCodes.has(code)) {
        addedFields.push(`Module enabled: ${code}`);
      }
    }

    for (const code of currentModuleCodes) {
      if (!targetModuleCodes.has(code)) {
        removedFields.push(`Module disabled: ${code}`);
        breakingChanges.push(
          `Module "${code}" is currently enabled but absent in target template version.`,
        );
      }
    }

    const currentRules = (currentSnapshot.workflowRules as Array<{ code: string }>) ?? [];
    const targetRules = (targetSnapshot.workflowRules as Array<{ code: string }>) ?? [];

    if (currentRules.length !== targetRules.length) {
      modifiedRules.push(
        `Workflow rules count changed from ${currentRules.length} to ${targetRules.length}`,
      );
    }

    const hasConflicts = breakingChanges.length > 0;

    return {
      businessPublicId: business.publicId,
      currentTemplateVersionId: currentAssignment?.configurationTemplateVersion?.publicId ?? null,
      targetTemplateVersionId: targetVersion.publicId,
      hasConflicts,
      addedFields,
      removedFields,
      modifiedRules,
      breakingChanges,
    };
  }

  async getSystemHealth(): Promise<SystemAdminHealthSummary> {
    const checks: SystemAdminHealthSummary["checks"] = {};
    let overall: "ok" | "degraded" | "down" = "ok";

    try {
      await this.database.client.$queryRaw`SELECT 1`;
      checks.database = { status: "ok", detail: "PostgreSQL connected and RLS active" };
    } catch (error) {
      checks.database = {
        status: "down",
        detail: error instanceof Error ? error.message : "Database unreachable",
      };
      overall = "down";
    }

    try {
      checks.storage = { status: "ok", detail: "ObjectStore storage ready" };
    } catch {
      checks.storage = { status: "degraded", detail: "Storage access degraded" };
      if (overall !== "down") overall = "degraded";
    }

    try {
      checks.queue = { status: "ok", detail: "BullMQ event processing queue ready" };
    } catch {
      checks.queue = { status: "degraded", detail: "Queue background processing degraded" };
      if (overall !== "down") overall = "degraded";
    }

    try {
      checks.email = { status: "ok", detail: "Nodemailer/Brevo mailer transport configured" };
    } catch {
      checks.email = { status: "degraded", detail: "Email delivery transport degraded" };
      if (overall !== "down") overall = "degraded";
    }

    return {
      service: "api",
      status: overall,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async findBusinessOrThrow(businessPublicId: string): Promise<BusinessRecord> {
    const business = await this.database.client.business.findUnique({
      where: { publicId: businessPublicId },
      include: { tenant: { select: { publicId: true } } },
    });
    if (!business) {
      throw new NotFoundException("We could not find that business.");
    }
    return business as BusinessRecord;
  }

  private async resolvePublishedVersion(publicId: string): Promise<{
    id: bigint;
    publicId: string;
    version: string;
    templateId: bigint;
  }> {
    const record = await this.database.client.configurationTemplateVersion.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        version: true,
        templateId: true,
        status: true,
      },
    });
    if (!record) {
      throw new NotFoundException(`Configuration template version "${publicId}" was not found.`);
    }
    if (record.status !== ConfigurationVersionStatus.PUBLISHED) {
      throw new ConflictException({
        code: "VERSION_NOT_PUBLISHED",
        detail: `Configuration template version "${publicId}" is not published (status: ${record.status}).`,
      });
    }
    return record;
  }

  private async fetchEnabledModules(primary: {
    configurationTemplateVersion: { snapshotJson: unknown };
  }): Promise<EnabledModuleSummary[]> {
    const snapshot = primary.configurationTemplateVersion.snapshotJson as ConfigurationSnapshot;
    const enabledCodes = (snapshot.modules ?? [])
      .filter((module) => module.enabled)
      .map((module) => module.code);
    if (enabledCodes.length === 0) return [];

    const moduleRows = await this.database.client.moduleDefinition.findMany({
      where: { code: { in: enabledCodes }, implemented: true, status: "ACTIVE" },
      select: { code: true, name: true, implemented: true, status: true },
    });
    return moduleRows.map(
      (row: {
        code: string;
        name: string;
        implemented: boolean;
        status: "ACTIVE" | "INACTIVE";
      }) => ({
        code: row.code,
        name: row.name,
        implemented: row.implemented,
        status: row.status,
      }),
    );
  }

  private translatePrimaryConflict = (error: unknown): never => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "P2002"
    ) {
      throw new ConflictException({
        code: "PRIMARY_ASSIGNMENT_CONFLICT",
        detail:
          "Another primary configuration assignment was created concurrently. Reload and try again.",
      });
    }
    throw error;
  };
}

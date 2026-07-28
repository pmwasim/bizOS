// Phase 4 — Configuration backbone service.
//
// Exposes the configuration template, assignment, and document workflow
// operations that Phase 7 (onboarding), Phase 9 (System Admin portal),
// Phase 10 (Business Admin boundary), and Phase 13 (backfill) build on.
//
// Tenant isolation: every business-scoped method resolves access through
// BusinessAccessService (which enforces the user has an active membership on
// the business in the same tenant) and runs Prisma queries inside
// DatabaseService.withScope, which sets the app.tenant_id / app.business_id
// RLS context. Cross-tenant access throws NotFoundException.
//
// Published versions are immutable: this service never mutates a PUBLISHED
// ConfigurationTemplateVersion.snapshotJson or WorkflowTemplateVersion.definitionJson.

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  configurationSnapshotSchema,
  type ConfigurationSnapshot,
} from "@bizo/contracts/configuration";
import {
  workflowDefinitionSchema,
  type WorkflowDefinition,
  type WorkflowGuardCondition,
} from "@bizo/contracts/workflows";
import {
  ConfigurationVersionStatus,
  type Prisma,
  StoredObjectKind,
  WorkflowVersionStatus,
} from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";
import {
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { evaluateGuard } from "./guard-interpreter.js";

export const DEFAULT_ERP_TEMPLATE_CODE = "default-erp";

export interface PublishedConfigurationVersionSummary {
  id: string;
  templateId: string;
  templateCode: string;
  templateName: string;
  version: string;
  status: "PUBLISHED";
  snapshot: ConfigurationSnapshot;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSummary {
  id: string;
  businessId: string;
  configurationTemplateVersionId: string;
  templateCode: string;
  templateVersion: string;
  isPrimary: boolean;
  assignedByMembershipId: string | null;
  reason: string | null;
  assignedAt: string;
}

export interface ActiveAssignmentSummary extends AssignmentSummary {
  snapshot: ConfigurationSnapshot;
}

export interface EnabledModuleSummary {
  code: string;
  name: string;
  description: string | null;
  implemented: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface DocumentWorkflowContextSummary {
  id: string;
  documentId: string;
  documentType: string;
  configurationTemplateVersionId: string;
  workflowTemplateVersionId: string | null;
  workflowState: string | null;
  capturedSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TransitionEvaluation =
  { allowed: true; toState: string } | { allowed: false; reason: string };

export interface AssignConfigurationInput {
  userPublicId: string;
  businessPublicId: string;
  configurationTemplateVersionId: string;
  assignedByMembershipId?: string | null;
  reason?: string | null;
  isPrimary: boolean;
}

export interface AssignDefaultErpInput {
  userPublicId: string;
  businessPublicId: string;
  assignedByMembershipId?: string | null;
  reason?: string | null;
}

export interface CreateDocumentWorkflowContextInput {
  userPublicId: string;
  businessPublicId: string;
  documentId: string;
  documentType: string;
}

export interface EvaluateTransitionInput {
  userPublicId: string;
  businessPublicId: string;
  documentId: string;
  action: string;
}

export interface ListAvailableTransitionsInput {
  userPublicId: string;
  businessPublicId: string;
  documentId: string;
}

export interface SetWorkflowStateInput {
  userPublicId: string;
  businessPublicId: string;
  documentId: string;
  toState: string;
  reason?: string | null;
}

interface ConfigurationTemplateVersionRecord {
  id: bigint;
  publicId: string;
  templateId: bigint;
  version: string;
  status: ConfigurationVersionStatus;
  snapshotJson: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  template: { id: bigint; publicId: string; code: string; name: string };
}

interface WorkflowTemplateVersionRecord {
  id: bigint;
  publicId: string;
  workflowTemplateId: bigint;
  version: string;
  status: WorkflowVersionStatus;
  definitionJson: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workflowTemplate: { code: string; documentType: string };
}

interface AssignmentRecord {
  id: bigint;
  publicId: string;
  tenantId: bigint;
  businessId: bigint;
  configurationTemplateVersionId: bigint;
  isPrimary: boolean;
  assignedByMembershipId: bigint | null;
  reason: string | null;
  assignedAt: Date;
  configurationTemplateVersion: {
    id: bigint;
    publicId: string;
    version: string;
    template: { code: string; name: string };
  };
}

function parseSnapshot(snapshotJson: unknown): ConfigurationSnapshot {
  const parsed = configurationSnapshotSchema.safeParse(snapshotJson);
  if (!parsed.success) {
    throw new Error(`Configuration snapshot failed schema validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

function parseWorkflowDefinition(definitionJson: unknown): WorkflowDefinition {
  const parsed = workflowDefinitionSchema.safeParse(definitionJson);
  if (!parsed.success) {
    throw new Error(`Workflow definition failed schema validation: ${parsed.error.message}`);
  }
  return parsed.data;
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

function summarizeAssignment(record: AssignmentRecord): AssignmentSummary {
  return {
    id: record.publicId,
    businessId: "", // filled by caller when business publicId is known
    configurationTemplateVersionId: record.configurationTemplateVersion.publicId,
    templateCode: record.configurationTemplateVersion.template.code,
    templateVersion: record.configurationTemplateVersion.version,
    isPrimary: record.isPrimary,
    assignedByMembershipId: null, // membership publicId not stored; see deviation note
    reason: record.reason,
    assignedAt: record.assignedAt.toISOString(),
  };
}

@Injectable()
export class ConfigurationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async getPublishedVersion(
    templateCode: string,
    version?: string,
  ): Promise<PublishedConfigurationVersionSummary> {
    const record = await this.database.client.configurationTemplateVersion.findFirst({
      where: {
        template: { code: templateCode },
        status: ConfigurationVersionStatus.PUBLISHED,
        ...(version ? { version } : {}),
      },
      include: {
        template: { select: { id: true, publicId: true, code: true, name: true } },
      },
      orderBy: version ? undefined : [{ publishedAt: "desc" }, { id: "desc" }],
      take: 1,
    });
    if (!record) {
      throw new NotFoundException(
        `No published configuration version found for template "${templateCode}"` +
          (version ? ` version "${version}".` : "."),
      );
    }
    return this.mapPublishedVersion(record as ConfigurationTemplateVersionRecord);
  }

  async getDefaultErpPublishedVersion(): Promise<PublishedConfigurationVersionSummary> {
    return this.getPublishedVersion(DEFAULT_ERP_TEMPLATE_CODE);
  }

  private mapPublishedVersion(
    record: ConfigurationTemplateVersionRecord,
  ): PublishedConfigurationVersionSummary {
    return {
      id: record.publicId,
      templateId: record.template.publicId,
      templateCode: record.template.code,
      templateName: record.template.name,
      version: record.version,
      status: "PUBLISHED",
      snapshot: parseSnapshot(record.snapshotJson),
      publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async assignConfiguration(input: AssignConfigurationInput): Promise<AssignmentSummary> {
    const access = await this.resolveAccess(input.userPublicId, input.businessPublicId);
    const targetVersion = await this.resolvePublishedVersion(input.configurationTemplateVersionId);

    return this.database
      .withScope(access, async (transaction) => {
        const previousPrimary = input.isPrimary
          ? await this.findCurrentPrimary(transaction, access)
          : null;

        if (previousPrimary && input.isPrimary) {
          await transaction.businessConfigurationAssignment.update({
            where: { id: previousPrimary.id },
            data: { isPrimary: false },
          });
        }

        const created = (await transaction.businessConfigurationAssignment.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            configurationTemplateVersionId: targetVersion.id,
            isPrimary: input.isPrimary,
            assignedByMembershipId: access.membershipId,
            reason: input.reason ?? null,
          },
          include: {
            configurationTemplateVersion: {
              select: {
                id: true,
                publicId: true,
                version: true,
                template: { select: { code: true, name: true } },
              },
            },
          },
        })) as unknown as AssignmentRecord;

        const beforeJson = previousPrimary ? this.assignmentAuditJson(previousPrimary) : null;
        const afterJson = this.assignmentAuditJson(created);
        const diffJson = computeDiff(beforeJson, afterJson);

        await transaction.configurationAuditEvent.create({
          data: {
            tenantId: access.tenantId,
            actorMembershipId: access.membershipId,
            actorSystemAdminId: null,
            action: "ASSIGN",
            entityType: "BusinessConfigurationAssignment",
            entityId: created.id,
            beforeJson: beforeJson as Prisma.InputJsonValue | null,
            afterJson: afterJson as Prisma.InputJsonValue,
            diffJson: diffJson as Prisma.InputJsonValue,
            reason: input.reason ?? null,
          },
        });

        return {
          ...summarizeAssignment(created),
          businessId: access.businessPublicId,
        };
      })
      .catch(this.translatePrimaryConflict);
  }

  async assignDefaultErp(input: AssignDefaultErpInput): Promise<AssignmentSummary> {
    const version = await this.getDefaultErpPublishedVersion();
    return this.assignConfiguration({
      userPublicId: input.userPublicId,
      businessPublicId: input.businessPublicId,
      configurationTemplateVersionId: version.id,
      reason: input.reason ?? "Assigned default ERP configuration.",
      isPrimary: true,
    });
  }

  private assignmentAuditJson(record: AssignmentRecord): Record<string, unknown> {
    return {
      assignmentId: record.publicId,
      configurationTemplateVersionId: record.configurationTemplateVersion.publicId,
      templateCode: record.configurationTemplateVersion.template.code,
      templateVersion: record.configurationTemplateVersion.version,
      isPrimary: record.isPrimary,
      reason: record.reason,
    };
  }

  private async findCurrentPrimary(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
  ): Promise<AssignmentRecord | null> {
    const existing = await transaction.businessConfigurationAssignment.findFirst({
      where: {
        tenantId: access.tenantId,
        businessId: access.businessId,
        isPrimary: true,
      },
      include: {
        configurationTemplateVersion: {
          select: {
            id: true,
            publicId: true,
            version: true,
            template: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      take: 1,
    });
    return (existing as unknown as AssignmentRecord | null) ?? null;
  }

  private async resolvePublishedVersion(
    configurationTemplateVersionPublicId: string,
  ): Promise<{ id: bigint; publicId: string; version: string }> {
    const record = await this.database.client.configurationTemplateVersion.findUnique({
      where: { publicId: configurationTemplateVersionPublicId },
      select: { id: true, publicId: true, version: true, status: true },
    });
    if (!record) {
      throw new NotFoundException(
        `Configuration template version "${configurationTemplateVersionPublicId}" was not found.`,
      );
    }
    if (record.status !== ConfigurationVersionStatus.PUBLISHED) {
      throw new NotFoundException(
        `Configuration template version "${configurationTemplateVersionPublicId}" is not published (status: ${record.status}).`,
      );
    }
    return record;
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

  async getActiveAssignment(
    userPublicId: string,
    businessPublicId: string,
  ): Promise<ActiveAssignmentSummary> {
    const access = await this.resolveAccess(userPublicId, businessPublicId);
    return this.database.withScope(access, async (transaction) => {
      const assignment = await this.findCurrentPrimary(transaction, access);
      if (!assignment) {
        throw new NotFoundException(
          "No primary configuration assignment is active for this business.",
        );
      }
      const version = await transaction.configurationTemplateVersion.findUniqueOrThrow({
        where: { id: assignment.configurationTemplateVersionId },
        select: { snapshotJson: true },
      });
      return {
        ...summarizeAssignment(assignment),
        businessId: access.businessPublicId,
        snapshot: parseSnapshot(version.snapshotJson),
      };
    });
  }

  async getEnabledModules(
    userPublicId: string,
    businessPublicId: string,
  ): Promise<EnabledModuleSummary[]> {
    const access = await this.resolveAccess(userPublicId, businessPublicId);
    return this.database.withScope(access, async (transaction) => {
      const assignment = await this.findCurrentPrimary(transaction, access);
      if (!assignment) {
        return [];
      }
      const version = await transaction.configurationTemplateVersion.findUniqueOrThrow({
        where: { id: assignment.configurationTemplateVersionId },
        select: { snapshotJson: true },
      });
      const snapshot = parseSnapshot(version.snapshotJson);
      const enabledCodes = snapshot.modules
        .filter((module) => module.enabled)
        .map((module) => module.code);

      if (enabledCodes.length === 0) {
        return [];
      }

      const moduleRows = await transaction.moduleDefinition.findMany({
        where: {
          code: { in: enabledCodes },
          implemented: true,
          status: "ACTIVE",
        },
        select: {
          code: true,
          name: true,
          description: true,
          implemented: true,
          status: true,
        },
      });

      return moduleRows.map(
        (row: {
          code: string;
          name: string;
          description: string | null;
          implemented: boolean;
          status: "ACTIVE" | "INACTIVE";
        }) => ({
          code: row.code,
          name: row.name,
          description: row.description,
          implemented: row.implemented,
          status: row.status,
        }),
      );
    });
  }

  private async resolveAccess(
    userPublicId: string,
    businessPublicId: string,
  ): Promise<BusinessAccessContext> {
    return this.businessAccess.resolve(userPublicId, businessPublicId);
  }

  async createDocumentWorkflowContext(
    input: CreateDocumentWorkflowContextInput,
  ): Promise<DocumentWorkflowContextSummary> {
    const access = await this.resolveAccess(input.userPublicId, input.businessPublicId);

    return this.database.withScope(access, async (transaction) => {
      const document = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: input.documentId,
        },
        select: { id: true, type: true },
      });
      if (!document) {
        throw new NotFoundException(
          `Document "${input.documentId}" was not found in this business.`,
        );
      }

      const existing = await transaction.documentWorkflowContext.findUnique({
        where: { documentId: document.id },
      });
      if (existing) {
        return this.mapWorkflowContext(existing, input.documentId);
      }

      const assignment = await this.findCurrentPrimary(transaction, access);
      if (!assignment) {
        throw new NotFoundException(
          "No primary configuration assignment is active for this business.",
        );
      }

      const version = await transaction.configurationTemplateVersion.findUniqueOrThrow({
        where: { id: assignment.configurationTemplateVersionId },
        select: { snapshotJson: true, publicId: true },
      });
      const snapshot = parseSnapshot(version.snapshotJson);
      const documentType = input.documentType;

      const workflowRef = snapshot.workflows.find((ref) => ref.documentType === documentType);

      let workflowTemplateVersionId: bigint | null = null;
      if (workflowRef) {
        const workflowVersion = await transaction.workflowTemplateVersion.findFirst({
          where: {
            workflowTemplate: { code: workflowRef.workflowTemplateCode },
            status: WorkflowVersionStatus.PUBLISHED,
          },
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true, publicId: true, definitionJson: true },
        });
        if (!workflowVersion) {
          throw new NotFoundException(
            `No published workflow template version found for code "${workflowRef.workflowTemplateCode}".`,
          );
        }
        workflowTemplateVersionId = workflowVersion.id;
      }

      const capturedSnapshot = this.buildCapturedSnapshot(snapshot, documentType);

      const created = await transaction.documentWorkflowContext.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          documentId: document.id,
          configurationTemplateVersionId: assignment.configurationTemplateVersionId,
          workflowTemplateVersionId,
          documentType,
          workflowState: null,
          capturedSnapshotJson: capturedSnapshot as Prisma.InputJsonValue,
        },
      });

      await transaction.configurationAuditEvent.create({
        data: {
          tenantId: access.tenantId,
          actorMembershipId: access.membershipId,
          actorSystemAdminId: null,
          action: "CREATE",
          entityType: "DocumentWorkflowContext",
          entityId: created.id,
          beforeJson: null,
          afterJson: {
            documentId: input.documentId,
            configurationTemplateVersionId: version.publicId,
            documentType,
            workflowTemplateVersionId: workflowTemplateVersionId
              ? workflowTemplateVersionId.toString(10)
              : null,
          } as Prisma.InputJsonValue,
          diffJson: null,
          reason: "Document workflow context captured.",
        },
      });

      return this.mapWorkflowContext(created, input.documentId);
    });
  }

  private buildCapturedSnapshot(
    snapshot: ConfigurationSnapshot,
    documentType: string,
  ): Record<string, unknown> {
    return {
      modules: snapshot.modules,
      workflows: snapshot.workflows.filter((ref) => ref.documentType === documentType),
      terminology: snapshot.terminology,
      numbering: snapshot.numbering,
      documentTemplates: snapshot.documentTemplates.filter(
        (ref) => ref.documentType === documentType,
      ),
      currency: snapshot.currency,
      tax: snapshot.tax,
    } as Record<string, unknown>;
  }

  private mapWorkflowContext(
    record: {
      id: bigint;
      publicId: string;
      configurationTemplateVersionId: bigint;
      workflowTemplateVersionId: bigint | null;
      documentType: string;
      workflowState: string | null;
      capturedSnapshotJson: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    documentPublicId: string,
  ): DocumentWorkflowContextSummary {
    return {
      id: record.publicId,
      documentId: documentPublicId,
      documentType: record.documentType,
      configurationTemplateVersionId: record.configurationTemplateVersionId.toString(10),
      workflowTemplateVersionId: record.workflowTemplateVersionId
        ? record.workflowTemplateVersionId.toString(10)
        : null,
      workflowState: record.workflowState,
      capturedSnapshot: (record.capturedSnapshotJson as Record<string, unknown>) ?? {},
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async getWorkflowState(
    userPublicId: string,
    businessPublicId: string,
    documentPublicId: string,
  ): Promise<string | null> {
    const access = await this.resolveAccess(userPublicId, businessPublicId);
    return this.database.withScope(access, async (transaction) => {
      const context = await this.findWorkflowContext(transaction, access, documentPublicId);
      return context?.workflowState ?? null;
    });
  }

  async getDocumentWorkflowContextSummary(
    userPublicId: string,
    businessPublicId: string,
    documentPublicId: string,
  ): Promise<DocumentWorkflowContextSummary | null> {
    const access = await this.resolveAccess(userPublicId, businessPublicId);
    return this.database.withScope(access, async (transaction) => {
      const document = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: documentPublicId,
        },
        select: { id: true },
      });
      if (!document) {
        return null;
      }
      const context = await transaction.documentWorkflowContext.findUnique({
        where: { documentId: document.id },
      });
      return context ? this.mapWorkflowContext(context, documentPublicId) : null;
    });
  }

  async listAvailableTransitions(input: ListAvailableTransitionsInput): Promise<
    Array<{
      action: string;
      toState: string;
      allowedRoles: string[];
      evaluation: TransitionEvaluation;
    }>
  > {
    const access = await this.resolveAccess(input.userPublicId, input.businessPublicId);
    return this.database.withScope(access, async (transaction) => {
      const context = await this.findWorkflowContext(transaction, access, input.documentId);
      if (!context || !context.workflowTemplateVersionId) {
        return [];
      }
      const workflowVersion = (await transaction.workflowTemplateVersion.findUnique({
        where: { id: context.workflowTemplateVersionId },
        select: { definitionJson: true },
      })) as unknown as WorkflowTemplateVersionRecord | null;
      if (!workflowVersion) {
        return [];
      }
      const definition = parseWorkflowDefinition(workflowVersion.definitionJson);
      const fromState = context.workflowState;
      const matching = definition.transitions.filter(
        (transition) => transition.fromState === fromState,
      );
      if (matching.length === 0) {
        return [];
      }
      const guardContext = await this.buildGuardContext(
        transaction,
        access,
        input.documentId,
        context,
      );

      return matching.map((transition) => {
        let evaluation: TransitionEvaluation;
        if (!this.isRoleAllowed(access, transition.allowedRoles)) {
          evaluation = {
            allowed: false,
            reason: `Role "${access.role}" is not allowed to perform action "${transition.action}".`,
          };
        } else if (transition.guard && transition.guard.length > 0) {
          const guardResult = evaluateGuard(transition.guard, guardContext);
          if (!guardResult.allowed) {
            const failed = guardResult.failedCondition;
            evaluation = {
              allowed: false,
              reason: failed
                ? `Guard failed for field "${failed.field}" with operator "${failed.operator}".`
                : "Guard failed.",
            };
          } else {
            evaluation = { allowed: true, toState: transition.toState };
          }
        } else {
          evaluation = { allowed: true, toState: transition.toState };
        }
        return {
          action: transition.action,
          toState: transition.toState,
          allowedRoles: transition.allowedRoles,
          evaluation,
        };
      });
    });
  }

  async setWorkflowState(input: SetWorkflowStateInput): Promise<void> {
    const access = await this.resolveAccess(input.userPublicId, input.businessPublicId);
    await this.database.withScope(access, async (transaction) => {
      const context = await this.findWorkflowContext(transaction, access, input.documentId);
      if (!context) {
        throw new NotFoundException(
          `No workflow context found for document "${input.documentId}".`,
        );
      }
      const previousState = context.workflowState;
      if (previousState === input.toState) {
        return;
      }
      await transaction.documentWorkflowContext.update({
        where: { id: context.id },
        data: { workflowState: input.toState },
      });
      await transaction.configurationAuditEvent.create({
        data: {
          tenantId: access.tenantId,
          actorMembershipId: access.membershipId,
          actorSystemAdminId: null,
          action: "UPDATE",
          entityType: "DocumentWorkflowContext",
          entityId: context.id,
          beforeJson: { workflowState: previousState } as Prisma.InputJsonValue,
          afterJson: { workflowState: input.toState } as Prisma.InputJsonValue,
          diffJson: computeDiff(
            { workflowState: previousState },
            { workflowState: input.toState },
          ) as Prisma.InputJsonValue,
          reason: input.reason ?? null,
        },
      });
    });
  }

  async evaluateTransition(input: EvaluateTransitionInput): Promise<TransitionEvaluation> {
    const access = await this.resolveAccess(input.userPublicId, input.businessPublicId);
    return this.database.withScope(access, async (transaction) => {
      const context = await this.findWorkflowContext(transaction, access, input.documentId);
      if (!context) {
        return {
          allowed: false,
          reason: `No workflow context found for document "${input.documentId}".`,
        };
      }
      if (!context.workflowTemplateVersionId) {
        return {
          allowed: false,
          reason: "No workflow template is associated with this document.",
        };
      }

      const workflowVersion = (await transaction.workflowTemplateVersion.findUnique({
        where: { id: context.workflowTemplateVersionId },
        select: { definitionJson: true },
      })) as unknown as WorkflowTemplateVersionRecord | null;
      if (!workflowVersion) {
        return {
          allowed: false,
          reason: "The workflow template version for this document is no longer available.",
        };
      }

      const definition = parseWorkflowDefinition(workflowVersion.definitionJson);
      const fromState = context.workflowState;
      const transition = definition.transitions.find(
        (candidate) => candidate.fromState === fromState && candidate.action === input.action,
      );
      if (!transition) {
        return {
          allowed: false,
          reason: `Illegal transition: no transition from state "${fromState ?? "(none)"}" with action "${input.action}".`,
        };
      }

      if (!this.isRoleAllowed(access, transition.allowedRoles)) {
        return {
          allowed: false,
          reason: `Role "${access.role}" is not allowed to perform action "${input.action}" from state "${fromState ?? "(none)"}".`,
        };
      }

      if (transition.guard && transition.guard.length > 0) {
        const guardContext = await this.buildGuardContext(
          transaction,
          access,
          input.documentId,
          context,
        );
        const guardResult = evaluateGuard(transition.guard, guardContext);
        if (!guardResult.allowed) {
          const failed = guardResult.failedCondition as WorkflowGuardCondition | undefined;
          const description = failed
            ? `Guard failed for field "${failed.field}" with operator "${failed.operator}".`
            : "Guard failed.";
          return { allowed: false, reason: description };
        }
      }

      return { allowed: true, toState: transition.toState };
    });
  }

  private isRoleAllowed(access: BusinessAccessContext, allowedRoles: readonly string[]): boolean {
    if (allowedRoles.length === 0) {
      return false;
    }
    return allowedRoles.includes(access.role);
  }

  private async findWorkflowContext(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    documentPublicId: string,
  ): Promise<{
    id: bigint;
    workflowTemplateVersionId: bigint | null;
    workflowState: string | null;
    configurationTemplateVersionId: bigint;
    documentType: string;
  } | null> {
    const document = await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: documentPublicId,
      },
      select: { id: true },
    });
    if (!document) {
      return null;
    }
    const context = await transaction.documentWorkflowContext.findUnique({
      where: { documentId: document.id },
      select: {
        id: true,
        workflowTemplateVersionId: true,
        workflowState: true,
        configurationTemplateVersionId: true,
        documentType: true,
      },
    });
    return context ?? null;
  }

  private async buildGuardContext(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    documentPublicId: string,
    context: {
      workflowState: string | null;
      configurationTemplateVersionId: bigint;
    },
  ): Promise<Record<string, unknown>> {
    const document = await transaction.document.findFirstOrThrow({
      where: {
        businessId: access.businessId,
        publicId: documentPublicId,
      },
      include: {
        linkedPurchaseOrder: {
          select: {
            id: true,
            approvalStatus: true,
            poNumber: true,
            status: true,
          },
        },
      },
    });

    let approvalEvidence: { id: bigint } | null = null;
    if (document.purchaseOrderId) {
      approvalEvidence = await transaction.storedObject.findFirst({
        where: {
          businessId: access.businessId,
          purchaseOrderId: document.purchaseOrderId,
          kind: StoredObjectKind.APPROVAL_EVIDENCE,
          supersededAt: null,
        },
        select: { id: true },
      });
    }

    return {
      document: {
        status: document.status,
        type: document.type,
      },
      purchaseOrder: document.linkedPurchaseOrder
        ? {
            approvalStatus: document.linkedPurchaseOrder.approvalStatus,
            poNumber: document.linkedPurchaseOrder.poNumber,
            status: document.linkedPurchaseOrder.status,
          }
        : null,
      approvalEvidence: approvalEvidence ?? null,
      workflowState: context.workflowState,
    };
  }
}

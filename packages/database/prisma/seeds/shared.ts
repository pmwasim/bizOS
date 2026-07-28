// Phase 5/6 — Shared seed types and helpers.
//
// The seed system is split into pure data (exported constants) and writer functions
// that take a PrismaClient. This separation lets tests validate the data shape and
// idempotency logic without a live database, and lets the seed entry point pass a
// real Prisma client.

import type { PrismaClient } from "../../generated/client/client.js";

// A minimal structural interface for the subset of Prisma operations the seeds use.
// We type against the generated PrismaClient so callers get full type safety, but the
// writer functions only rely on the operations declared below. Tests can substitute a
// mock that satisfies this shape.
export type SeedClient = Pick<
  PrismaClient,
  | "moduleDefinition"
  | "configurationTemplate"
  | "configurationTemplateVersion"
  | "workflowTemplate"
  | "workflowTemplateVersion"
>;

export interface SeedResult {
  modules: number;
  configurationTemplates: number;
  configurationTemplateVersions: number;
  workflowTemplates: number;
  workflowTemplateVersions: number;
  skippedPublished: string[];
}

export function emptySeedResult(): SeedResult {
  return {
    modules: 0,
    configurationTemplates: 0,
    configurationTemplateVersions: 0,
    workflowTemplates: 0,
    workflowTemplateVersions: 0,
    skippedPublished: [],
  };
}

export function mergeSeedResult(base: SeedResult, add: SeedResult): SeedResult {
  return {
    modules: base.modules + add.modules,
    configurationTemplates: base.configurationTemplates + add.configurationTemplates,
    configurationTemplateVersions:
      base.configurationTemplateVersions + add.configurationTemplateVersions,
    workflowTemplates: base.workflowTemplates + add.workflowTemplates,
    workflowTemplateVersions: base.workflowTemplateVersions + add.workflowTemplateVersions,
    skippedPublished: [...base.skippedPublished, ...add.skippedPublished],
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function recordPublishedSkip(
  skipped: string[],
  key: string,
  kind: "workflow" | "configuration",
  version: string,
): void {
  skipped.push(key);
  // eslint-disable-next-line no-console
  console.log(`[seed] Skipped immutable PUBLISHED ${kind} version ${version} (already published).`);
}

// Upsert a PUBLISHED workflow template version. If a PUBLISHED version already exists,
// it is immutable: we do NOT overwrite definitionJson. We log and record the skip so the
// caller can report it. DRAFT versions are updated to PUBLISHED with the new definition.
export async function upsertPublishedWorkflowVersion(
  prisma: SeedClient,
  args: {
    workflowTemplateId: bigint;
    version: string;
    definition: unknown;
    skipped: string[];
  },
): Promise<void> {
  const where = {
    workflowTemplateId_version: {
      workflowTemplateId: args.workflowTemplateId,
      version: args.version,
    },
  } as const;
  const skipKey = `workflow:${args.workflowTemplateId}:${args.version}`;

  const existing = await prisma.workflowTemplateVersion.findUnique({
    where,
    select: { id: true, status: true },
  });

  if (existing?.status === "PUBLISHED") {
    recordPublishedSkip(args.skipped, skipKey, "workflow", args.version);
    return;
  }

  const now = new Date();
  const publishedData = {
    status: "PUBLISHED" as const,
    definitionJson: args.definition as object,
    publishedAt: now,
    retiredAt: null,
  };

  if (existing) {
    await prisma.workflowTemplateVersion.update({
      where: { id: existing.id },
      data: publishedData,
    });
    return;
  }

  try {
    await prisma.workflowTemplateVersion.create({
      data: {
        workflowTemplateId: args.workflowTemplateId,
        version: args.version,
        ...publishedData,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const raced = await prisma.workflowTemplateVersion.findUnique({
      where,
      select: { id: true, status: true },
    });
    if (raced?.status === "PUBLISHED") {
      recordPublishedSkip(args.skipped, skipKey, "workflow", args.version);
      return;
    }
    if (raced) {
      await prisma.workflowTemplateVersion.update({
        where: { id: raced.id },
        data: publishedData,
      });
      return;
    }
    throw error;
  }
}

// Upsert a PUBLISHED configuration template version. Same immutability rule as above:
// a PUBLISHED version's snapshotJson is never overwritten.
export async function upsertPublishedConfigurationVersion(
  prisma: SeedClient,
  args: {
    templateId: bigint;
    version: string;
    snapshot: unknown;
    skipped: string[];
  },
): Promise<void> {
  const where = {
    templateId_version: {
      templateId: args.templateId,
      version: args.version,
    },
  } as const;
  const skipKey = `configuration:${args.templateId}:${args.version}`;

  const existing = await prisma.configurationTemplateVersion.findUnique({
    where,
    select: { id: true, status: true },
  });

  if (existing?.status === "PUBLISHED") {
    recordPublishedSkip(args.skipped, skipKey, "configuration", args.version);
    return;
  }

  const now = new Date();
  const publishedData = {
    status: "PUBLISHED" as const,
    snapshotJson: args.snapshot as object,
    publishedAt: now,
    retiredAt: null,
  };

  if (existing) {
    await prisma.configurationTemplateVersion.update({
      where: { id: existing.id },
      data: publishedData,
    });
    return;
  }

  try {
    await prisma.configurationTemplateVersion.create({
      data: {
        templateId: args.templateId,
        version: args.version,
        ...publishedData,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const raced = await prisma.configurationTemplateVersion.findUnique({
      where,
      select: { id: true, status: true },
    });
    if (raced?.status === "PUBLISHED") {
      recordPublishedSkip(args.skipped, skipKey, "configuration", args.version);
      return;
    }
    if (raced) {
      await prisma.configurationTemplateVersion.update({
        where: { id: raced.id },
        data: publishedData,
      });
      return;
    }
    throw error;
  }
}

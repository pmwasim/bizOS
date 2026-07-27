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
  const existing = await prisma.workflowTemplateVersion.findUnique({
    where: {
      workflowTemplateId_version: {
        workflowTemplateId: args.workflowTemplateId,
        version: args.version,
      },
    },
    select: { id: true, status: true },
  });

  if (existing?.status === "PUBLISHED") {
    const key = `workflow:${args.workflowTemplateId}:${args.version}`;
    args.skipped.push(key);
    // eslint-disable-next-line no-console
    console.log(
      `[seed] Skipped immutable PUBLISHED workflow version ${args.version} (already published).`,
    );
    return;
  }

  const now = new Date();
  if (existing) {
    await prisma.workflowTemplateVersion.update({
      where: { id: existing.id },
      data: {
        status: "PUBLISHED",
        definitionJson: args.definition as object,
        publishedAt: now,
        retiredAt: null,
      },
    });
    return;
  }

  await prisma.workflowTemplateVersion.create({
    data: {
      workflowTemplateId: args.workflowTemplateId,
      version: args.version,
      status: "PUBLISHED",
      definitionJson: args.definition as object,
      publishedAt: now,
      retiredAt: null,
    },
  });
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
  const existing = await prisma.configurationTemplateVersion.findUnique({
    where: {
      templateId_version: {
        templateId: args.templateId,
        version: args.version,
      },
    },
    select: { id: true, status: true },
  });

  if (existing?.status === "PUBLISHED") {
    const key = `configuration:${args.templateId}:${args.version}`;
    args.skipped.push(key);
    // eslint-disable-next-line no-console
    console.log(
      `[seed] Skipped immutable PUBLISHED configuration version ${args.version} (already published).`,
    );
    return;
  }

  const now = new Date();
  if (existing) {
    await prisma.configurationTemplateVersion.update({
      where: { id: existing.id },
      data: {
        status: "PUBLISHED",
        snapshotJson: args.snapshot as object,
        publishedAt: now,
        retiredAt: null,
      },
    });
    return;
  }

  await prisma.configurationTemplateVersion.create({
    data: {
      templateId: args.templateId,
      version: args.version,
      status: "PUBLISHED",
      snapshotJson: args.snapshot as object,
      publishedAt: now,
      retiredAt: null,
    },
  });
}

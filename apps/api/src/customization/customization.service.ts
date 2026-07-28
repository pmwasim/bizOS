// Phase 11 — Business-scoped customization request service.
//
// Captures durable customization requests from Business Admins, including the
// active configuration template version at submission time. Tenant isolation is
// enforced via BusinessAccessService and DatabaseService.withScope.

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type BusinessCustomizationRequestSummary,
  type CreateCustomizationRequest,
  type ListBusinessCustomizationRequestsResponse,
} from "@bizo/contracts/customization";
import { type Prisma } from "@bizo/database";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
import { notifyCustomizationRequestCreated } from "./n8n-notifier.js";

export interface CreateCustomizationRequestInput extends CreateCustomizationRequest {
  userPublicId: string;
  businessPublicId: string;
}

export interface GetCustomizationRequestInput {
  userPublicId: string;
  businessPublicId: string;
  requestId: string;
}

export interface ListCustomizationRequestsInput {
  userPublicId: string;
  businessPublicId: string;
}

interface CustomizationRequestRecord {
  publicId: string;
  statedProcessJson: unknown;
  requestedChangesJson: unknown;
  notesJson: unknown | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  consentToReview: boolean;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  business: { publicId: string };
  requesterMembership: { publicId: string };
  currentConfigurationTemplateVersion: { publicId: string } | null;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapRequest(record: CustomizationRequestRecord): BusinessCustomizationRequestSummary {
  const notes = record.notesJson ? jsonRecord(record.notesJson) : undefined;
  return {
    id: record.publicId,
    businessId: record.business.publicId,
    requesterMembershipId: record.requesterMembership.publicId,
    currentConfigurationTemplateVersionId:
      record.currentConfigurationTemplateVersion?.publicId ?? null,
    statedProcess: jsonRecord(record.statedProcessJson),
    requestedChanges: jsonRecord(record.requestedChangesJson),
    urgency: record.urgency,
    notes: notes && Object.keys(notes).length > 0 ? notes : undefined,
    consentToReview: record.consentToReview,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const requestInclude = {
  business: { select: { publicId: true } },
  requesterMembership: { select: { publicId: true } },
  currentConfigurationTemplateVersion: { select: { publicId: true } },
} as const;

@Injectable()
export class CustomizationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
    @Inject(ConfigurationService) private readonly configuration: ConfigurationService,
  ) {}

  async createRequest(
    input: CreateCustomizationRequestInput,
  ): Promise<BusinessCustomizationRequestSummary> {
    if (!input.consentToReview) {
      throw new BadRequestException({
        code: "CONSENT_REQUIRED",
        detail: "You must consent to a configuration review before submitting this request.",
      });
    }

    const access = await this.businessAccess.resolve(input.userPublicId, input.businessPublicId);
    const configVersionId = await this.resolveActiveConfigurationVersionId(
      input.userPublicId,
      input.businessPublicId,
    );

    const statedProcessJson = { text: input.statedProcess };
    const requestedChangesJson = { text: input.requestedChanges };
    const notesJson = input.notes ? { text: input.notes } : null;

    const created = await this.database.withScope(access, async (transaction) => {
      return transaction.customizationRequest.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          requesterMembershipId: access.membershipId,
          currentConfigurationTemplateVersionId: configVersionId,
          statedProcessJson: statedProcessJson as Prisma.InputJsonValue,
          requestedChangesJson: requestedChangesJson as Prisma.InputJsonValue,
          notesJson: notesJson as Prisma.InputJsonValue | null,
          urgency: input.urgency,
          consentToReview: true,
          status: "OPEN",
        },
        include: requestInclude,
      });
    });

    void notifyCustomizationRequestCreated({
      id: created.publicId,
      tenantId: access.tenantPublicId,
      businessId: access.businessPublicId,
      urgency: created.urgency,
      status: created.status,
      currentConfigurationTemplateVersionId:
        created.currentConfigurationTemplateVersion?.publicId ?? null,
      createdAt: created.createdAt.toISOString(),
    }).catch(() => undefined);

    return mapRequest(created as CustomizationRequestRecord);
  }

  async getRequest(
    input: GetCustomizationRequestInput,
  ): Promise<BusinessCustomizationRequestSummary> {
    const access = await this.businessAccess.resolve(input.userPublicId, input.businessPublicId);
    const record = await this.database.withScope(access, async (transaction) => {
      return transaction.customizationRequest.findFirst({
        where: {
          publicId: input.requestId,
          businessId: access.businessId,
        },
        include: requestInclude,
      });
    });

    if (!record) {
      throw new NotFoundException("We could not find that customization request.");
    }

    return mapRequest(record as CustomizationRequestRecord);
  }

  async listRequests(
    input: ListCustomizationRequestsInput,
  ): Promise<ListBusinessCustomizationRequestsResponse> {
    const access = await this.businessAccess.resolve(input.userPublicId, input.businessPublicId);
    const records = await this.database.withScope(access, async (transaction) => {
      return transaction.customizationRequest.findMany({
        where: { businessId: access.businessId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: requestInclude,
      });
    });

    return {
      items: records.map((record: CustomizationRequestRecord) => mapRequest(record)),
    };
  }

  private async resolveActiveConfigurationVersionId(
    userPublicId: string,
    businessPublicId: string,
  ): Promise<bigint | null> {
    try {
      const assignment = await this.configuration.getActiveAssignment(
        userPublicId,
        businessPublicId,
      );
      const version = await this.database.client.configurationTemplateVersion.findUnique({
        where: { publicId: assignment.configurationTemplateVersionId },
        select: { id: true },
      });
      return version?.id ?? null;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }
}

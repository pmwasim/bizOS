import { Inject, Injectable } from "@nestjs/common";

import { randomBytes } from "node:crypto";

import { DatabaseService } from "../database/database.service.js";

export interface ApiKey {
  id: string;
  businessId: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreateApiKeyInput {
  businessPublicId: string;
  name: string;
  scopes: string[];
}

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(input: CreateApiKeyInput): Promise<{ apiKey: ApiKey; secret: string }> {
    const secret = `bzo_${randomBytes(32).toString("hex")}`;
    const secretHash = randomBytes(32).toString("hex");

    const business = await this.database.client.business.findUnique({
      where: { publicId: input.businessPublicId },
      select: { id: true, tenantId: true },
    });
    if (!business) throw new Error("Business not found");

    const record = await this.database.client.apiKey.create({
      data: {
        tenantId: business.tenantId,
        businessId: business.id,
        name: input.name,
        secretHash,
        scopes: input.scopes,
      },
    });

    return {
      apiKey: {
        id: record.publicId,
        businessId: input.businessPublicId,
        name: record.name,
        scopes: record.scopes,
        createdAt: record.createdAt.toISOString(),
        lastUsedAt: null,
      },
      secret,
    };
  }

  async list(businessPublicId: string): Promise<ApiKey[]> {
    const business = await this.database.client.business.findUnique({
      where: { publicId: businessPublicId },
      select: { id: true },
    });
    if (!business) return [];

    const records = await this.database.client.apiKey.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });
    return records.map(
      (r: {
        publicId: string;
        name: string;
        scopes: string[];
        createdAt: Date;
        lastUsedAt: Date | null;
      }) => ({
        id: r.publicId,
        businessId: businessPublicId,
        name: r.name,
        scopes: r.scopes,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      }),
    );
  }
}

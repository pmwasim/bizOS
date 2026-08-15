import { Inject, Injectable } from "@nestjs/common";

import { createHash, randomBytes } from "node:crypto";

import { DatabaseService } from "../database/database.service.js";

export interface ApiKey {
  id: string;
  businessId: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * The stored form of an API key secret.
 *
 * A single SHA-256 pass is the right primitive here, and deliberately not Argon2: the secret is 32
 * bytes of CSPRNG output rather than a human-chosen password, so there is no dictionary to slow
 * down, and verification sits on a hot request path.
 */
export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
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
    // Store a hash *of the credential we hand back*. Storing an independent random string, as this
    // did, leaves no way for any verifier to recognise the key the caller was given: every issued
    // key would fail authentication the moment a verification path exists.
    const secretHash = hashApiKeySecret(secret);

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

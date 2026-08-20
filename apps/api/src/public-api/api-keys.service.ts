import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  type ApiKey,
  type ApiScope,
  apiScopeSchema,
  type CreateApiKeyRequest,
  type IssuedApiKey,
} from "@bizo/contracts/api-keys";
import { ApiKeyStatus } from "@bizo/database";

import {
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { DatabaseService } from "../database/database.service.js";
import { type ApiKeyPrincipal } from "./api-key-principal.js";

/** All issued secrets carry this prefix so a leaked value is recognisable in logs/scanners. */
const SECRET_PREFIX = "bzo_";
/** Characters of the secret retained as the public, non-secret lookup identifier. */
const PUBLIC_PREFIX_LENGTH = 12;

/**
 * The stored form of an API key secret.
 *
 * A single SHA-256 pass is the right primitive here, and deliberately not Argon2/bcrypt: the secret
 * is 24 bytes of CSPRNG output rather than a human-chosen password, so there is no dictionary to
 * slow down, and verification sits on a hot request path. The repo's *password* hashing (Argon2)
 * protects low-entropy human input; that trade-off does not apply to a full-entropy machine token.
 */
export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Constant-time comparison of a presented secret against a stored hash. Both operands are fixed
 * 64-char hex SHA-256 digests, so lengths always match and `timingSafeEqual` never leaks via an
 * early length mismatch.
 */
export function verifyApiKeySecret(presentedSecret: string, storedHash: string): boolean {
  const presentedHash = hashApiKeySecret(presentedSecret);
  const a = Buffer.from(presentedHash, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

interface GeneratedSecret {
  secret: string;
  prefix: string;
  secretHash: string;
}

function generateSecret(): GeneratedSecret {
  const secret = `${SECRET_PREFIX}${randomBytes(24).toString("hex")}`;
  return {
    secret,
    prefix: secret.slice(0, PUBLIC_PREFIX_LENGTH),
    secretHash: hashApiKeySecret(secret),
  };
}

function derivePrefix(rawKey: string): string {
  return rawKey.slice(0, PUBLIC_PREFIX_LENGTH);
}

interface ApiKeyRecord {
  publicId: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

function onlyKnownScopes(scopes: readonly string[]): ApiScope[] {
  return scopes.filter((scope): scope is ApiScope => apiScopeSchema.safeParse(scope).success);
}

function toApiKey(record: ApiKeyRecord): ApiKey {
  return {
    id: record.publicId,
    name: record.name,
    prefix: record.prefix,
    scopes: onlyKnownScopes(record.scopes),
    status: record.status,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateApiKeyRequest,
  ): Promise<IssuedApiKey> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    const generated = generateSecret();

    const record = await this.database.client.apiKey.create({
      data: {
        tenantId: access.tenantId,
        businessId: access.businessId,
        name: input.name,
        prefix: generated.prefix,
        secretHash: generated.secretHash,
        scopes: input.scopes,
        status: ApiKeyStatus.ACTIVE,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    return { ...toApiKey(record), secret: generated.secret };
  }

  async list(userPublicId: string, businessPublicId: string): Promise<ApiKey[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    const records = await this.database.client.apiKey.findMany({
      where: { tenantId: access.tenantId, businessId: access.businessId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toApiKey);
  }

  /**
   * Rotates a key: issues a fresh secret on the same key record and re-activates it. The previous
   * secret stops authenticating immediately because its hash is overwritten. The new plaintext is
   * returned once, exactly as at creation.
   */
  async rotate(
    userPublicId: string,
    businessPublicId: string,
    keyPublicId: string,
  ): Promise<IssuedApiKey> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    const existing = await this.findScopedKey(access, keyPublicId);
    const generated = generateSecret();

    const record = await this.database.client.apiKey.update({
      where: { id: existing.id },
      data: {
        prefix: generated.prefix,
        secretHash: generated.secretHash,
        status: ApiKeyStatus.ACTIVE,
        lastUsedAt: null,
      },
    });

    return { ...toApiKey(record), secret: generated.secret };
  }

  /** Revokes a key. Revocation is terminal: the key can never authenticate again (fail-closed). */
  async revoke(
    userPublicId: string,
    businessPublicId: string,
    keyPublicId: string,
  ): Promise<ApiKey> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    const existing = await this.findScopedKey(access, keyPublicId);

    const record = await this.database.client.apiKey.update({
      where: { id: existing.id },
      data: { status: ApiKeyStatus.REVOKED },
    });

    return toApiKey(record);
  }

  /**
   * Resolves a presented raw key to its principal, or `null` if authentication must fail. Every
   * failure path — unknown prefix, hash mismatch, revoked, or expired — returns `null` so callers
   * fail closed and cannot distinguish the reason. On success, `lastUsedAt` is stamped.
   */
  async authenticate(rawKey: string, now: Date = new Date()): Promise<ApiKeyPrincipal | null> {
    if (!rawKey.startsWith(SECRET_PREFIX)) {
      return null;
    }

    const candidates = await this.database.client.apiKey.findMany({
      where: { prefix: derivePrefix(rawKey), status: ApiKeyStatus.ACTIVE },
      include: { business: { select: { publicId: true } } },
    });

    for (const candidate of candidates) {
      if (!verifyApiKeySecret(rawKey, candidate.secretHash)) {
        continue;
      }
      // Fail closed on expiry. A null expiresAt means the key never expires.
      if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      await this.database.client.apiKey.update({
        where: { id: candidate.id },
        data: { lastUsedAt: now },
      });

      return {
        keyId: candidate.publicId,
        businessId: candidate.businessId,
        businessPublicId: candidate.business.publicId,
        tenantId: candidate.tenantId,
        scopes: onlyKnownScopes(candidate.scopes),
      };
    }

    return null;
  }

  private async findScopedKey(
    access: BusinessAccessContext,
    keyPublicId: string,
  ): Promise<{ id: bigint }> {
    const existing = await this.database.client.apiKey.findFirst({
      where: {
        publicId: keyPublicId,
        tenantId: access.tenantId,
        businessId: access.businessId,
      },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException("We could not find that API key.");
    }
    return existing;
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: "create" | "read" | "update",
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "api_keys", action);
    return access;
  }
}

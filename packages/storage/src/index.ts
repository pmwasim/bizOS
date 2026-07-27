import { S3Client } from "@aws-sdk/client-s3";

export interface R2Configuration {
  accessKeyId: string;
  accountId: string;
  secretAccessKey: string;
  /** Optional override. Defaults to `https://{accountId}.r2.cloudflarestorage.com`. */
  endpoint?: string;
}

export function createR2Client(configuration: R2Configuration): S3Client {
  const endpoint =
    configuration.endpoint?.replace(/\/$/, "") ??
    `https://${configuration.accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
    endpoint,
    region: "auto",
  });
}

export function objectKey(tenantId: string, businessId: string, objectId: string): string {
  const segment = /^[a-zA-Z0-9_-]{1,128}$/;
  for (const value of [tenantId, businessId, objectId]) {
    if (!segment.test(value)) {
      throw new Error(
        "Object key segments may contain only letters, numbers, underscores, and hyphens.",
      );
    }
  }
  return `tenants/${tenantId}/businesses/${businessId}/objects/${objectId}`;
}

export function quotationPdfObjectKey(input: {
  tenantId: string;
  businessId: string;
  quotationId: string;
  versionId: string;
}): string {
  const segment = /^[a-zA-Z0-9_-]{1,128}$/;
  for (const value of Object.values(input)) {
    if (!segment.test(value)) {
      throw new Error(
        "Object key segments may contain only letters, numbers, underscores, and hyphens.",
      );
    }
  }
  return `tenants/${input.tenantId}/businesses/${input.businessId}/quotations/${input.quotationId}/versions/${input.versionId}/quotation.pdf`;
}

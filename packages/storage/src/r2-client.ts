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

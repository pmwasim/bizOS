import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  type S3Client,
} from "@aws-sdk/client-s3";

import { createR2Client, type R2Configuration } from "./r2-client.js";

export { createR2Client, type R2Configuration } from "./r2-client.js";

const SEGMENT = /^[a-zA-Z0-9_-]{1,128}$/;
const SAFE_FILENAME = /^[a-zA-Z0-9._-]{1,180}$/;

export const MAX_STORED_OBJECT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedUploadContentType = (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

export interface ObjectStorePutInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface ObjectStoreGetResult {
  body: Buffer;
  contentType?: string | undefined;
}

export interface ObjectStore {
  put(input: ObjectStorePutInput): Promise<void>;
  get(key: string): Promise<ObjectStoreGetResult>;
}

function assertKeySegment(value: string, label: string): void {
  if (!SEGMENT.test(value)) {
    throw new Error(`${label} may contain only letters, numbers, underscores, and hyphens.`);
  }
}

export function objectKey(tenantId: string, businessId: string, objectId: string): string {
  assertKeySegment(tenantId, "tenantId");
  assertKeySegment(businessId, "businessId");
  assertKeySegment(objectId, "objectId");
  return `tenants/${tenantId}/businesses/${businessId}/objects/${objectId}`;
}

export function quotationPdfObjectKey(input: {
  tenantId: string;
  businessId: string;
  quotationId: string;
  versionId: string;
}): string {
  for (const [label, value] of Object.entries(input)) {
    assertKeySegment(value, label);
  }
  return `tenants/${input.tenantId}/businesses/${input.businessId}/quotations/${input.quotationId}/versions/${input.versionId}/quotation.pdf`;
}

export function invoicePdfObjectKey(input: {
  tenantId: string;
  businessId: string;
  invoiceId: string;
  versionId: string;
}): string {
  for (const [label, value] of Object.entries(input)) {
    assertKeySegment(value, label);
  }
  return `tenants/${input.tenantId}/businesses/${input.businessId}/invoices/${input.invoiceId}/versions/${input.versionId}/invoice.pdf`;
}

export function sanitizeUploadFilename(filename: string): string {
  const base = path.basename(filename).replaceAll(/\s+/g, "_");
  const cleaned = base.replaceAll(/[^a-zA-Z0-9._-]/g, "").slice(0, 180);
  if (!cleaned || cleaned === "." || cleaned === ".." || !SAFE_FILENAME.test(cleaned)) {
    return `upload-${randomUUID()}.bin`;
  }
  return cleaned;
}

export function purchaseOrderObjectKey(input: {
  tenantId: string;
  businessId: string;
  purchaseOrderId: string;
  fileId: string;
  kind: "purchase-orders" | "approval-evidence";
  safeFilename: string;
}): string {
  assertKeySegment(input.tenantId, "tenantId");
  assertKeySegment(input.businessId, "businessId");
  assertKeySegment(input.purchaseOrderId, "purchaseOrderId");
  assertKeySegment(input.fileId, "fileId");
  if (!SAFE_FILENAME.test(input.safeFilename)) {
    throw new Error("Filename is not safe for object storage.");
  }
  return `tenants/${input.tenantId}/businesses/${input.businessId}/${input.kind}/${input.purchaseOrderId}/${input.fileId}/${input.safeFilename}`;
}

export function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function detectAllowedContentType(
  body: Uint8Array,
  declaredContentType: string,
): AllowedUploadContentType | null {
  const declared = declaredContentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(declared)) {
    return null;
  }
  if (declared === "application/pdf" && body.length >= 5) {
    const header = Buffer.from(body.subarray(0, 5)).toString("utf8");
    if (header === "%PDF-") return "application/pdf";
  }
  if (declared === "image/png" && body.length >= 8) {
    const sig = Buffer.from(body.subarray(0, 8));
    if (sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return "image/png";
    }
  }
  if (declared === "image/jpeg" && body.length >= 3) {
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  }
  if (declared === "image/webp" && body.length >= 12) {
    const riff = Buffer.from(body.subarray(0, 4)).toString("ascii");
    const webp = Buffer.from(body.subarray(8, 12)).toString("ascii");
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  return null;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "object" && body !== null && "transformToByteArray" in body) {
    const transform = (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray;
    return Buffer.from(await transform());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class LocalObjectStore implements ObjectStore {
  constructor(private readonly rootDirectory: string) {}

  private resolvePath(key: string): string {
    if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
      throw new Error("Object key is not allowed.");
    }
    const absolute = path.resolve(this.rootDirectory, key);
    const root = path.resolve(this.rootDirectory);
    if (!absolute.startsWith(root + path.sep) && absolute !== root) {
      throw new Error("Object key escapes storage root.");
    }
    return absolute;
  }

  async put(input: ObjectStorePutInput): Promise<void> {
    const filePath = this.resolvePath(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
  }

  async get(key: string): Promise<ObjectStoreGetResult> {
    const filePath = this.resolvePath(key);
    const body = await readFile(filePath);
    return { body };
  }
}

export class R2ObjectStore implements ObjectStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(input: ObjectStorePutInput): Promise<void> {
    const commandInput: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: input.key,
      Body: Buffer.from(input.body),
      ContentType: input.contentType,
    };
    await this.client.send(new PutObjectCommand(commandInput));
  }

  async get(key: string): Promise<ObjectStoreGetResult> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    return {
      body: await bodyToBuffer(result.Body),
      contentType: result.ContentType,
    };
  }
}

export function createObjectStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): ObjectStore {
  const mode = String(env.OBJECT_STORE ?? "")
    .trim()
    .toLowerCase();
  const hasR2 =
    Boolean(env.R2_ACCOUNT_ID?.trim()) &&
    Boolean(env.R2_ACCESS_KEY_ID?.trim()) &&
    Boolean(env.R2_SECRET_ACCESS_KEY?.trim()) &&
    Boolean(env.R2_BUCKET?.trim());

  if (mode === "r2" || (mode !== "local" && hasR2)) {
    if (!hasR2) {
      throw new Error(
        "OBJECT_STORE=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
      );
    }
    const configuration: R2Configuration = {
      accountId: String(env.R2_ACCOUNT_ID),
      accessKeyId: String(env.R2_ACCESS_KEY_ID),
      secretAccessKey: String(env.R2_SECRET_ACCESS_KEY),
    };
    const endpoint = env.R2_ENDPOINT?.trim();
    if (endpoint) {
      configuration.endpoint = endpoint;
    }
    return new R2ObjectStore(createR2Client(configuration), String(env.R2_BUCKET));
  }

  if (String(env.NODE_ENV ?? "").trim() === "production" && mode !== "local") {
    throw new Error(
      "Production object storage requires R2 credentials (or OBJECT_STORE=local for explicit non-prod use).",
    );
  }

  const root = String(env.OBJECT_STORE_ROOT ?? ".data/object-store").trim();
  return new LocalObjectStore(root);
}

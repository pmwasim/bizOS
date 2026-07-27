#!/usr/bin/env node

/**
 * Deployment-time R2 validation: put, get, verify, delete a unique probe object.
 * Never logs secret values or object body contents.
 */

import { createHash, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`${name} is required for R2 validation.`);
  }
  return value;
}

function endpointFor(accountId, explicitEndpoint) {
  if (explicitEndpoint) {
    return explicitEndpoint.replace(/\/$/, "");
  }
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

async function bodyToBuffer(body) {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function main() {
  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET");
  const endpoint = endpointFor(accountId, String(process.env.R2_ENDPOINT ?? "").trim());

  console.warn(`R2 bucket=${bucket}`);
  console.warn(`R2 endpoint_host=${new URL(endpoint).host}`);
  console.warn(`R2 access_key_present=${Boolean(accessKeyId)}`);

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    region: "auto",
    forcePathStyle: false,
  });

  const probeId = randomUUID();
  const key = `infrastructure/probes/${probeId}.txt`;
  const payload = Buffer.from(`bizOS R2 probe ${probeId}\n`, "utf8");
  const checksum = createHash("sha256").update(payload).digest("hex");

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: payload,
        ContentType: "text/plain; charset=utf-8",
        Metadata: {
          purpose: "deployment-probe",
          checksum,
        },
      }),
    );
    console.warn("R2 put: ok");

    const fetched = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    const bytes = await bodyToBuffer(fetched.Body);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== checksum || bytes.length !== payload.length) {
      throw new Error("R2 get verification failed: checksum or size mismatch.");
    }
    console.warn("R2 get+verify: ok");
  } finally {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    console.warn("R2 delete: ok");
  }

  console.warn("R2 deployment validation passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

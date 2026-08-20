import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Symmetric encryption for webhook signing secrets.
 *
 * A signing secret is deliberately NOT hashed like an API key: it must be recoverable at dispatch
 * time to recompute the HMAC over each payload. It is therefore encrypted at rest with AES-256-GCM
 * and only ever decrypted inside the dispatcher. The plaintext is never logged or persisted.
 *
 * The 256-bit key is derived from key material in the environment — a dedicated
 * `WEBHOOK_SECRET_ENCRYPTION_KEY` when provided, otherwise the always-present `INTERNAL_AUTH_SECRET`
 * — so no new required environment variable is introduced. Rotating the source material re-keys
 * future encryptions; existing ciphertext must be re-encrypted (or the endpoint's secret rotated).
 */

const VERSION_TAG = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_DERIVATION_LABEL = "bizo.webhook.secret.v1";

/** Derives a stable 32-byte key from the given key material. */
export function deriveWebhookEncryptionKey(keyMaterial: string): Buffer {
  return createHash("sha256").update(`${KEY_DERIVATION_LABEL}:${keyMaterial}`).digest();
}

/** Resolves the encryption key from the process environment, failing closed if none is available. */
export function resolveWebhookEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const material = env.WEBHOOK_SECRET_ENCRYPTION_KEY ?? env.INTERNAL_AUTH_SECRET;
  if (!material || material.length < 16) {
    throw new Error(
      "Webhook secret encryption key material is missing. Set WEBHOOK_SECRET_ENCRYPTION_KEY or INTERNAL_AUTH_SECRET.",
    );
  }
  return deriveWebhookEncryptionKey(material);
}

/** Encrypts a plaintext secret into the compact `v1:<base64(iv|tag|ciphertext)>` form. */
export function encryptWebhookSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${VERSION_TAG}:${Buffer.concat([iv, authTag, ciphertext]).toString("base64")}`;
}

/** Decrypts a value produced by {@link encryptWebhookSecret}. Throws on tampering or wrong key. */
export function decryptWebhookSecret(stored: string, key: Buffer): string {
  const separator = stored.indexOf(":");
  if (separator === -1 || stored.slice(0, separator) !== VERSION_TAG) {
    throw new Error("Unrecognised webhook secret ciphertext.");
  }
  const raw = Buffer.from(stored.slice(separator + 1), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Constant-time equality for two secret strings, used where a caller compares recovered secrets
 * without leaking length/content via early-exit timing.
 */
export function secretsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

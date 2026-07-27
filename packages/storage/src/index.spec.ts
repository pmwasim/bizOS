import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  detectAllowedContentType,
  LocalObjectStore,
  objectKey,
  purchaseOrderObjectKey,
  quotationPdfObjectKey,
  sanitizeUploadFilename,
  sha256Hex,
} from "./index.js";

describe("storage object keys", () => {
  it("builds tenant-safe generic object keys", () => {
    expect(objectKey("tenant-1", "biz-2", "obj-3")).toBe(
      "tenants/tenant-1/businesses/biz-2/objects/obj-3",
    );
  });

  it("builds quotation PDF keys without sequential exposure in the helper itself", () => {
    expect(
      quotationPdfObjectKey({
        tenantId: "t1",
        businessId: "b1",
        quotationId: "q1",
        versionId: "v1",
      }),
    ).toBe("tenants/t1/businesses/b1/quotations/q1/versions/v1/quotation.pdf");
  });

  it("builds purchase-order and approval-evidence keys", () => {
    expect(
      purchaseOrderObjectKey({
        tenantId: "t1",
        businessId: "b1",
        purchaseOrderId: "po1",
        fileId: "f1",
        kind: "purchase-orders",
        safeFilename: "po.pdf",
      }),
    ).toBe("tenants/t1/businesses/b1/purchase-orders/po1/f1/po.pdf");
  });

  it("rejects unsafe key segments", () => {
    expect(() => objectKey("../x", "b", "o")).toThrow(/may contain only letters/);
    expect(() =>
      quotationPdfObjectKey({
        tenantId: "t",
        businessId: "b",
        quotationId: "q/../x",
        versionId: "v",
      }),
    ).toThrow(/may contain only letters/);
  });
});

describe("upload validation helpers", () => {
  it("sanitizes filenames and rejects traversal", () => {
    expect(sanitizeUploadFilename("../../etc/passwd")).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(sanitizeUploadFilename("Customer PO #12.pdf")).toBe("Customer_PO_12.pdf");
  });

  it("accepts PDF magic bytes with matching declared type", () => {
    const body = Buffer.from("%PDF-1.4\n...");
    expect(detectAllowedContentType(body, "application/pdf")).toBe("application/pdf");
    expect(detectAllowedContentType(body, "image/png")).toBeNull();
  });

  it("hashes content stably", () => {
    expect(sha256Hex(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("LocalObjectStore", () => {
  it("puts and gets without path traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bizo-store-"));
    try {
      const store = new LocalObjectStore(root);
      await store.put({
        key: "tenants/t/businesses/b/objects/o1",
        body: Buffer.from("hello"),
        contentType: "text/plain",
      });
      const got = await store.get("tenants/t/businesses/b/objects/o1");
      expect(got.body.toString("utf8")).toBe("hello");
      await expect(store.get("../secret")).rejects.toThrow(/not allowed|escapes/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

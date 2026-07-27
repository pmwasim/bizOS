import { describe, expect, it } from "vitest";

import { objectKey, quotationPdfObjectKey } from "./index.js";

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

  it("rejects unsafe key segments", () => {
    expect(() => objectKey("../x", "b", "o")).toThrow(/Object key segments/);
    expect(() =>
      quotationPdfObjectKey({
        tenantId: "t",
        businessId: "b",
        quotationId: "q/../x",
        versionId: "v",
      }),
    ).toThrow(/Object key segments/);
  });
});

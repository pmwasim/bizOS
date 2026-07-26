import { describe, expect, it } from "vitest";

import { authorize, createAuthorizationEnforcer } from "./index.js";

describe("tenant-scoped authorization", () => {
  it("does not allow a role grant to cross tenant boundaries", async () => {
    const enforcer = await createAuthorizationEnforcer([
      "p, approver, tenant-a:business-a, /documents/*, read|approve, allow",
      "g, user-1, approver, tenant-a:business-a",
    ]);

    await expect(
      authorize(enforcer, {
        action: "approve",
        businessId: "business-a",
        object: "/documents/quote-1",
        subjectId: "user-1",
        tenantId: "tenant-a",
      }),
    ).resolves.toBe(true);

    await expect(
      authorize(enforcer, {
        action: "approve",
        businessId: "business-b",
        object: "/documents/quote-1",
        subjectId: "user-1",
        tenantId: "tenant-b",
      }),
    ).resolves.toBe(false);
  });
});

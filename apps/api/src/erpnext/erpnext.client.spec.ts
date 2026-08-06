import { describe, expect, it, vi } from "vitest";

import { ErpnextClient, ErpnextNotConfiguredError, ErpnextRequestError } from "./erpnext.client.js";

describe("ErpnextClient", () => {
  it("does not attempt a request when the integration is not configured", async () => {
    const fetcher = vi.fn();
    const client = new ErpnextClient(undefined, fetcher);

    await expect(client.getAuthenticatedUser()).rejects.toBeInstanceOf(ErpnextNotConfiguredError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses Frappe token authentication through the supported API boundary", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "bizos.integration@example.test" }), {
        status: 200,
      }),
    );
    const client = new ErpnextClient(
      {
        apiKey: "key",
        apiSecret: "secret",
        baseUrl: "https://erp.example.test/base-path",
      },
      fetcher,
    );

    await expect(client.getAuthenticatedUser()).resolves.toBe("bizos.integration@example.test");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://erp.example.test/api/method/frappe.auth.get_logged_user"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "token key:secret" }),
        method: "GET",
      }),
    );
  });

  it("does not expose an ERP response body when a request fails", async () => {
    const client = new ErpnextClient(
      { apiKey: "key", apiSecret: "secret", baseUrl: "https://erp.example.test" },
      vi.fn().mockResolvedValue(new Response("sensitive upstream detail", { status: 403 })),
    );

    await expect(client.getAuthenticatedUser()).rejects.toEqual(new ErpnextRequestError(403));
  });
});

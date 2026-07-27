import { afterEach, describe, expect, it, vi } from "vitest";

import { mailTransportForTests } from "./mail.service";

describe("mail transport selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Resend HTTPS for smtp.resend.com URLs", () => {
    const transport = mailTransportForTests.createMailTransport(
      "smtps://resend:re_test_key@smtp.resend.com:465",
    );
    expect(transport).toEqual({ kind: "resend-https", apiKey: "re_test_key" });
  });

  it("keeps SMTP transport for local Mailpit", () => {
    const transport = mailTransportForTests.createMailTransport("smtp://localhost:1025");
    expect(transport.kind).toBe("smtp");
  });
});

import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityService } from "./identity.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type MailService } from "../mail/mail.service.js";

const USER = {
  id: 7n,
  publicId: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
  displayName: "Ada Owner",
  locale: "en",
  passwordHash: "argon2-hash",
};

function buildHarness(overrides: { user?: typeof USER | null; grant?: unknown } = {}) {
  const passwordResetToken = {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(overrides.grant ?? null),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const user = {
    findFirst: vi.fn().mockResolvedValue(overrides.user === undefined ? USER : overrides.user),
    update: vi.fn().mockResolvedValue(USER),
  };
  const database = {
    client: {
      user,
      passwordResetToken,
      $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => ops),
    },
  };
  const mail = { sendPasswordReset: vi.fn().mockResolvedValue("message-id") };

  const service = new IdentityService(
    database as unknown as DatabaseService,
    mail as unknown as MailService,
  );
  return { service, database, mail, passwordResetToken, user };
}

describe("IdentityService password reset", () => {
  beforeEach(() => {
    // IdentityService validates the API environment at construction, so the harness needs a
    // complete, valid set here rather than just APP_BASE_URL.
    process.env.APP_BASE_URL = "https://bizos.example.test";
    process.env.DATABASE_URL = "postgresql://bizo:bizo@localhost:5432/bizo_test";
    process.env.INTERNAL_AUTH_SECRET = "x".repeat(32);
    process.env.SMTP_FROM = "quotes@bizo.test";
    process.env.SMTP_URL = "smtp://localhost:1025";
  });

  it("emails a reset link containing a token that is never stored in plain text", async () => {
    const { service, mail, passwordResetToken } = buildHarness();

    await service.requestPasswordReset({ email: USER.email });

    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
    const sent = mail.sendPasswordReset.mock.calls[0]![0] as {
      recipient: string;
      resetUrl: string;
    };
    expect(sent.recipient).toBe(USER.email);

    const token = new URL(sent.resetUrl).searchParams.get("token");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = passwordResetToken.create.mock.calls[0]![0] as {
      data: { tokenHash: string };
    };
    expect(stored.data.tokenHash).toHaveLength(64);
    expect(stored.data.tokenHash).not.toContain(token!);
  });

  it("reports the same result for an unknown email and sends nothing", async () => {
    const { service, mail, passwordResetToken } = buildHarness({ user: null });

    const result = await service.requestPasswordReset({ email: "nobody@example.test" });

    expect(result).toEqual({ status: "accepted" });
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    expect(passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("still reports accepted when the mail transport fails", async () => {
    const { service, mail } = buildHarness();
    mail.sendPasswordReset.mockRejectedValue(new Error("smtp down"));

    await expect(service.requestPasswordReset({ email: USER.email })).resolves.toEqual({
      status: "accepted",
    });
  });

  it("retires outstanding links when a new one is issued", async () => {
    const { service, passwordResetToken } = buildHarness();

    await service.requestPasswordReset({ email: USER.email });

    expect(passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER.id, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("rejects an unknown token", async () => {
    const { service } = buildHarness({ grant: null });

    await expect(
      service.confirmPasswordReset({ token: "a".repeat(43), password: "Sup3rSecret!" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an expired token", async () => {
    const { service } = buildHarness({
      grant: { userId: USER.id, usedAt: null, expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(
      service.confirmPasswordReset({ token: "a".repeat(43), password: "Sup3rSecret!" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a token that was already used", async () => {
    const { service } = buildHarness({
      grant: { userId: USER.id, usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    });

    await expect(
      service.confirmPasswordReset({ token: "a".repeat(43), password: "Sup3rSecret!" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("changes the password and burns the token in one transaction", async () => {
    const { service, database, user, passwordResetToken } = buildHarness({
      grant: { userId: USER.id, usedAt: null, expiresAt: new Date(Date.now() + 60_000) },
    });

    const result = await service.confirmPasswordReset({
      token: "a".repeat(43),
      password: "Sup3rSecret!",
    });

    expect(result).toEqual({ status: "accepted" });
    expect(database.client.$transaction).toHaveBeenCalledTimes(1);
    expect(user.update).toHaveBeenCalledTimes(1);
    expect(passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER.id, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    const updated = user.update.mock.calls[0]![0] as { data: { passwordHash: string } };
    expect(updated.data.passwordHash).toMatch(/^\$argon2id\$/);
  });
});

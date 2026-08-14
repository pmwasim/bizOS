import { randomBytes, createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { argon2id, hash, verify } from "argon2";

import { readApiEnvironment } from "@bizo/config/api";
import {
  type AuthenticatedUser,
  type ConfirmPasswordResetRequest,
  type PasswordResetAccepted,
  type RequestPasswordResetRequest,
  type SignUpRequest,
  type VerifyCredentialsRequest,
} from "@bizo/contracts/auth";
import { type CurrentUserWorkspace } from "@bizo/contracts/platform";
import { MembershipStatus } from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";
import { MailService } from "../mail/mail.service.js";

/** Reset links are deliberately short-lived; a stolen inbox should not stay useful for long. */
const PASSWORD_RESET_TTL_MINUTES = 15;

interface WorkspaceMembership {
  businessAccess: Array<{
    business: {
      baseCurrency: string;
      countryCode: string;
      currencyScale: number;
      locale: string;
      name: string;
      publicId: string;
      tenant: { publicId: string };
      timeZone: string;
    };
    role: { code: "ADMIN" | "MEMBER" | "OWNER" };
  }>;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly appBaseUrl: string;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MailService) private readonly mail: MailService,
  ) {
    // Resolved once at boot so a misconfigured origin fails startup rather than a reset request.
    this.appBaseUrl = readApiEnvironment(process.env).APP_BASE_URL;
  }

  async signUp(input: SignUpRequest): Promise<AuthenticatedUser> {
    const passwordHash = await hash(input.password, { type: argon2id });

    try {
      const user = await this.database.client.user.create({
        data: {
          displayName: input.displayName,
          email: input.email,
          passwordHash,
        },
      });
      return this.toAuthenticatedUser(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: "EMAIL_ALREADY_USED",
          detail: "An account already uses that email address. Try signing in.",
        });
      }
      throw error;
    }
  }

  async verifyCredentials(input: VerifyCredentialsRequest): Promise<AuthenticatedUser> {
    const user = await this.database.client.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
    });
    const valid = user ? await verify(user.passwordHash, input.password) : false;

    if (!user || !valid) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        detail: "That email and password do not match.",
      });
    }

    return this.toAuthenticatedUser(user);
  }

  /**
   * Always resolves to the same accepted result, whether or not the address has an account. Any
   * difference in status, body, or timing here would turn this endpoint into an oracle for which
   * emails are registered.
   */
  async requestPasswordReset(input: RequestPasswordResetRequest): Promise<PasswordResetAccepted> {
    const user = await this.database.client.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
    });

    if (user) {
      // Issuing a new link retires any outstanding one, so a forwarded or leaked earlier email
      // stops working the moment the user asks again.
      await this.database.client.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = randomBytes(32).toString("base64url");
      await this.database.client.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashResetToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
        },
      });

      const resetUrl = new URL("/reset-password", this.appBaseUrl);
      resetUrl.searchParams.set("token", token);

      try {
        await this.mail.sendPasswordReset({
          displayName: user.displayName,
          expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
          recipient: user.email,
          resetUrl: resetUrl.toString(),
        });
      } catch (error) {
        // A mail outage must not reveal that the address exists, so the caller still sees the
        // accepted result. The token simply goes unused and expires.
        this.logger.error(
          `Failed to send password reset email for user ${user.publicId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { status: "accepted" };
  }

  async confirmPasswordReset(input: ConfirmPasswordResetRequest): Promise<PasswordResetAccepted> {
    const tokenHash = this.hashResetToken(input.token);
    const grant = await this.database.client.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!grant || grant.usedAt !== null || grant.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: "INVALID_PASSWORD_RESET_TOKEN",
        detail: "That reset link is no longer valid. Request a new one.",
      });
    }

    const passwordHash = await hash(input.password, { type: argon2id });

    // The password change and the token burn have to land together: committing one without the
    // other either leaves a reusable link or silently drops the reset.
    await this.database.client.$transaction([
      this.database.client.user.update({
        where: { id: grant.userId },
        data: { passwordHash },
      }),
      this.database.client.passwordResetToken.updateMany({
        where: { userId: grant.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return { status: "accepted" };
  }

  private hashResetToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async workspace(userPublicId: string): Promise<CurrentUserWorkspace> {
    const user = await this.database.client.user.findUnique({
      where: { publicId: userPublicId },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: {
            businessAccess: {
              include: {
                business: { include: { tenant: true } },
                role: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Your session is no longer valid. Sign in again.");
    }

    return {
      user: this.toAuthenticatedUser(user),
      businesses: (user.memberships as WorkspaceMembership[]).flatMap((membership) =>
        membership.businessAccess.map(({ business, role }) => ({
          id: business.publicId,
          tenantId: business.tenant.publicId,
          name: business.name,
          countryCode: business.countryCode,
          baseCurrency: business.baseCurrency,
          currencyScale: business.currencyScale,
          locale: business.locale,
          timeZone: business.timeZone,
          role: role.code,
        })),
      ),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }

  private toAuthenticatedUser(user: {
    displayName: string;
    email: string;
    locale: string;
    publicId: string;
  }): AuthenticatedUser {
    return {
      id: user.publicId,
      displayName: user.displayName,
      email: user.email,
      locale: user.locale,
    };
  }
}

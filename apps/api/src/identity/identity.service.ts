import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { argon2id, hash, verify } from "argon2";

import {
  type AuthenticatedUser,
  type SignUpRequest,
  type VerifyCredentialsRequest,
} from "@bizo/contracts/auth";
import { type CurrentUserWorkspace } from "@bizo/contracts/platform";
import { MembershipStatus } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";

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
  constructor(private readonly database: DatabaseService) {}

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

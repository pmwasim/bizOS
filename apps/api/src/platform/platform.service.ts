import { Injectable } from "@nestjs/common";

import {
  type BusinessSettings,
  type BusinessSummary,
  type CreateBusinessRequest,
  type UpdateBusinessSettingsRequest,
} from "@bizo/contracts/platform";
import { parseDecimalToScaledInteger } from "@bizo/contracts/money";
import { RoleCode, type Prisma } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";

const ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  OWNER: ["business.*", "customers.*", "quotations.*"],
  ADMIN: ["business.read", "business.update", "customers.*", "quotations.*"],
  MEMBER: ["business.read", "customers.*", "quotations.*"],
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessAccess: BusinessAccessService,
  ) {}

  async createBusiness(
    userPublicId: string,
    input: CreateBusinessRequest,
    requestId: string,
  ): Promise<BusinessSummary> {
    return this.database.client.$transaction(async (transaction: Prisma.TransactionClient) => {
      const user = await transaction.user.findUniqueOrThrow({
        where: { publicId: userPublicId },
      });
      const tenant = await transaction.tenant.create({ data: { name: input.name } });
      const membership = await transaction.membership.create({
        data: { tenantId: tenant.id, userId: user.id },
      });
      const roles = await Promise.all(
        (Object.values(RoleCode) as RoleCode[]).map((code) =>
          transaction.role.create({
            data: {
              tenantId: tenant.id,
              code,
              name: this.roleName(code),
              permissions: ROLE_PERMISSIONS[code],
            },
          }),
        ),
      );
      const ownerRole = (roles as Array<{ code: RoleCode; id: bigint }>).find(
        (role) => role.code === RoleCode.OWNER,
      );
      if (!ownerRole) {
        throw new Error("The owner role was not created.");
      }

      const business = await transaction.business.create({
        data: {
          tenantId: tenant.id,
          name: input.name,
          countryCode: input.countryCode,
          baseCurrency: input.baseCurrency,
          currencyScale: input.currencyScale,
          locale: input.locale,
          timeZone: input.timeZone,
        },
      });

      await transaction.$executeRaw`
        SELECT set_config('app.tenant_id', ${tenant.id.toString()}, true)
      `;
      await transaction.$executeRaw`
        SELECT set_config('app.business_id', ${business.id.toString()}, true)
      `;

      await transaction.businessSettings.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
        },
      });
      await transaction.taxProfile.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          enabled: input.taxEnabled,
          name: input.taxName,
          ratePpm: Number(parseDecimalToScaledInteger(input.taxRatePercent, 4)),
        },
      });
      await transaction.businessAccess.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          membershipId: membership.id,
          roleId: ownerRole.id,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          actorUserId: user.id,
          action: "business.created",
          targetType: "business",
          targetPublicId: business.publicId,
          requestId,
        },
      });

      return {
        id: business.publicId,
        tenantId: tenant.publicId,
        name: business.name,
        countryCode: business.countryCode,
        baseCurrency: business.baseCurrency,
        currencyScale: business.currencyScale,
        locale: business.locale,
        timeZone: business.timeZone,
        role: RoleCode.OWNER,
      };
    });
  }

  async getSettings(userPublicId: string, businessPublicId: string): Promise<BusinessSettings> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true, taxProfile: true },
      });
      if (!business.settings || !business.taxProfile) {
        throw new Error("Business settings are incomplete.");
      }
      return this.mapSettings(business, business.settings, business.taxProfile);
    });
  }

  async updateSettings(
    userPublicId: string,
    businessPublicId: string,
    input: UpdateBusinessSettingsRequest,
    requestId: string,
  ): Promise<BusinessSettings> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.update({
        where: { id: access.businessId },
        data: {
          name: input.name,
          legalName: input.legalName,
          email: input.email,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          baseCurrency: input.baseCurrency,
          currencyScale: input.currencyScale,
          locale: input.locale,
          timeZone: input.timeZone,
        },
      });
      const settings = await transaction.businessSettings.update({
        where: { businessId: access.businessId },
        data: {
          quotationPrefix: input.quotationPrefix,
          quotationValidityDays: input.quotationValidityDays,
          defaultMessage: input.defaultMessage,
        },
      });
      const taxProfile = await transaction.taxProfile.update({
        where: { businessId: access.businessId },
        data: {
          enabled: input.taxEnabled,
          name: input.taxName,
          registrationNumber: input.taxRegistrationNumber,
          ratePpm: Number(parseDecimalToScaledInteger(input.taxRatePercent, 4)),
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "business.settings_updated",
          targetType: "business",
          targetPublicId: access.businessPublicId,
          requestId,
        },
      });
      return this.mapSettings(business, settings, taxProfile);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: "read" | "update",
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "business", action);
    return access;
  }

  private mapSettings(
    business: {
      addressLine1: string | null;
      addressLine2: string | null;
      baseCurrency: string;
      city: string | null;
      countryCode: string;
      currencyScale: number;
      email: string | null;
      legalName: string | null;
      locale: string;
      name: string;
      phone: string | null;
      postalCode: string | null;
      publicId: string;
      timeZone: string;
    },
    settings: {
      defaultMessage: string | null;
      quotationPrefix: string;
      quotationValidityDays: number;
    },
    taxProfile: {
      enabled: boolean;
      name: string;
      ratePpm: number;
      registrationNumber: string | null;
    },
  ): BusinessSettings {
    return {
      id: business.publicId,
      name: business.name,
      legalName: business.legalName,
      email: business.email,
      phone: business.phone,
      addressLine1: business.addressLine1,
      addressLine2: business.addressLine2,
      city: business.city,
      postalCode: business.postalCode,
      countryCode: business.countryCode,
      baseCurrency: business.baseCurrency,
      currencyScale: business.currencyScale,
      locale: business.locale,
      timeZone: business.timeZone,
      quotationPrefix: settings.quotationPrefix,
      quotationValidityDays: settings.quotationValidityDays,
      defaultMessage: settings.defaultMessage,
      taxEnabled: taxProfile.enabled,
      taxName: taxProfile.name,
      taxRegistrationNumber: taxProfile.registrationNumber,
      taxRatePercent: this.formatRate(taxProfile.ratePpm),
    };
  }

  private formatRate(ratePpm: number): string {
    const whole = Math.trunc(ratePpm / 10_000);
    const fraction = String(ratePpm % 10_000)
      .padStart(4, "0")
      .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : String(whole);
  }

  private roleName(code: RoleCode): string {
    switch (code) {
      case RoleCode.OWNER:
        return "Owner";
      case RoleCode.ADMIN:
        return "Admin";
      case RoleCode.MEMBER:
        return "Team member";
      default:
        throw new Error("Unsupported role code.");
    }
  }
}

import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateSupplierRequest,
  type Supplier,
  type UpdateSupplierRequest,
} from "@bizo/contracts/suppliers";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface SupplierRecord {
  bankName: string | null;
  city: string | null;
  contactName: string | null;
  countryCode: string | null;
  createdAt: Date;
  email: string | null;
  iban: string | null;
  id: bigint;
  isActive: boolean;
  name: string;
  notes: string | null;
  paymentTerms: number | null;
  phone: string | null;
  postalCode: string | null;
  publicId: string;
  swiftCode: string | null;
  taxId: string | null;
  taxName: string | null;
  updatedAt: Date;
  addressLine1: string | null;
  addressLine2: string | null;
}

@Injectable()
export class SuppliersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateSupplierRequest,
    requestId: string,
  ): Promise<Supplier> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const record = (await transaction.supplier.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          name: input.name,
          contactName: input.contactName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          countryCode: input.countryCode ?? null,
          taxId: input.taxId ?? null,
          taxName: input.taxName ?? null,
          bankName: input.bankName ?? null,
          iban: input.iban ?? null,
          swiftCode: input.swiftCode ?? null,
          paymentTerms: input.paymentTerms ?? null,
          notes: input.notes ?? null,
        },
      })) as unknown as SupplierRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier.created",
          targetType: "supplier",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapSupplier(record);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Supplier[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.supplier.findMany({
        where: { businessId: access.businessId, isActive: true },
        orderBy: [{ name: "asc" }],
        take: 200,
      })) as unknown as SupplierRecord[];
      return records.map((record) => this.mapSupplier(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    supplierPublicId: string,
  ): Promise<Supplier> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, supplierPublicId);
      return this.mapSupplier(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    supplierPublicId: string,
    input: UpdateSupplierRequest,
    requestId: string,
  ): Promise<Supplier> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, supplierPublicId);

      const record = (await transaction.supplier.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          contactName: input.contactName !== undefined ? input.contactName : existing.contactName,
          email: input.email !== undefined ? input.email : existing.email,
          phone: input.phone !== undefined ? input.phone : existing.phone,
          addressLine1:
            input.addressLine1 !== undefined ? input.addressLine1 : existing.addressLine1,
          addressLine2:
            input.addressLine2 !== undefined ? input.addressLine2 : existing.addressLine2,
          city: input.city !== undefined ? input.city : existing.city,
          postalCode: input.postalCode !== undefined ? input.postalCode : existing.postalCode,
          countryCode: input.countryCode !== undefined ? input.countryCode : existing.countryCode,
          taxId: input.taxId !== undefined ? input.taxId : existing.taxId,
          taxName: input.taxName !== undefined ? input.taxName : existing.taxName,
          bankName: input.bankName !== undefined ? input.bankName : existing.bankName,
          iban: input.iban !== undefined ? input.iban : existing.iban,
          swiftCode: input.swiftCode !== undefined ? input.swiftCode : existing.swiftCode,
          paymentTerms:
            input.paymentTerms !== undefined ? input.paymentTerms : existing.paymentTerms,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
      })) as unknown as SupplierRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier.updated",
          targetType: "supplier",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapSupplier(record);
    });
  }

  async deactivate(
    userPublicId: string,
    businessPublicId: string,
    supplierPublicId: string,
    requestId: string,
  ): Promise<Supplier> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, supplierPublicId);

      const record = (await transaction.supplier.update({
        where: { id: existing.id },
        data: { isActive: false },
      })) as unknown as SupplierRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier.deactivated",
          targetType: "supplier",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapSupplier(record);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "suppliers", action);
    return access;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    supplierPublicId: string,
  ): Promise<SupplierRecord> {
    const record = (await transaction.supplier.findFirst({
      where: { businessId: access.businessId, publicId: supplierPublicId },
    })) as unknown as SupplierRecord | null;
    if (!record) {
      throw new NotFoundException("We could not find that supplier.");
    }
    return record;
  }

  private mapSupplier(record: SupplierRecord): Supplier {
    return {
      id: record.publicId,
      name: record.name,
      contactName: record.contactName,
      email: record.email,
      phone: record.phone,
      addressLine1: record.addressLine1,
      addressLine2: record.addressLine2,
      city: record.city,
      postalCode: record.postalCode,
      countryCode: record.countryCode,
      taxId: record.taxId,
      taxName: record.taxName,
      bankName: record.bankName,
      iban: record.iban,
      swiftCode: record.swiftCode,
      paymentTerms: record.paymentTerms,
      notes: record.notes,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

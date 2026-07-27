import { Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateCustomerRequest,
  type Customer,
  type UpdateCustomerRequest,
} from "@bizo/contracts/customers";

import { type DatabaseService } from "../database/database.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";

interface CustomerRecord {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  countryCode: string | null;
  createdAt: Date;
  email: string | null;
  name: string;
  phone: string | null;
  postalCode: string | null;
  publicId: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateCustomerRequest,
    requestId: string,
  ): Promise<Customer> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      const customer = await transaction.customer.create({
        data: {
          ...input,
          tenantId: access.tenantId,
          businessId: access.businessId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "customer.created",
          targetType: "customer",
          targetPublicId: customer.publicId,
          requestId,
        },
      });
      return this.mapCustomer(customer);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Customer[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const customers = await transaction.customer.findMany({
        where: { businessId: access.businessId },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 500,
      });
      return (customers as CustomerRecord[]).map((customer) => this.mapCustomer(customer));
    });
  }

  async get(userPublicId: string, businessPublicId: string, customerPublicId: string) {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: customerPublicId },
      });
      if (!customer) {
        throw new NotFoundException("We could not find that customer.");
      }
      return this.mapCustomer(customer);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    customerPublicId: string,
    input: UpdateCustomerRequest,
    requestId: string,
  ): Promise<Customer> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: customerPublicId },
      });
      if (!existing) {
        throw new NotFoundException("We could not find that customer.");
      }
      const customer = await transaction.customer.update({
        where: { id: existing.id },
        data: input,
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "customer.updated",
          targetType: "customer",
          targetPublicId: customer.publicId,
          requestId,
        },
      });
      return this.mapCustomer(customer);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: "create" | "read" | "update",
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "customers", action);
    return access;
  }

  private mapCustomer(customer: CustomerRecord): Customer {
    return {
      id: customer.publicId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2,
      city: customer.city,
      postalCode: customer.postalCode,
      countryCode: customer.countryCode,
      createdAt: customer.createdAt.toISOString(),
    };
  }
}

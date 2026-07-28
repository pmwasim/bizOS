import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client/client.js";

export {
  ConfigurationVersionStatus,
  CustomerPaymentStatus,
  DeliveryStatus,
  DocumentStatus,
  DocumentType,
  InvoiceApprovalStatus,
  MembershipStatus,
  ModuleStatus,
  PaymentMethod,
  PlatformSystemAdminStatus,
  Prisma,
  PurchaseOrderStatus,
  RoleCode,
  StoredObjectKind,
  WorkflowVersionStatus,
} from "../generated/client/client.js";
export type * from "../generated/client/models.js";

export interface DatabaseClientOptions {
  connectionTimeoutMillis?: number;
  databaseUrl: string;
  idleTimeoutMillis?: number;
  maxConnections?: number;
}

export function createDatabaseClient(options: DatabaseClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 10_000,
    max: options.maxConnections ?? 10,
  });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = PrismaClient;

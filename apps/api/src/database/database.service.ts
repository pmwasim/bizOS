import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { readApiEnvironment } from "@bizo/config/api";
import { createDatabaseClient, type DatabaseClient, type Prisma } from "@bizo/database";

export interface TrustedBusinessScope {
  businessId: bigint;
  tenantId: bigint;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: DatabaseClient;

  constructor() {
    const environment = readApiEnvironment(process.env);
    this.client = createDatabaseClient({
      databaseUrl: environment.DATABASE_URL,
      maxConnections: environment.NODE_ENV === "production" ? 20 : 5,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  async withScope<T>(
    scope: TrustedBusinessScope,
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transaction: Prisma.TransactionClient) => {
      await transaction.$executeRaw`
        SELECT set_config('app.tenant_id', ${scope.tenantId.toString()}, true)
      `;
      await transaction.$executeRaw`
        SELECT set_config('app.business_id', ${scope.businessId.toString()}, true)
      `;
      return work(transaction);
    });
  }
}

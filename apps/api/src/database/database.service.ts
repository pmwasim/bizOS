import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { readApiEnvironment } from "@bizo/config/api";
import { createDatabaseClient, type DatabaseClient, type Prisma } from "@bizo/database";

export interface TrustedBusinessScope {
  businessId: bigint;
  tenantId: bigint;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly client: DatabaseClient;

  constructor() {
    const environment = readApiEnvironment(process.env);
    this.client = createDatabaseClient({
      databaseUrl: environment.DATABASE_URL,
      maxConnections: environment.NODE_ENV === "production" ? 20 : 5,
    });
  }

  /**
   * Prisma connects lazily on the first query, so an eager `$connect()` here
   * only blocks bootstrap while the TCP + TLS handshake completes (~2-5 s on
   * remote PostgreSQL). Removing it lets the API accept health-check traffic
   * immediately and pay the connection cost on the first real request instead.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("Database client initialised (connection deferred to first query)");
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

import { Global, Module } from "@nestjs/common";

import { BusinessAccessService } from "./business-access.service.js";
import { SystemAdminGuard } from "./system-admin.guard.js";

@Global()
@Module({
  providers: [BusinessAccessService, SystemAdminGuard],
  exports: [BusinessAccessService, SystemAdminGuard],
})
export class SecurityModule {}

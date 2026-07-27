import { Global, Module } from "@nestjs/common";

import { BusinessAccessService } from "./business-access.service.js";

@Global()
@Module({
  providers: [BusinessAccessService],
  exports: [BusinessAccessService],
})
export class SecurityModule {}

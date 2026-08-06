import { Module } from "@nestjs/common";

import { readApiEnvironment } from "@bizo/config/api";

import { ErpnextClient, type ErpnextConnection } from "./erpnext.client.js";

export const ERPNEXT_CLIENT = Symbol("ERPNEXT_CLIENT");

function connectionFromEnvironment(): ErpnextConnection | undefined {
  const environment = readApiEnvironment(process.env);
  if (!environment.FRAPPE_BASE_URL) {
    return undefined;
  }

  return {
    apiKey: environment.FRAPPE_API_KEY!,
    apiSecret: environment.FRAPPE_API_SECRET!,
    baseUrl: environment.FRAPPE_BASE_URL,
  };
}

@Module({
  providers: [
    {
      provide: ERPNEXT_CLIENT,
      useFactory: () => new ErpnextClient(connectionFromEnvironment()),
    },
  ],
  exports: [ERPNEXT_CLIENT],
})
export class ErpnextModule {}

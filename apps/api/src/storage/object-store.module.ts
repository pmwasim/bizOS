import { Module } from "@nestjs/common";

import { createObjectStoreFromEnv } from "@bizo/storage";

import { OBJECT_STORE } from "./object-store.token.js";

@Module({
  providers: [
    {
      provide: OBJECT_STORE,
      useFactory: () => createObjectStoreFromEnv(process.env),
    },
  ],
  exports: [OBJECT_STORE],
})
export class ObjectStoreModule {}

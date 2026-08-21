import { describe, expect, it } from "vitest";

import { ObjectStoreModule } from "./object-store.module.js";
import { OBJECT_STORE } from "./object-store.token.js";

describe("ObjectStoreModule", () => {
  it("defines OBJECT_STORE injection token as a symbol", () => {
    expect(typeof OBJECT_STORE).toBe("symbol");
    expect(OBJECT_STORE.description).toBe("OBJECT_STORE");
  });

  it("exports ObjectStoreModule class", () => {
    expect(ObjectStoreModule).toBeDefined();
  });
});

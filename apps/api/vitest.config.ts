import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.{test,spec}.ts",
      "test/**/*.{test,spec,e2e-spec}.ts",
      "apps/api/test/**/*.{test,spec,e2e-spec}.ts",
    ],
  },
});

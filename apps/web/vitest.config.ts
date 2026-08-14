import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.{test,spec}.ts",
      "src/**/*.{test,spec}.tsx",
      "test/**/*.{test,spec,e2e-spec}.ts",
      "test/**/*.{test,spec,e2e-spec}.tsx",
    ],
  },
});

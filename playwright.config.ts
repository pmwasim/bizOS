import { defineConfig, devices } from "@playwright/test";

/**
 * Ports the suite starts its own servers on.
 *
 * Overridable because the production host runs bizOS on 3000/3001. With fixed ports and
 * `reuseExistingServer`, running the suite there silently drives production instead of a test
 * stack — so an agent on that machine either cannot run e2e at all, or runs it against live data.
 * Point `E2E_WEB_PORT`, `E2E_API_PORT`, and a scratch `DATABASE_URL` somewhere harmless instead.
 */
const WEB_PORT = process.env.E2E_WEB_PORT ?? "3000";
const API_PORT = process.env.E2E_API_PORT ?? "3001";
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @bizo/api start",
      env: { API_PORT },
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 30_000,
      url: `${API_ORIGIN}/api/v1/health`,
    },
    {
      command: "pnpm --filter @bizo/web start",
      env: {
        API_INTERNAL_URL: `${API_ORIGIN}/api/v1`,
        AUTH_URL: WEB_ORIGIN,
        PORT: WEB_PORT,
        WEB_PORT,
      },
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 30_000,
      url: WEB_ORIGIN,
    },
  ],
});

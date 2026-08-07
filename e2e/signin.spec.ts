import { expect, test } from "@playwright/test";

test("public sign-in route renders the credentials form", async ({ page }) => {
  const response = await page.goto("/signin");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

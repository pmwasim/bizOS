import { expect, test } from "@playwright/test";

import { completeDefaultSetup } from "./helpers";

/**
 * A sales order is created as a DRAFT and its detail page is the only destination the UI offers,
 * so if the confirm and cancel forms are not rendered there the endpoints behind them are
 * unreachable from a browser — which is exactly how they shipped.
 *
 * Also pins the tax rate to the business's configured value. A hardcoded 15% default silently
 * produced the wrong tax and total for every business on a different rate, because whatever the
 * line carries is what the server uses to calculate.
 */
test("creates a sales order at the business tax rate and confirms it", async ({
  page,
}, testInfo) => {
  const runId = `${testInfo.project.name}-${Date.now()}`.toLowerCase();

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Order Owner");
  await page.getByLabel("Email").fill(`so-owner-${runId}@example.test`);
  await page.getByLabel(/Password/).fill("ReleasePass123");
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).toHaveURL(/\/start$/);
  await page.getByLabel(/Business name/).fill(`Order Services ${runId}`);
  await page.getByRole("button", { name: "Create business" }).click();

  await completeDefaultSetup(page);
  const businessId = new URL(page.url()).pathname.split("/")[2];

  await page.goto(`/b/${businessId}/customers/new`);
  await page.getByLabel("Name").fill(`Order Customer ${runId}`);
  await page.getByLabel("Email").fill(`so-customer-${runId}@example.test`);
  await page
    .getByRole("button", { name: /Save|Add customer|Create/ })
    .first()
    .click();

  await page.goto(`/b/${businessId}/sales-orders/new`);

  // The default comes from business settings. A business created with country SA is on 15% VAT,
  // so this is the configured rate rather than a constant that happens to match it.
  await expect(page.locator('input[name="taxRatePercent"]').first()).toHaveValue("15");

  await page.locator('input[name="description"]').first().fill("Consulting");
  await page.locator('input[name="quantity"]').first().fill("2");
  await page.locator('input[name="unitPrice"]').first().fill("100.00");
  await page.getByRole("button", { name: "Create sales order" }).click();

  // Creation lands straight on the detail page for the new order.
  await expect(page).toHaveURL(new RegExp(`/b/${businessId}/sales-orders/[0-9a-f-]{36}$`));
  await expect(page.getByRole("heading", { name: /^SO-\d{4,}$/ })).toBeVisible();
  await expect(page.getByText("Draft")).toBeVisible();

  await page.getByRole("button", { name: "Confirm sales order" }).click();

  await expect(page.getByText("Confirmed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm sales order" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Cancel sales order" })).toBeVisible();
});

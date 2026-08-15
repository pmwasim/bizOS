import { expect, test } from "@playwright/test";

import { completeDefaultSetup } from "./helpers";

test("creates and sends a professional quotation", async ({ page }, testInfo) => {
  const runId = `${testInfo.project.name}-${Date.now()}`.toLowerCase();
  const email = `owner-${runId}@example.test`;
  const customerEmail = `customer-${runId}@example.test`;

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Release Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("ReleasePass123");
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).toHaveURL(/\/start$/);
  await page.getByLabel(/Business name/).fill(`Release Services ${runId}`);
  await page.getByRole("button", { name: "Create business" }).click();

  await completeDefaultSetup(page);
  await page.getByRole("link", { name: "Add your first customer" }).click();
  await page.getByLabel("Customer or company name").fill("Northstar Studio");
  await page.locator('input[name="email"]').fill(customerEmail);
  await page.getByRole("button", { name: "Save and create quotation" }).click();

  await expect(page.getByRole("heading", { name: "Create your quotation" })).toBeVisible();
  await page.getByPlaceholder("e.g. Website design").fill("Website design");
  await page.getByLabel("Item 1 price in SAR").fill("5000");
  await expect(page.getByText(/SAR\s*5,750\.00/)).toBeVisible();
  await page.getByRole("button", { name: "Preview quotation" }).click();

  await expect(page).toHaveURL(
    /\/quotations\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  const quotationHeading = page.getByRole("heading", { name: /^Q-\d{4,}$/ });
  await expect(quotationHeading).toBeVisible();
  const quotationNumber = await quotationHeading.textContent();
  expect(quotationNumber).toBeTruthy();
  const pdfFrame = page.getByTitle(`Preview of quotation ${quotationNumber}`);
  await expect(pdfFrame).toBeVisible();
  const pdfPath = await pdfFrame.getAttribute("src");
  expect(pdfPath).toBeTruthy();
  const pdfResponse = await page.request.get(pdfPath!);
  // Assert on the status, not `ok()`: a bare boolean tells whoever reads the CI log nothing about
  // why the preview failed, and the body carries the API's error payload.
  expect(pdfResponse.status(), await pdfResponse.text()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.getByRole("button", { name: "Send quotation" }).click();
  await expect(page.getByRole("status")).toContainText("Quotation sent");
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send again" })).toBeVisible();

  if (testInfo.project.name.startsWith("mobile")) {
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();
  } else {
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".mobile-nav")).toBeHidden();
  }
});

import { expect, test } from "@playwright/test";
import path from "node:path";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import { completeDefaultSetup } from "./helpers";

test("records a customer PO through ready to invoice", async ({ page }, testInfo) => {
  const runId = `${testInfo.project.name}-${Date.now()}`.toLowerCase();
  const email = `po-owner-${runId}@example.test`;
  const customerEmail = `po-customer-${runId}@example.test`;

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("PO Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("ReleasePass123");
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).toHaveURL(/\/start$/);
  await page.getByLabel(/Business name/).fill(`PO Services ${runId}`);
  await page.getByRole("button", { name: "Create business" }).click();

  await completeDefaultSetup(page);
  await page.getByRole("link", { name: "Add first customer" }).click();
  await page.getByLabel("Customer or company name").fill("Harbor Works");
  await page.locator('input[name="email"]').fill(customerEmail);
  await page.getByRole("button", { name: "Save and create quotation" }).click();

  await page.getByPlaceholder("e.g. Website design").fill("Consulting");
  await page.getByLabel("Item 1 price in SAR").fill("1000");
  await page.getByRole("button", { name: "Preview quotation" }).click();
  await expect(page.getByRole("heading", { name: /^Q-\d{4,}$/ })).toBeVisible();

  await page.getByRole("link", { name: "Add customer PO" }).click();
  await expect(page.getByRole("heading", { name: "Add a purchase order" })).toBeVisible();
  await page.getByLabel("Purchase order number").fill(`PO-${runId.slice(-6)}`);
  await page.getByRole("button", { name: "Save purchase order" }).click();

  await expect(page.locator("header .status")).toHaveText("Approval pending");

  const dir = await mkdtemp(path.join(tmpdir(), "bizo-po-"));
  const poFile = path.join(dir, "customer-po.pdf");
  await writeFile(poFile, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));
  await page.locator('input[name="file"]').first().setInputFiles(poFile);
  await page.getByRole("button", { name: "Upload PO file" }).click();
  await expect(page.getByText("customer-po.pdf")).toBeVisible();

  await page.getByLabel("Approval status").selectOption("APPROVED");
  await page.getByRole("button", { name: "Save approval status" }).click();
  await expect(page.locator("header .status")).toHaveText("Approval evidence missing");

  const evidenceFile = path.join(dir, "approval.pdf");
  await writeFile(evidenceFile, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));
  await page
    .locator("form")
    .filter({ hasText: "Approval evidence" })
    .locator('input[name="file"]')
    .setInputFiles(evidenceFile);
  await page.getByRole("button", { name: "Upload evidence" }).click();

  await expect(page.locator("header .status")).toHaveText("Ready to invoice");

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("heading", { name: /^INV-\d{4,}$/ })).toBeVisible();
  await expect(page.getByText(/Customer PO/i)).toBeVisible();
  await expect(page.getByText(`PO-${runId.slice(-6)}`)).toBeVisible();
  await expect(page.locator("iframe")).toBeVisible();

  await page.getByLabel("Email").fill(customerEmail);
  await page.getByRole("button", { name: /Send invoice|Send again/i }).click();
  await expect(page.getByText(/Invoice sent/i)).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("header .status")).toHaveText("Sent");

  if (testInfo.project.name.startsWith("mobile")) {
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
  }
});

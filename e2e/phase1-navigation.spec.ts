import { expect, test } from "@playwright/test";

import { completeDefaultSetup } from "./helpers";

/**
 * Every route the sidebar links to must exist.
 *
 * `MODULE_NAV` in `app-shell.tsx` linked to /suppliers, /sales-orders, /delivery-notes and /leads
 * while none of those routes were on main, so four sidebar entries 404'd in production for any
 * business with those modules enabled. Nothing caught it: the pages have no unit tests, and the
 * quotation and PO journeys never open the sidebar's other entries.
 */
const MODULE_PAGES = [
  { path: "suppliers", heading: "Suppliers" },
  { path: "sales-orders", heading: "Sales Orders" },
  { path: "delivery-notes", heading: "Delivery Notes" },
  { path: "leads", heading: "Leads" },
  { path: "opportunities", heading: "Opportunities" },
  { path: "projects", heading: "Projects & Profitability Summary" },
  { path: "inventory", heading: "Inventory & Stock Engine" },
  { path: "credit-notes", heading: "Credit Notes & Adjustments" },
  { path: "customers", heading: "Customers" },
  { path: "quotations", heading: "Quotations" },
  { path: "invoices", heading: "Invoices" },
  { path: "purchase-orders", heading: "Purchase orders" },
  { path: "payments", heading: "Payments" },
];

test("every module page the sidebar links to resolves", async ({ page }, testInfo) => {
  const runId = `${testInfo.project.name}-${Date.now()}`.toLowerCase();

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Nav Owner");
  await page.getByLabel("Email").fill(`nav-owner-${runId}@example.test`);
  await page.getByLabel(/Password/).fill("ReleasePass123");
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).toHaveURL(/\/start$/);
  await page.getByLabel(/Business name/).fill(`Nav Services ${runId}`);
  await page.getByRole("button", { name: "Create business" }).click();

  await completeDefaultSetup(page);

  const businessId = new URL(page.url()).pathname.split("/")[2];
  expect(businessId).toBeTruthy();

  for (const { path, heading } of MODULE_PAGES) {
    const response = await page.goto(`/b/${businessId}/${path}`);
    expect(response?.status(), `GET /b/:businessId/${path}`).toBe(200);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
      `heading on /${path}`,
    ).toBeVisible();
  }
});

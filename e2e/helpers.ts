import { expect, type Page } from "@playwright/test";

/** Complete the post-create setup screen using Default ERP (skip guided questionnaire). */
export async function completeDefaultSetup(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/b\/[^/]+\/setup$/);
  await expect(
    page.getByRole("heading", { name: "How would you like to set up your workspace?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use default" }).click();
  await expect(page.getByRole("heading", { name: "Let’s send your first quotation" })).toBeVisible({
    timeout: 30_000,
  });
}

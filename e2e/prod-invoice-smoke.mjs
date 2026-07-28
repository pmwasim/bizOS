import { chromium } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "https://bizos.qloudihub.com";
const api = "https://api.bizos.qloudihub.com";
const runId = `inv-${Date.now()}`;
const email = `invoice-smoke-${runId}@example.test`;
const customerEmail = `invoice-cust-${runId}@example.test`;

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
desktop.setDefaultTimeout(120_000);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = {
  ok: false,
  email,
  quotationRegression: null,
  poRegression: null,
  invoiceCreate: null,
  pdfPreview: null,
  authDownload: null,
  unauthDownload: null,
  unauthApi: null,
  send: null,
  resend: null,
  mobile: null,
  crossTenant: null,
  r2: null,
  url: null,
  invoiceNumber: null,
};

try {
  await desktop.goto(`${base}/signup`);
  await desktop.getByLabel("Your name").fill("Invoice Smoke");
  await desktop.getByLabel("Email").fill(email);
  await desktop.getByLabel(/Password/).fill("ReleasePass123");
  await desktop.getByRole("button", { name: "Create my account" }).click();
  await desktop.waitForURL(/\/(start|b\/)/, { timeout: 180_000 });

  await desktop.getByLabel(/Business name/).fill(`Invoice Co ${runId}`);
  await desktop.getByRole("button", { name: "Create business" }).click();
  await desktop.waitForURL(/\/b\/[^/]+\/setup$/, { timeout: 120_000 });
  await desktop.getByRole("button", { name: "Use default" }).click();
  await desktop
    .getByRole("heading", { name: "Let’s send your first quotation" })
    .waitFor({ timeout: 120_000 });
  await desktop.getByRole("link", { name: "Add your first customer" }).click();
  await desktop.getByLabel("Customer or company name").fill("Invoice Customer");
  await desktop.locator('input[name="email"]').fill(customerEmail);
  await desktop.getByRole("button", { name: "Save and create quotation" }).click();

  await desktop.getByPlaceholder("e.g. Website design").fill("Invoice service");
  await desktop.getByLabel(/price/).fill("250");
  await desktop.getByRole("button", { name: "Preview quotation" }).click();
  await desktop.getByRole("heading", { name: /^Q-\d{4,}$/ }).waitFor();
  assert(await desktop.locator("iframe").first().isVisible(), "quotation PDF iframe missing");
  results.quotationRegression = "PASS";

  await desktop.getByRole("link", { name: "Add customer PO" }).click();
  await desktop.getByLabel("Purchase order number").fill(`PO-${runId.slice(-8)}`);
  await desktop.getByRole("button", { name: "Save purchase order" }).click();
  await desktop.locator("header .status").waitFor();
  assert(
    (await desktop.locator("header .status").textContent())?.trim() === "Approval pending",
    "expected Approval pending",
  );

  const dir = await mkdtemp(path.join(tmpdir(), "prod-inv-"));
  const poFile = path.join(dir, "customer-po.pdf");
  await writeFile(poFile, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));
  await desktop.locator('input[name="file"]').first().setInputFiles(poFile);
  await desktop.getByRole("button", { name: "Upload PO file" }).click();
  await desktop.getByText("customer-po.pdf").waitFor({ timeout: 120_000 });
  results.r2 = "PASS";

  await desktop.getByLabel("Approval status").selectOption("APPROVED");
  await desktop.getByRole("button", { name: "Save approval status" }).click();
  await desktop.waitForFunction(
    () =>
      document.querySelector("header .status")?.textContent?.trim() === "Approval evidence missing",
  );

  const evidence = path.join(dir, "approval.pdf");
  await writeFile(evidence, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));
  await desktop
    .locator("form")
    .filter({ hasText: "Approval evidence" })
    .locator('input[name="file"]')
    .setInputFiles(evidence);
  await desktop.getByRole("button", { name: "Upload evidence" }).click();
  await desktop.waitForFunction(
    () => document.querySelector("header .status")?.textContent?.trim() === "Ready to invoice",
    null,
    { timeout: 120_000 },
  );
  results.poRegression = "PASS";

  await desktop.getByRole("button", { name: "Create invoice" }).click();
  await desktop.getByRole("heading", { name: /^INV-\d{4,}$/ }).waitFor();
  results.invoiceNumber = (
    await desktop.getByRole("heading", { name: /^INV-\d{4,}$/ }).textContent()
  )?.trim();
  assert(
    await desktop
      .getByText(`PO-${runId.slice(-8)}`)
      .first()
      .isVisible(),
    "PO number missing on invoice",
  );
  assert(await desktop.locator("iframe").first().isVisible(), "invoice PDF iframe missing");
  results.invoiceCreate = "PASS";
  results.pdfPreview = "PASS";
  results.url = desktop.url();

  const invoicePath = new URL(desktop.url()).pathname;
  const parts = invoicePath.split("/");
  const businessId = parts[2];
  const invoiceId = parts[4];
  assert(businessId && invoiceId, "could not parse invoice URL");

  const cookies = await desktop.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const pdfUrl = `${base}/api/businesses/${businessId}/invoices/${invoiceId}/pdf`;
  const authPdf = await fetch(pdfUrl, { headers: { cookie: cookieHeader } });
  assert(authPdf.status === 200, `auth PDF expected 200 got ${authPdf.status}`);
  results.authDownload = "PASS";

  const unauthPdf = await fetch(pdfUrl);
  assert(unauthPdf.status === 401, `unauth PDF expected 401 got ${unauthPdf.status}`);
  results.unauthDownload = "PASS";

  const unauthApi = await fetch(`${api}/api/v1/businesses/${businessId}/invoices`);
  assert(unauthApi.status === 401, `unauth API expected 401 got ${unauthApi.status}`);
  results.unauthApi = "PASS";

  // Cross-tenant: random UUIDs should 404 when authenticated
  const cross = await fetch(
    `${base}/api/businesses/11111111-1111-4111-8111-111111111111/invoices/22222222-2222-4222-8222-222222222222/pdf`,
    { headers: { cookie: cookieHeader } },
  );
  assert(
    cross.status === 404 || cross.status === 401,
    `cross-tenant expected 404/401 got ${cross.status}`,
  );
  results.crossTenant = "PASS";

  await desktop.getByLabel("Email").fill(customerEmail);
  await desktop.getByRole("button", { name: /Send invoice|Send again/i }).click();
  await desktop.getByText(/Invoice sent/i).waitFor({ timeout: 120_000 });
  assert(
    (await desktop.locator("header .status").textContent())?.trim() === "Sent",
    "expected Sent after email",
  );
  results.send = "PASS";

  await desktop.getByRole("button", { name: /Send again/i }).click();
  await desktop.getByText(/Invoice sent/i).waitFor({ timeout: 120_000 });
  assert(
    (await desktop.locator("header .status").textContent())?.trim() === "Sent",
    "expected Sent after resend",
  );
  results.resend = "PASS";

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.setDefaultTimeout(120_000);
  await mobile.context().addCookies(cookies);
  await mobile.goto(results.url);
  await mobile.getByRole("heading", { name: /^INV-\d{4,}$/ }).waitFor();
  await mobile.getByRole("navigation", { name: "Workspace" }).waitFor();
  assert(
    (await mobile.locator("header .status").textContent())?.trim() === "Sent",
    "mobile sent status",
  );
  results.mobile = "PASS";
  await mobile.close();

  results.ok = true;
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error("SMOKE_FAIL", String(error));
  console.error(JSON.stringify(results, null, 2));
  await desktop
    .screenshot({ path: "/tmp/prod-invoice-smoke-fail.png", fullPage: true })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}

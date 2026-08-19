"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import {
  confirmPasswordResetRequestSchema,
  requestPasswordResetRequestSchema,
  signUpRequestSchema,
} from "@bizo/contracts/auth";
import { createCustomerRequestSchema, type Customer } from "@bizo/contracts/customers";
import { createCreditNoteRequestSchema, type CreditNote } from "@bizo/contracts/credit-notes";
import { createDeliveryNoteRequestSchema, type DeliveryNote } from "@bizo/contracts/delivery-notes";
import { createInventoryItemRequestSchema, type InventoryItem } from "@bizo/contracts/inventory";
import { createProjectRequestSchema, type Project } from "@bizo/contracts/projects";
import {
  createLeadRequestSchema,
  createOpportunityRequestSchema,
  opportunityStageSchema,
  type Lead,
  type Opportunity,
} from "@bizo/contracts/crm";
import { createSalesOrderRequestSchema, type SalesOrder } from "@bizo/contracts/sales-orders";
import { createSupplierRequestSchema, type Supplier } from "@bizo/contracts/suppliers";
import {
  createCustomizationRequestSchema,
  type BusinessCustomizationRequestSummary,
} from "@bizo/contracts/customization";
import {
  createInvoiceFromQuotationRequestSchema,
  type Invoice,
  sendInvoiceRequestSchema,
  updateInvoiceRequestSchema,
} from "@bizo/contracts/invoices";
import { parseDecimalToScaledInteger } from "@bizo/contracts/money";
import { type Payment, recordPaymentRequestSchema } from "@bizo/contracts/payments";
import {
  type ConvertPurchaseOrderToBillResponse,
  createPurchaseOrderRequestSchema,
  type PurchaseOrder,
  updateApprovalStatusRequestSchema,
} from "@bizo/contracts/purchase-orders";
import {
  createBusinessRequestSchema,
  type BusinessSummary,
  updateBusinessSettingsRequestSchema,
} from "@bizo/contracts/platform";
import {
  type Quotation,
  saveQuotationRequestSchema,
  sendQuotationRequestSchema,
} from "@bizo/contracts/quotations";
import { sendStatementRequestSchema } from "@bizo/contracts/statements";
import {
  type OnboardingAnswers,
  type OnboardingRecommendation,
  type ApplyOnboardingRequest,
  type RecommendOnboardingRequest,
} from "@bizo/contracts/onboarding";

import { signIn, signOut } from "@/auth";
import { ApiError, apiFetch, apiJson, publicApiFetch } from "@/lib/api";

export interface ActionState {
  error?: string;
}

export async function signUpAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpRequestSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const response = await publicApiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    return { error: problem.detail ?? "We could not create your account." };
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/start",
  });
  return {};
}

export async function signInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/start",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "That email and password do not match." };
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export interface PasswordResetState extends ActionState {
  sent?: boolean;
}

/**
 * Reports the same outcome for known and unknown addresses. Surfacing "no such account" here would
 * let anyone test whether an email is registered.
 */
export async function requestPasswordResetAction(
  _state: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = requestPasswordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const response = await publicApiFetch("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return { error: "Too many reset requests. Wait a minute and try again." };
    }
    return { error: "We could not start the reset. Please try again." };
  }

  return { sent: true };
}

export async function confirmPasswordResetAction(
  _state: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = confirmPasswordResetRequestSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  const response = await publicApiFetch("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    return {
      error: problem.detail ?? "That reset link is no longer valid. Request a new one.",
    };
  }

  redirect("/signin?reset=1");
}

export async function createBusinessAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createBusinessRequestSchema.safeParse({
    name: formData.get("name"),
    countryCode: formData.get("countryCode"),
    baseCurrency: formData.get("baseCurrency"),
    currencyScale: 2,
    locale: "en",
    timeZone: formData.get("timeZone"),
    taxEnabled: formData.get("taxEnabled") === "on",
    taxName: formData.get("taxName"),
    taxRatePercent: formData.get("taxEnabled") === "on" ? formData.get("taxRatePercent") : "0",
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const business = await apiJson<BusinessSummary>("/businesses", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${business.id}/setup`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createCustomerAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  const parsed = createCustomerRequestSchema.safeParse({
    name: formData.get("name"),
    email: optional("email"),
    phone: optional("phone"),
    addressLine1: optional("addressLine1"),
    addressLine2: null,
    city: optional("city"),
    postalCode: null,
    countryCode: optional("countryCode"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const customer = await apiJson<Customer>(`/businesses/${businessId}/customers`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/quotations/new?customer=${customer.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createQuotationAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Check the quotation lines and try again." };
  }
  const parsed = saveQuotationRequestSchema.safeParse({
    customerId: formData.get("customerId"),
    lines,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const quotation = await apiJson<Quotation>(`/businesses/${businessId}/quotations`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/quotations/${quotation.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function sendQuotationAction(
  businessId: string,
  quotationId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sendQuotationRequestSchema.safeParse({
    recipientEmail: formData.get("recipientEmail"),
    message: String(formData.get("message") ?? "").trim() || null,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson(`/businesses/${businessId}/quotations/${quotationId}/send`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/quotations/${quotationId}?sent=1`);
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Email a customer statement. The endpoint is idempotent per customer + period + recipient, so a
 * double submit does not send twice; on success we return to the same statement view with a banner.
 */
export async function sendStatementAction(
  businessId: string,
  customerId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const startDate = String(formData.get("startDate") ?? "").trim() || undefined;
  const endDate = String(formData.get("endDate") ?? "").trim() || undefined;
  const parsed = sendStatementRequestSchema.safeParse({
    recipientEmail: formData.get("recipientEmail"),
    message: String(formData.get("message") ?? "").trim() || null,
    startDate,
    endDate,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson(`/businesses/${businessId}/statements/customers/${customerId}/send`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return actionError(error);
  }

  const query = new URLSearchParams({ customerId });
  if (startDate) query.set("startDate", startDate);
  if (endDate) query.set("endDate", endDate);
  query.set("sent", "1");
  redirect(`/b/${businessId}/statements?${query.toString()}`);
}

export async function createInvoiceFromQuotationAction(
  businessId: string,
  quotationId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const parsed = createInvoiceFromQuotationRequestSchema.safeParse({ quotationId });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const invoice = await apiJson<Invoice>(`/businesses/${businessId}/invoices`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/invoices/${invoice.id}`);
  } catch (error) {
    return actionError(error);
  }
}

/**
 * One-click convert: accept a quotation and land on the draft invoice it produces. The endpoint is
 * idempotent, so re-running this on an already-converted quotation redirects to the same draft
 * rather than creating a duplicate.
 */
export async function convertQuotationToInvoiceAction(
  businessId: string,
  quotationId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const invoice = await apiJson<Invoice>(
      `/businesses/${businessId}/quotations/${quotationId}/convert`,
      {
        method: "POST",
        body: "{}",
      },
    );
    redirect(`/b/${businessId}/invoices/${invoice.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateInvoiceAction(
  businessId: string,
  invoiceId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Check the invoice lines and try again." };
  }
  const parsed = updateInvoiceRequestSchema.safeParse({
    issueDate: String(formData.get("issueDate") ?? "").trim() || undefined,
    dueDate: String(formData.get("dueDate") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || null,
    lines,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson(`/businesses/${businessId}/invoices/${invoiceId}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/invoices/${invoiceId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function markInvoiceReadyAction(
  businessId: string,
  invoiceId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await apiJson(`/businesses/${businessId}/invoices/${invoiceId}/mark-ready`, {
      method: "POST",
      body: "{}",
    });
    redirect(`/b/${businessId}/invoices/${invoiceId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function sendInvoiceAction(
  businessId: string,
  invoiceId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sendInvoiceRequestSchema.safeParse({
    recipientEmail: formData.get("recipientEmail"),
    message: String(formData.get("message") ?? "").trim() || null,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson(`/businesses/${businessId}/invoices/${invoiceId}/send`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/invoices/${invoiceId}?sent=1`);
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveInvoiceAction(
  businessId: string,
  invoiceId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await apiJson(`/businesses/${businessId}/invoices/${invoiceId}/archive`, {
      method: "POST",
      body: "{}",
    });
    redirect(`/b/${businessId}/invoices`);
  } catch (error) {
    return actionError(error);
  }
}

export async function recordPaymentAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currencyCode = String(formData.get("currencyCode") ?? "").trim();
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();

  // The form collects a decimal amount; the API takes minor units as a string.
  let amountMinor: string;
  try {
    amountMinor = parseDecimalToScaledInteger(
      String(formData.get("amount") ?? "").trim(),
      Number(formData.get("currencyScale") ?? 2),
    ).toString();
  } catch {
    return { error: "Enter the amount as a positive number, for example 1250.00." };
  }

  const parsed = recordPaymentRequestSchema.safeParse({
    type: "INBOUND",
    paymentDate: String(formData.get("receivedOn") ?? "").trim(),
    amountMinor,
    currencyCode,
    reference: String(formData.get("reference") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    allocations: [{ documentId: invoiceId, amountMinor }],
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const payment = await apiJson<Payment>(`/businesses/${businessId}/payments`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/payments/${payment.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function voidPaymentAction(
  businessId: string,
  paymentId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  // The API models undoing a payment as a status transition to REVERSED. There is no /void route
  // and no stored reason, so the reason field is not sent.
  try {
    await apiJson(`/businesses/${businessId}/payments/${paymentId}/status/reverse`, {
      method: "PATCH",
    });
    redirect(`/b/${businessId}/payments/${paymentId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSettingsAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const parsed = updateBusinessSettingsRequestSchema.safeParse({
    name: formData.get("name"),
    legalName: optional("legalName"),
    email: optional("email"),
    phone: optional("phone"),
    addressLine1: optional("addressLine1"),
    addressLine2: optional("addressLine2"),
    city: optional("city"),
    postalCode: optional("postalCode"),
    countryCode: formData.get("countryCode"),
    baseCurrency: formData.get("baseCurrency"),
    currencyScale: Number(formData.get("currencyScale")),
    locale: formData.get("locale"),
    timeZone: formData.get("timeZone"),
    quotationPrefix: formData.get("quotationPrefix"),
    quotationValidityDays: Number(formData.get("quotationValidityDays")),
    defaultMessage: optional("defaultMessage"),
    taxEnabled: formData.get("taxEnabled") === "on",
    taxName: formData.get("taxName"),
    taxRegistrationNumber: optional("taxRegistrationNumber"),
    taxRatePercent: formData.get("taxRatePercent"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson(`/businesses/${businessId}/settings`, {
      method: "PUT",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/settings?saved=1`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createPurchaseOrderAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  const amountText = optional("amount");
  const currencyCode = optional("currencyCode")?.toUpperCase() ?? null;
  let amountMinor: string | null = null;
  let currencyScale: number | null = null;
  if (amountText) {
    if (!currencyCode) {
      return { error: "Enter a currency with the amount." };
    }
    currencyScale = 2;
    const parsedAmount = Number(amountText);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return { error: "Enter a valid amount." };
    }
    amountMinor = String(Math.round(parsedAmount * 100));
  }

  const parsed = createPurchaseOrderRequestSchema.safeParse({
    customerId: formData.get("customerId"),
    quotationId: optional("quotationId"),
    poNumber: formData.get("poNumber"),
    poDate: optional("poDate"),
    projectReference: optional("projectReference"),
    amountMinor,
    currencyCode: amountMinor ? currencyCode : null,
    currencyScale: amountMinor ? currencyScale : null,
    notes: optional("notes"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const purchaseOrder = await apiJson<PurchaseOrder>(
      `/businesses/${businessId}/purchase-orders`,
      {
        method: "POST",
        body: JSON.stringify(parsed.data),
      },
    );
    redirect(`/b/${businessId}/purchase-orders/${purchaseOrder.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateApprovalStatusAction(
  businessId: string,
  purchaseOrderId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateApprovalStatusRequestSchema.safeParse({
    approvalStatus: formData.get("approvalStatus"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson(`/businesses/${businessId}/purchase-orders/${purchaseOrderId}/approval`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/purchase-orders/${purchaseOrderId}`);
  } catch (error) {
    return actionError(error);
  }
}

/**
 * One-click convert: turn an APPROVED purchase order into the draft supplier bill it produces and
 * land on that bill. The endpoint is idempotent, so re-running this on an already-converted purchase
 * order redirects to the same draft rather than creating a duplicate.
 */
export async function convertPurchaseOrderToBillAction(
  businessId: string,
  purchaseOrderId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const bill = await apiJson<ConvertPurchaseOrderToBillResponse>(
      `/businesses/${businessId}/purchase-orders/${purchaseOrderId}/convert-to-bill`,
      {
        method: "POST",
        body: "{}",
      },
    );
    redirect(`/b/${businessId}/procurement/supplier-bills?bill=${bill.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadPurchaseOrderFileAction(
  businessId: string,
  purchaseOrderId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return uploadPurchaseOrderBinary(businessId, purchaseOrderId, "purchase-order", formData);
}

export async function uploadApprovalEvidenceAction(
  businessId: string,
  purchaseOrderId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return uploadPurchaseOrderBinary(businessId, purchaseOrderId, "approval-evidence", formData);
}

export async function archivePurchaseOrderAction(
  businessId: string,
  purchaseOrderId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await apiJson(`/businesses/${businessId}/purchase-orders/${purchaseOrderId}/archive`, {
      method: "POST",
      body: "{}",
    });
    redirect(`/b/${businessId}/purchase-orders`);
  } catch (error) {
    return actionError(error);
  }
}

async function uploadPurchaseOrderBinary(
  businessId: string,
  purchaseOrderId: string,
  kind: "purchase-order" | "approval-evidence",
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  const body = new FormData();
  body.set("file", file);
  try {
    const response = await apiFetch(
      `/businesses/${businessId}/purchase-orders/${purchaseOrderId}/files/${kind}`,
      {
        method: "POST",
        body,
      },
    );
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as { detail?: string };
      return { error: problem.detail ?? "We could not upload that file." };
    }
    redirect(`/b/${businessId}/purchase-orders/${purchaseOrderId}`);
  } catch (error) {
    return actionError(error);
  }
}

function actionError(error: unknown): ActionState {
  if (error instanceof ApiError) return { error: error.message };
  throw error;
}

function validationMessage(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Check the information and try again.";
}

export interface OnboardingActionState extends ActionState {
  recommendation?: OnboardingRecommendation;
}

export async function fetchRecommendation(
  businessId: string,
  answers: OnboardingAnswers,
): Promise<OnboardingRecommendation> {
  return apiJson<OnboardingRecommendation>("/onboarding/recommend", {
    method: "POST",
    body: JSON.stringify({ answers } satisfies RecommendOnboardingRequest),
  });
}

export async function applyDefaultConfigurationAction(
  businessId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    // Recommend with empty answers — the engine falls back to default-erp.
    const recommendation = await fetchRecommendation(businessId, {});
    await apiJson(`/businesses/${businessId}/onboarding/apply`, {
      method: "POST",
      body: JSON.stringify({
        recommendation,
        consentToReview: true,
      } satisfies ApplyOnboardingRequest),
    });
    redirect(`/b/${businessId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function applyRecommendationAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const recommendationJson = String(formData.get("recommendation") ?? "");
  let recommendation: OnboardingRecommendation;
  try {
    recommendation = JSON.parse(recommendationJson) as OnboardingRecommendation;
  } catch {
    return { error: "We could not read your recommendation. Please try again." };
  }

  try {
    await apiJson(`/businesses/${businessId}/onboarding/apply`, {
      method: "POST",
      body: JSON.stringify({
        recommendation,
        consentToReview: true,
      } satisfies ApplyOnboardingRequest),
    });
    redirect(`/b/${businessId}?setup=applied`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createCustomizationRequestAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const notes = String(formData.get("notes") ?? "").trim();
  const parsed = createCustomizationRequestSchema.safeParse({
    statedProcess: formData.get("statedProcess"),
    requestedChanges: formData.get("requestedChanges"),
    urgency: formData.get("urgency"),
    notes: notes || undefined,
    consentToReview: formData.get("consentToReview") === "on" ? true : undefined,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<BusinessCustomizationRequestSummary>(
      `/businesses/${businessId}/customization-requests`,
      {
        method: "POST",
        body: JSON.stringify(parsed.data),
      },
    );
    redirect(`/b/${businessId}/settings/customization?submitted=1`);
  } catch (error) {
    return actionError(error);
  }
}

// Phase 9 — System Admin server actions.
//
// These actions target /system-admin/* endpoints, which are guarded by
// SystemAdminGuard. The guard rejects non-admins with 403; we surface that as
// a plain error string. Both writes require a non-empty reason and the
// `confirm` checkbox so the form enforces the high-risk confirmation step
// before the request is sent.

export interface SystemAdminActionState extends ActionState {
  confirmRequired?: boolean;
}

export async function assignConfigurationAction(
  businessId: string,
  _state: SystemAdminActionState,
  formData: FormData,
): Promise<SystemAdminActionState> {
  const configurationTemplateVersionId = String(
    formData.get("configurationTemplateVersionId") ?? "",
  );
  const reason = String(formData.get("reason") ?? "").trim();
  const confirm = formData.get("confirm") === "on";

  if (!configurationTemplateVersionId) return { error: "Choose a configuration version." };
  if (!reason) return { error: "Provide a reason for this assignment change." };
  if (!confirm)
    return {
      error: "Confirm you understand this change before applying it.",
      confirmRequired: true,
    };

  try {
    await apiJson(`/system-admin/organizations/${businessId}/assignment`, {
      method: "POST",
      body: JSON.stringify({ configurationTemplateVersionId, reason, confirm }),
    });
    redirect(`/admin/organizations/${businessId}?assigned=1`);
  } catch (error) {
    return actionError(error);
  }
}

export async function setDefaultErpVersionAction(
  _state: SystemAdminActionState,
  formData: FormData,
): Promise<SystemAdminActionState> {
  const configurationTemplateVersionId = String(
    formData.get("configurationTemplateVersionId") ?? "",
  );
  const reason = String(formData.get("reason") ?? "").trim();
  const confirm = formData.get("confirm") === "on";

  if (!configurationTemplateVersionId) return { error: "Choose a default-erp version." };
  if (!reason) return { error: "Provide a reason for this default change." };
  if (!confirm)
    return {
      error: "Confirm you understand this change before applying it.",
      confirmRequired: true,
    };

  try {
    await apiJson("/system-admin/configuration/default-erp-version", {
      method: "POST",
      body: JSON.stringify({ configurationTemplateVersionId, reason, confirm }),
    });
    redirect("/admin/default-erp?set=1");
  } catch (error) {
    return actionError(error);
  }
}

function toMinorUnits(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  const currencyScale = Number(formData.get("currencyScale") ?? 2);
  return parseDecimalToScaledInteger(value, currencyScale).toString();
}

export async function createLeadAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  // The form collects a decimal; leads.estimated_value is numeric(38,0) minor units and the CRM
  // views format it as such, so a raw "1250.00" would display as 12.50.
  let estimatedValue: string | null;
  try {
    estimatedValue = toMinorUnits(formData, "estimatedValue");
  } catch {
    return { error: "Enter the estimated value as a positive number, for example 1250.00." };
  }

  const parsed = createLeadRequestSchema.safeParse({
    name: formData.get("name"),
    company: optional("company"),
    email: optional("email"),
    phone: optional("phone"),
    source: optional("source"),
    estimatedValue,
    notes: optional("notes"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<Lead>(`/businesses/${businessId}/leads`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/leads`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createOpportunityAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  let amountMinor: string | null;
  try {
    amountMinor = toMinorUnits(formData, "amount") ?? toMinorUnits(formData, "amountMinor");
  } catch {
    return { error: "Enter the amount as a positive number, for example 1250.00." };
  }
  const parsed = createOpportunityRequestSchema.safeParse({
    name: formData.get("name"),
    stage: formData.get("stage") || undefined,
    probability: optional("probability") ? Number(optional("probability")) : null,
    amountMinor,
    expectedCloseDate: optional("expectedCloseDate"),
    notes: optional("notes"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<Opportunity>(`/businesses/${businessId}/opportunities`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/opportunities`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createSalesOrderAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSalesOrderRequestSchema.safeParse({
    customerId: formData.get("customerId"),
    lines: readLinesFromFormData(formData),
    deliveryDate: formData.get("deliveryDate") || undefined,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    const order = await apiJson<SalesOrder>(`/businesses/${businessId}/sales-orders`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/sales-orders/${order.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createDeliveryNoteAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const salesOrderId = String(formData.get("salesOrderId") ?? "").trim() || undefined;
  const parsed = createDeliveryNoteRequestSchema.safeParse({
    customerId: formData.get("customerId"),
    salesOrderId,
    lines: descriptions.map((description, i) => ({
      description,
      quantity: quantities[i] || "1",
    })),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<DeliveryNote>(`/businesses/${businessId}/delivery-notes`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/delivery-notes`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createSupplierAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  const paymentTerms = optional("paymentTerms");
  const parsed = createSupplierRequestSchema.safeParse({
    name: formData.get("name"),
    contactName: optional("contactName"),
    email: optional("email"),
    phone: optional("phone"),
    taxId: optional("taxId"),
    paymentTerms: paymentTerms ? Number(paymentTerms) : null,
    notes: optional("notes"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<Supplier>(`/businesses/${businessId}/suppliers`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/suppliers`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deactivateSupplierAction(
  businessId: string,
  supplierId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await apiJson(`/businesses/${businessId}/suppliers/${supplierId}/deactivate`, {
      method: "POST",
      body: "{}",
    });
    redirect(`/b/${businessId}/suppliers/${supplierId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function confirmSalesOrderAction(
  businessId: string,
  salesOrderId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await apiJson(`/businesses/${businessId}/sales-orders/${salesOrderId}/confirm`, {
      method: "POST",
      body: "{}",
    });
    redirect(`/b/${businessId}/sales-orders/${salesOrderId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelSalesOrderAction(
  businessId: string,
  salesOrderId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await apiJson(`/businesses/${businessId}/sales-orders/${salesOrderId}/cancel`, {
      method: "POST",
      body: "{}",
    });
    redirect(`/b/${businessId}/sales-orders/${salesOrderId}`);
  } catch (error) {
    return actionError(error);
  }
}

function readLinesFromFormData(formData: FormData): Array<Record<string, string>> {
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const unitPrices = formData.getAll("unitPrice").map(String);
  const taxRates = formData.getAll("taxRatePercent").map(String);
  return descriptions.map((description, i) => ({
    description,
    quantity: quantities[i] || "1",
    unitPrice: unitPrices[i] || "0",
    taxRatePercent: taxRates[i] || "0",
  }));
}

export async function convertLeadAction(businessId: string, leadId: string): Promise<ActionState> {
  try {
    await apiJson<Lead>(`/businesses/${businessId}/leads/${leadId}/convert`, {
      method: "POST",
      body: "{}",
    });
    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOpportunityStageAction(
  businessId: string,
  opportunityId: string,
  stage: string,
): Promise<ActionState> {
  const parsed = opportunityStageSchema.safeParse(stage);
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<Opportunity>(`/businesses/${businessId}/opportunities/${opportunityId}`, {
      method: "PUT",
      body: JSON.stringify({ stage: parsed.data }),
    });
    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function createInventoryItemAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  const taxRatePpm = optional("taxRatePpm");
  const reorderLevel = optional("reorderLevel");

  const parsed = createInventoryItemRequestSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: optional("description"),
    itemType: optional("itemType") ?? undefined,
    unit: optional("unit"),
    costPriceMinor: optional("costPriceMinor"),
    sellingPriceMinor: optional("sellingPriceMinor"),
    taxRatePpm: taxRatePpm === null ? undefined : Number(taxRatePpm),
    reorderLevel: reorderLevel === null ? null : Number(reorderLevel),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<InventoryItem>(`/businesses/${businessId}/inventory`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/inventory`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createProjectAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };

  const parsed = createProjectRequestSchema.safeParse({
    name: formData.get("name"),
    description: optional("description"),
    customerId: optional("customerId") ?? undefined,
    startDate: optional("startDate"),
    endDate: optional("endDate"),
    budgetMinor: optional("budgetMinor"),
    notes: optional("notes"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  try {
    await apiJson<Project>(`/businesses/${businessId}/projects`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/projects`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createCreditNoteAction(
  businessId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const unitPrices = formData.getAll("unitPrice").map(String);
  const taxRates = formData.getAll("taxRatePercent").map(String);

  const lines = descriptions.map((description, i) => ({
    description,
    quantity: quantities[i] ?? "",
    unitPrice: unitPrices[i] ?? "",
    taxRatePercent: taxRates[i] ?? "0",
  }));

  const parsed = createCreditNoteRequestSchema.safeParse({
    customerId: formData.get("customerId"),
    referenceInvoiceId: String(formData.get("referenceInvoiceId") ?? "").trim() || undefined,
    reason: formData.get("reason"),
    issueDate: String(formData.get("issueDate") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || null,
    lines,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };

  // The API creates the credit note as DRAFT; issuing is a separate action and is not triggered here.
  try {
    await apiJson<CreditNote>(`/businesses/${businessId}/credit-notes`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    redirect(`/b/${businessId}/credit-notes`);
  } catch (error) {
    return actionError(error);
  }
}

"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import {
  confirmPasswordResetRequestSchema,
  requestPasswordResetRequestSchema,
  signUpRequestSchema,
} from "@bizo/contracts/auth";
import { createCustomerRequestSchema, type Customer } from "@bizo/contracts/customers";
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

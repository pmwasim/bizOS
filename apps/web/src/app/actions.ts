"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signUpRequestSchema } from "@bizo/contracts/auth";
import { createCustomerRequestSchema, type Customer } from "@bizo/contracts/customers";
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

import { signIn, signOut } from "@/auth";
import { ApiError, apiJson, publicApiFetch } from "@/lib/api";

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
    redirect(`/b/${business.id}`);
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

function actionError(error: unknown): ActionState {
  if (error instanceof ApiError) return { error: error.message };
  throw error;
}

function validationMessage(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Check the information and try again.";
}

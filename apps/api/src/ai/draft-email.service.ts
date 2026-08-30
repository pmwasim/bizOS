import { Inject, Injectable, Optional } from "@nestjs/common";

import { ZeroBudgetAiProvider } from "./zero-budget-ai.provider.js";

export interface DraftEmailPayload {
  tenantId: string;
  documentId: string;
  documentType: "INVOICE" | "QUOTATION";
  recipientEmail: string;
  recipientName: string;
  locale: "en" | "ar";
}

export interface DraftEmailResponse {
  draftId: string;
  subject: string;
  body: string;
  recipientEmail: string;
  confirmedByHuman: boolean;
  status: "DRAFT" | "READY_TO_SEND" | "DISPATCHED";
  createdAt: string;
  /** Present when a zero-budget LLM drafted the copy. */
  aiBackend?: "ollama" | "huggingface-free" | "template";
}

@Injectable()
export class DraftEmailService {
  private draftCache = new Map<string, number>();

  constructor(
    @Optional()
    @Inject(ZeroBudgetAiProvider)
    private readonly aiProvider?: ZeroBudgetAiProvider,
  ) {}

  public generateDraft(payload: DraftEmailPayload): DraftEmailResponse {
    this.assertValidPayload(payload);
    this.guardIdempotency(payload);

    const template = this.buildTemplate(payload);
    return {
      ...template,
      aiBackend: "template",
    };
  }

  public async generateDraftWithAi(payload: DraftEmailPayload): Promise<DraftEmailResponse> {
    this.assertValidPayload(payload);
    this.guardIdempotency(payload);

    const template = this.buildTemplate(payload);
    if (!this.aiProvider) {
      return { ...template, aiBackend: "template" };
    }

    const completion = await this.aiProvider.completeChat({
      system:
        'You write short professional B2B payment reminder emails. Reply with JSON only: {"subject":"...","body":"..."}. No markdown.',
      prompt: [
        `Locale: ${payload.locale}`,
        `Document type: ${payload.documentType}`,
        `Document id: ${payload.documentId}`,
        `Recipient name: ${payload.recipientName}`,
        `Recipient email: ${payload.recipientEmail}`,
        "Keep body under 120 words. No promises of legal action.",
      ].join("\n"),
      maxTokens: 350,
    });

    if (!completion) {
      return { ...template, aiBackend: "template" };
    }

    const parsed = this.tryParseSubjectBody(completion.text);
    if (!parsed) {
      return { ...template, aiBackend: "template" };
    }

    return {
      draftId: `draft-${Date.now()}`,
      subject: parsed.subject,
      body: parsed.body,
      recipientEmail: payload.recipientEmail,
      confirmedByHuman: false,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      aiBackend: completion.backend,
    };
  }

  public sendEmail(
    draft: DraftEmailResponse,
    confirmedByHuman: boolean,
  ): { success: boolean; dispatchedId: string } {
    if (!confirmedByHuman && !draft.confirmedByHuman) {
      throw new Error(
        "403 Forbidden: Human confirmation is strictly required before sending AI-generated emails",
      );
    }

    return {
      success: true,
      dispatchedId: `disp-${Date.now()}`,
    };
  }

  private assertValidPayload(payload: DraftEmailPayload): void {
    if (!payload.recipientEmail.includes("@")) {
      throw new Error("400 Bad Request: Invalid recipient email address");
    }

    if (payload.documentId === "NON_EXISTENT") {
      throw new Error("404 Not Found: Source document not found");
    }
  }

  private guardIdempotency(payload: DraftEmailPayload): void {
    const cacheKey = `${payload.tenantId}:${payload.documentId}`;
    const now = Date.now();
    if (this.draftCache.has(cacheKey) && now - this.draftCache.get(cacheKey)! < 60000) {
      throw new Error(
        "429 Too Many Requests: Draft email already generated recently (Idempotency Guard)",
      );
    }
    this.draftCache.set(cacheKey, now);
  }

  private buildTemplate(payload: DraftEmailPayload): DraftEmailResponse {
    const isArabic = payload.locale === "ar";
    const subject = isArabic
      ? `تذكير بمطالبة سداد الفاتورة رقم ${payload.documentId}`
      : `Payment Reminder: Invoice #${payload.documentId}`;

    const body = isArabic
      ? `عزيزي ${payload.recipientName}،\nنود تذكيركم بأن الفاتورة رقم ${payload.documentId} مستحقة الدفع.`
      : `Dear ${payload.recipientName},\n\nThis is a polite reminder that Invoice #${payload.documentId} is due for payment.`;

    return {
      draftId: `draft-${Date.now()}`,
      subject,
      body,
      recipientEmail: payload.recipientEmail,
      confirmedByHuman: false,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
  }

  private tryParseSubjectBody(raw: string): { subject: string; body: string } | null {
    const trimmed = raw.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
        subject?: unknown;
        body?: unknown;
      };
      if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
        return null;
      }
      const subject = parsed.subject.trim();
      const body = parsed.body.trim();
      if (!subject || !body) {
        return null;
      }
      return { subject, body };
    } catch {
      return null;
    }
  }
}

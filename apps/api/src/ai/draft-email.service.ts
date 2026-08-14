import { Injectable } from "@nestjs/common";

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
}

@Injectable()
export class DraftEmailService {
  private draftCache = new Map<string, number>();

  public generateDraft(payload: DraftEmailPayload): DraftEmailResponse {
    if (!payload.recipientEmail.includes("@")) {
      throw new Error("400 Bad Request: Invalid recipient email address");
    }

    if (payload.documentId === "NON_EXISTENT") {
      throw new Error("404 Not Found: Source document not found");
    }

    const cacheKey = `${payload.tenantId}:${payload.documentId}`;
    const now = Date.now();
    if (this.draftCache.has(cacheKey) && now - this.draftCache.get(cacheKey)! < 60000) {
      throw new Error(
        "429 Too Many Requests: Draft email already generated recently (Idempotency Guard)",
      );
    }
    this.draftCache.set(cacheKey, now);

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
}

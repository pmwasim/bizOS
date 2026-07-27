import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

import { readApiEnvironment } from "@bizo/config/api";

export interface QuotationMessage {
  attachment: Buffer;
  body: string | null;
  businessName: string;
  filename: string;
  quotationNumber: string;
  recipient: string;
}

type MailTransport =
  | {
      kind: "smtp";
      transporter: Transporter;
    }
  | {
      kind: "resend-https";
      apiKey: string;
    };

function parseSmtpUrl(smtpUrl: string): URL {
  return new URL(smtpUrl);
}

function createMailTransport(smtpUrl: string): MailTransport {
  const parsed = parseSmtpUrl(smtpUrl);
  const host = parsed.hostname.toLowerCase();
  // Render free web services block outbound SMTP (25/465/587). Resend HTTPS works.
  if (host === "smtp.resend.com") {
    const apiKey = decodeURIComponent(parsed.password || parsed.username);
    if (!apiKey) {
      throw new Error("Resend SMTP_URL is missing the API key password.");
    }
    return { kind: "resend-https", apiKey };
  }

  return {
    kind: "smtp",
    transporter: nodemailer.createTransport({
      url: smtpUrl,
      pool: true,
      maxConnections: 5,
      disableFileAccess: true,
      disableUrlAccess: true,
    }),
  };
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly from: string;
  private readonly transport: MailTransport;

  constructor() {
    const environment = readApiEnvironment(process.env);
    this.from = environment.SMTP_FROM;
    this.transport = createMailTransport(environment.SMTP_URL);
  }

  async sendQuotation(message: QuotationMessage): Promise<string> {
    const subject = `Quotation ${message.quotationNumber} from ${message.businessName}`;
    const text =
      message.body ??
      `${message.businessName} has sent you quotation ${message.quotationNumber}. The quotation is attached as a PDF.`;

    if (this.transport.kind === "resend-https") {
      return this.sendViaResendHttps({
        apiKey: this.transport.apiKey,
        subject,
        text,
        message,
      });
    }

    const result = await this.transport.transporter.sendMail({
      from: this.from,
      to: message.recipient,
      subject,
      text,
      attachments: [
        {
          filename: message.filename,
          content: message.attachment,
          contentType: "application/pdf",
        },
      ],
    });
    return String(result.messageId);
  }

  private async sendViaResendHttps(input: {
    apiKey: string;
    message: QuotationMessage;
    subject: string;
    text: string;
  }): Promise<string> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.message.recipient],
        subject: input.subject,
        text: input.text,
        attachments: [
          {
            filename: input.message.filename,
            content: input.message.attachment.toString("base64"),
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;

    if (!response.ok) {
      const detail = payload?.message ?? payload?.name ?? `http=${response.status}`;
      throw new Error(`Resend HTTPS send failed: ${detail}`);
    }

    if (!payload?.id) {
      throw new Error("Resend HTTPS send failed: missing message id.");
    }

    return payload.id;
  }

  onModuleDestroy(): void {
    if (this.transport.kind === "smtp") {
      this.transport.transporter.close();
    }
  }
}

export const mailTransportForTests = { createMailTransport };

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

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly from: string;
  private readonly transporter: Transporter;

  constructor() {
    const environment = readApiEnvironment(process.env);
    this.from = environment.SMTP_FROM;
    this.transporter = nodemailer.createTransport({
      url: environment.SMTP_URL,
      pool: true,
      maxConnections: 5,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async sendQuotation(message: QuotationMessage): Promise<string> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: message.recipient,
      subject: `Quotation ${message.quotationNumber} from ${message.businessName}`,
      text:
        message.body ??
        `${message.businessName} has sent you quotation ${message.quotationNumber}. The quotation is attached as a PDF.`,
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

  onModuleDestroy(): void {
    this.transporter.close();
  }
}

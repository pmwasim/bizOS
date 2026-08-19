import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

import {
  documentTemplateSchema,
  readableTextColor,
  type DocumentTemplate,
} from "@bizo/contracts/document-templates";
import { formatScaledInteger } from "@bizo/contracts/money";

import { type InvoiceSnapshot } from "./invoice-snapshot.js";
import { type QuotationSnapshot } from "./quotation-snapshot.js";
import { type ReceiptSnapshot } from "./receipt-snapshot.js";
import { type StatementSnapshot } from "./statement-snapshot.js";

const AGEING_LABELS: Array<{ key: keyof StatementSnapshot["buckets"]; label: string }> = [
  { key: "notDueMinor", label: "Not yet due" },
  { key: "days1To30Minor", label: "1 - 30 days" },
  { key: "days31To60Minor", label: "31 - 60 days" },
  { key: "days61To90Minor", label: "61 - 90 days" },
  { key: "daysOver90Minor", label: "Over 90 days" },
];

type MoneySnapshot = {
  currencyCode: string;
  currencyScale: number;
};

@Injectable()
export class PdfService {
  async renderQuotation(snapshot: QuotationSnapshot, template?: DocumentTemplate): Promise<Buffer> {
    const resolved = this.resolveTemplate(template);
    return this.renderCommercialDocument({
      title: "QUOTATION",
      documentTitle: `Quotation ${snapshot.number}`,
      subject: `Quotation for ${snapshot.customer.name}`,
      snapshot,
      template: resolved,
      metaLines: [`Issued ${snapshot.issueDate}`, `Valid until ${snapshot.validUntil}`],
      footer:
        resolved.quotationFooter ??
        `Thank you for the opportunity to work with you. This quotation is valid until ${snapshot.validUntil}.`,
      extraCustomerLines: [],
    });
  }

  async renderInvoice(snapshot: InvoiceSnapshot, template?: DocumentTemplate): Promise<Buffer> {
    const resolved = this.resolveTemplate(template);
    const extras: string[] = [];
    if (snapshot.poNumber) extras.push(`Customer PO: ${snapshot.poNumber}`);
    if (snapshot.projectReference) extras.push(`Reference: ${snapshot.projectReference}`);
    return this.renderCommercialDocument({
      title: "INVOICE",
      documentTitle: `Invoice ${snapshot.number}`,
      subject: `Invoice for ${snapshot.customer.name}`,
      snapshot,
      template: resolved,
      metaLines: [`Issued ${snapshot.issueDate}`, `Due ${snapshot.dueDate}`],
      footer:
        resolved.invoiceFooter ??
        `Payment is due by ${snapshot.dueDate}. Thank you for your business.`,
      extraCustomerLines: extras,
    });
  }

  /**
   * A payment receipt: proof that a customer payment was recorded, showing the amount tendered, how
   * it was applied across invoices, and the balance each invoice still carries.
   *
   * Like a statement this is derived on read with no stored version, so it gets its own layout
   * rather than the line-item priced table of a commercial document.
   */
  renderReceipt(snapshot: ReceiptSnapshot, template?: DocumentTemplate): Promise<Buffer> {
    const resolved = this.resolveTemplate(template);
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Receipt ${snapshot.receiptNumber}`,
          Author: snapshot.business.name,
          Subject: `Receipt for ${snapshot.customer?.name ?? snapshot.business.name}`,
        },
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      const cobalt = resolved.accentColor;
      const charcoal = "#172033";
      const muted = "#667085";
      const rule = "#dfe3ea";

      document
        .fillColor(cobalt)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(resolved.headerText ?? snapshot.business.name);
      document.fillColor(charcoal).fontSize(26).text("RECEIPT", 350, 50, {
        align: "right",
        width: 195,
      });

      document
        .fillColor(charcoal)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(snapshot.business.name, 50, 100);
      if (snapshot.business.legalName) {
        document.fillColor(muted).fontSize(9).font("Helvetica").text(snapshot.business.legalName);
      }
      document.fillColor(muted).fontSize(9).font("Helvetica");
      for (const line of snapshot.business.address) document.text(line);
      if (snapshot.business.email) document.text(snapshot.business.email);
      if (snapshot.business.phone) document.text(snapshot.business.phone);
      if (resolved.showTaxRegistration && snapshot.business.taxRegistrationNumber) {
        document.text(
          `${snapshot.business.taxName} number: ${snapshot.business.taxRegistrationNumber}`,
        );
      }

      // Payment metadata block, right-aligned under the RECEIPT wordmark.
      document
        .fillColor(charcoal)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`No. ${snapshot.receiptNumber}`, 350, 100, { align: "right", width: 195 });
      document.font("Helvetica").fillColor(muted).fontSize(9);
      document.text(`Received ${snapshot.paymentDate}`, { align: "right", width: 195 });
      document.text(snapshot.method, { align: "right", width: 195 });
      document.text(`Status: ${snapshot.status}`, { align: "right", width: 195 });
      if (snapshot.reference) {
        document.text(`Reference: ${snapshot.reference}`, { align: "right", width: 195 });
      }

      // Received-from block.
      document.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("RECEIVED FROM", 50, 205);
      document
        .fillColor(charcoal)
        .fontSize(13)
        .text(snapshot.customer?.name ?? "On account", 50, 223);
      if (snapshot.customer) {
        document.font("Helvetica").fillColor(muted).fontSize(9);
        for (const line of snapshot.customer.address) document.text(line);
        if (snapshot.customer.email) document.text(snapshot.customer.email);
        if (snapshot.customer.phone) document.text(snapshot.customer.phone);
      }

      // Allocations: what the payment settled, and the balance each invoice still carries.
      let y = 300;
      this.drawReceiptHeader(document, y, rule, muted);
      y += 26;
      if (snapshot.allocations.length === 0) {
        document
          .fillColor(muted)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text("Received on account — not applied to a specific invoice.", 50, y + 8, {
            width: 495,
          });
        y += 26;
      }
      for (const allocation of snapshot.allocations) {
        if (y > 690) {
          document.addPage();
          y = 60;
          this.drawReceiptHeader(document, y, rule, muted);
          y += 26;
        }
        const label =
          allocation.kind === "INVOICE"
            ? `Invoice ${allocation.reference}`
            : allocation.kind === "PURCHASE_ORDER"
              ? `Purchase order ${allocation.reference}`
              : allocation.reference;
        const rowHeight = Math.max(28, document.heightOfString(label, { width: 300 }) + 14);
        document.font("Helvetica").fontSize(9).fillColor(charcoal);
        document.text(label, 50, y + 8, { width: 300 });
        document.text(this.money(allocation.amountMinor, snapshot), 355, y + 8, {
          align: "right",
          width: 90,
        });
        document.text(
          allocation.remainingMinor === null
            ? "—"
            : this.money(allocation.remainingMinor, snapshot),
          455,
          y + 8,
          { align: "right", width: 90 },
        );
        document
          .moveTo(50, y + rowHeight)
          .lineTo(545, y + rowHeight)
          .strokeColor(rule)
          .stroke();
        y += rowHeight;
      }

      // Totals: applied and (if any) the surplus left on account, then the amount received.
      y += 18;
      this.drawTotal(document, "Applied", snapshot.allocatedMinor, snapshot, y, muted);
      if (BigInt(snapshot.unallocatedMinor) > 0n) {
        y += 22;
        this.drawTotal(document, "On account", snapshot.unallocatedMinor, snapshot, y, muted);
      }
      y += 24;
      document
        .roundedRect(350, y, 195, 42, 7)
        .fill(cobalt)
        .fillColor(readableTextColor(cobalt))
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("RECEIVED", 365, y + 14, { width: 75 });
      document.text(this.money(snapshot.amountMinor, snapshot), 425, y + 14, {
        align: "right",
        width: 105,
      });

      const footer = snapshot.notes
        ? snapshot.notes
        : `Thank you. This receipt confirms ${snapshot.currencyCode} ${formatScaledInteger(
            BigInt(snapshot.amountMinor),
            snapshot.currencyScale,
          )} received on ${snapshot.paymentDate}.`;
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8)
        .text(footer, 50, 770, { align: "center", width: 495 });
      document.end();
    });
  }

  private drawReceiptHeader(
    document: PDFKit.PDFDocument,
    y: number,
    rule: string,
    muted: string,
  ): void {
    document
      .rect(50, y, 495, 26)
      .fill("#f5f7fa")
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("APPLIED TO", 58, y + 9, { width: 287 })
      .text("AMOUNT", 355, y + 9, { align: "right", width: 90 })
      .text("BALANCE", 455, y + 9, { align: "right", width: 90 });
    document
      .moveTo(50, y + 26)
      .lineTo(545, y + 26)
      .strokeColor(rule)
      .stroke();
  }

  /**
   * A customer account statement: the running ledger of what they were charged, what they paid, and
   * the balance they carry, followed by how overdue the outstanding amount is.
   *
   * Unlike an invoice this has no line-item pricing table — it is a chronological ledger with a
   * signed running balance, so it gets its own layout rather than reusing the commercial-document
   * renderer.
   */
  renderStatement(snapshot: StatementSnapshot, template?: DocumentTemplate): Promise<Buffer> {
    const resolved = this.resolveTemplate(template);
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Statement for ${snapshot.customer.name}`,
          Author: snapshot.business.name,
          Subject: `Account statement as of ${snapshot.asOf}`,
        },
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      const cobalt = resolved.accentColor;
      const charcoal = "#172033";
      const muted = "#667085";
      const rule = "#dfe3ea";

      document
        .fillColor(cobalt)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(resolved.headerText ?? snapshot.business.name);
      document
        .fillColor(charcoal)
        .fontSize(26)
        .text("STATEMENT", 350, 50, { align: "right", width: 195 });

      document
        .fillColor(charcoal)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(snapshot.business.name, 50, 100);
      if (snapshot.business.legalName) {
        document.fillColor(muted).fontSize(9).font("Helvetica").text(snapshot.business.legalName);
      }
      document.fillColor(muted).fontSize(9).font("Helvetica");
      for (const line of snapshot.business.address) document.text(line);
      if (snapshot.business.email) document.text(snapshot.business.email);
      if (snapshot.business.phone) document.text(snapshot.business.phone);
      if (resolved.showTaxRegistration && snapshot.business.taxRegistrationNumber) {
        document.text(
          `${snapshot.business.taxName} number: ${snapshot.business.taxRegistrationNumber}`,
        );
      }

      const period =
        snapshot.periodStart || snapshot.periodEnd
          ? `${snapshot.periodStart ?? "opening"} to ${snapshot.periodEnd ?? snapshot.asOf}`
          : "All activity";
      document.fillColor(muted).font("Helvetica").fontSize(9);
      document.text(`Period: ${period}`, 350, 100, { align: "right", width: 195 });
      document.text(`As of ${snapshot.asOf}`, { align: "right", width: 195 });

      document.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("STATEMENT FOR", 50, 200);
      document.fillColor(charcoal).fontSize(13).text(snapshot.customer.name, 50, 218);
      document.font("Helvetica").fillColor(muted).fontSize(9);
      for (const line of snapshot.customer.address) document.text(line);
      if (snapshot.customer.email) document.text(snapshot.customer.email);
      if (snapshot.customer.phone) document.text(snapshot.customer.phone);

      // Summary of the period, boxed on the right so the balance owed reads at a glance.
      let sy = 200;
      const summaryRows: Array<[string, string]> = [
        ["Balance brought forward", this.signedMoney(snapshot.openingBalanceMinor, snapshot)],
        ["Invoiced in period", this.money(snapshot.totalInvoicedMinor, snapshot)],
        ["Paid in period", this.money(snapshot.totalPaidMinor, snapshot)],
        ["Credited in period", this.money(snapshot.totalCreditedMinor, snapshot)],
      ];
      for (const [label, value] of summaryRows) {
        document
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(9)
          .text(label, 300, sy, { width: 140 });
        document
          .fillColor(charcoal)
          .font("Helvetica-Bold")
          .text(value, 440, sy, { align: "right", width: 105 });
        sy += 16;
      }
      sy += 6;
      document
        .roundedRect(300, sy, 245, 34, 7)
        .fill(cobalt)
        .fillColor(readableTextColor(cobalt))
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("BALANCE OWED", 312, sy + 11, { width: 120 });
      document.text(this.signedMoney(snapshot.closingBalanceMinor, snapshot), 432, sy + 11, {
        align: "right",
        width: 105,
      });

      let y = 320;
      this.drawStatementHeader(document, y, rule, muted);
      y += 26;
      if (snapshot.lines.length === 0) {
        document
          .fillColor(muted)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text("No activity in this period.", 50, y + 8, { width: 495 });
        y += 26;
      }
      for (const line of snapshot.lines) {
        if (y > 700) {
          document.addPage();
          y = 60;
          this.drawStatementHeader(document, y, rule, muted);
          y += 26;
        }
        const rowHeight = Math.max(
          24,
          document.heightOfString(line.description, { width: 205 }) + 12,
        );
        document.font("Helvetica").fontSize(9).fillColor(charcoal);
        document.text(line.date, 50, y + 6, { width: 62 });
        document.text(line.description, 115, y + 6, { width: 205 });
        document.text(this.optionalMoney(line.debitMinor, snapshot), 325, y + 6, {
          align: "right",
          width: 70,
        });
        document.text(this.optionalMoney(line.creditMinor, snapshot), 400, y + 6, {
          align: "right",
          width: 65,
        });
        document
          .font("Helvetica-Bold")
          .text(this.signedMoney(line.balanceMinor, snapshot), 470, y + 6, {
            align: "right",
            width: 75,
          });
        document
          .moveTo(50, y + rowHeight)
          .lineTo(545, y + rowHeight)
          .strokeColor(rule)
          .stroke();
        y += rowHeight;
      }

      // Ageing: how overdue the outstanding balance is, as of the statement date.
      y += 18;
      if (y > 690) {
        document.addPage();
        y = 60;
      }
      document
        .fillColor(muted)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("AGEING OF OUTSTANDING", 50, y);
      y += 16;
      const cellWidth = 495 / AGEING_LABELS.length;
      AGEING_LABELS.forEach((bucket, index) => {
        const x = 50 + index * cellWidth;
        document
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(8)
          .text(bucket.label, x, y, { width: cellWidth - 6 });
        document
          .fillColor(charcoal)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(this.money(snapshot.buckets[bucket.key], snapshot), x, y + 12, {
            width: cellWidth - 6,
          });
      });

      const footer =
        snapshot.otherCurrencies.length > 0
          ? `This statement covers ${snapshot.currencyCode} only. Documents in ${snapshot.otherCurrencies.join(", ")} are not included.`
          : `Balance owed as of ${snapshot.asOf}: ${snapshot.currencyCode} ${this.signedBare(snapshot.closingBalanceMinor, snapshot)}.`;
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8)
        .text(footer, 50, 770, { align: "center", width: 495 });
      document.end();
    });
  }

  private drawStatementHeader(
    document: PDFKit.PDFDocument,
    y: number,
    rule: string,
    muted: string,
  ): void {
    document
      .rect(50, y, 495, 22)
      .fill("#f5f7fa")
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("DATE", 58, y + 7, { width: 54 })
      .text("DESCRIPTION", 115, y + 7, { width: 205 })
      .text("CHARGED", 325, y + 7, { align: "right", width: 70 })
      .text("RECEIVED", 400, y + 7, { align: "right", width: 65 })
      .text("BALANCE", 470, y + 7, { align: "right", width: 75 });
    document
      .moveTo(50, y + 22)
      .lineTo(545, y + 22)
      .strokeColor(rule)
      .stroke();
  }

  /** Zero renders as an em dash so a busy ledger row does not read as a real movement of nothing. */
  private optionalMoney(amountMinor: string, snapshot: MoneySnapshot): string {
    return BigInt(amountMinor) === 0n ? "—" : this.money(amountMinor, snapshot);
  }

  /** A signed amount: the balance is negative when the customer is in credit. */
  private signedMoney(amountMinor: string, snapshot: MoneySnapshot): string {
    return `${snapshot.currencyCode} ${this.signedBare(amountMinor, snapshot)}`;
  }

  private signedBare(amountMinor: string, snapshot: MoneySnapshot): string {
    const value = BigInt(amountMinor);
    const magnitude = value < 0n ? -value : value;
    const formatted = formatScaledInteger(magnitude, snapshot.currencyScale);
    return value < 0n ? `-${formatted}` : formatted;
  }

  /**
   * A stored template is re-validated here rather than trusted. Rendering is the last step before a
   * document reaches a customer, and a malformed colour would otherwise reach PDFKit directly.
   */
  private resolveTemplate(template: DocumentTemplate | undefined): DocumentTemplate {
    if (!template) {
      return documentTemplateSchema.parse({});
    }
    const parsed = documentTemplateSchema.safeParse(template);
    return parsed.success ? parsed.data : documentTemplateSchema.parse({});
  }

  private renderCommercialDocument(input: {
    documentTitle: string;
    extraCustomerLines: string[];
    footer: string;
    metaLines: string[];
    snapshot: {
      business: QuotationSnapshot["business"];
      customer: QuotationSnapshot["customer"];
      lines: QuotationSnapshot["lines"];
      number: string;
      subtotalMinor: string;
      taxMinor: string;
      totalMinor: string;
    } & MoneySnapshot;
    subject: string;
    template: DocumentTemplate;
    title: string;
  }): Promise<Buffer> {
    const { snapshot, template } = input;
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: input.documentTitle,
          Author: snapshot.business.name,
          Subject: input.subject,
        },
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      const cobalt = template.accentColor;
      const charcoal = "#172033";
      const muted = "#667085";
      const rule = "#dfe3ea";

      document
        .fillColor(cobalt)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(template.headerText ?? snapshot.business.name);
      document
        .fillColor(charcoal)
        .fontSize(26)
        .text(input.title, 350, 50, { align: "right", width: 195 });
      document
        .fillColor(charcoal)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(snapshot.business.name, 50, 100);
      if (snapshot.business.legalName) {
        document.fillColor(muted).fontSize(9).font("Helvetica").text(snapshot.business.legalName);
      }
      for (const line of snapshot.business.address) {
        document.fillColor(muted).fontSize(9).text(line);
      }
      if (snapshot.business.email) document.text(snapshot.business.email);
      if (snapshot.business.phone) document.text(snapshot.business.phone);
      if (template.showTaxRegistration && snapshot.business.taxRegistrationNumber) {
        document.text(
          `${snapshot.business.taxName} number: ${snapshot.business.taxRegistrationNumber}`,
        );
      }

      document
        .fillColor(charcoal)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`No. ${snapshot.number}`, 350, 100, { align: "right", width: 195 });
      document.font("Helvetica").fillColor(muted);
      for (const line of input.metaLines) {
        document.text(line, { align: "right" });
      }

      document.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("PREPARED FOR", 50, 205);
      document.fillColor(charcoal).fontSize(13).text(snapshot.customer.name, 50, 223);
      document.font("Helvetica").fillColor(muted).fontSize(9);
      for (const line of snapshot.customer.address) document.text(line);
      if (snapshot.customer.email) document.text(snapshot.customer.email);
      if (snapshot.customer.phone) document.text(snapshot.customer.phone);
      for (const line of input.extraCustomerLines) document.text(line);

      let y = 300;
      this.drawTableHeader(document, y, rule, muted);
      y += 30;
      for (const line of snapshot.lines) {
        if (y > 690) {
          document.addPage();
          y = 60;
          this.drawTableHeader(document, y, rule, muted);
          y += 30;
        }
        const rowHeight = Math.max(
          32,
          document.heightOfString(line.description, { width: 240 }) + 16,
        );
        document
          .font("Helvetica")
          .fontSize(9)
          .fillColor(charcoal)
          .text(line.description, 50, y + 8, { width: 240 });
        document.text(line.quantity, 300, y + 8, { align: "right", width: 55 });
        document.text(this.money(line.unitPriceMinor, snapshot), 365, y + 8, {
          align: "right",
          width: 75,
        });
        document.text(this.money(line.totalMinor, snapshot), 450, y + 8, {
          align: "right",
          width: 95,
        });
        document
          .moveTo(50, y + rowHeight)
          .lineTo(545, y + rowHeight)
          .strokeColor(rule)
          .stroke();
        y += rowHeight;
      }

      y += 18;
      this.drawTotal(document, "Subtotal", snapshot.subtotalMinor, snapshot, y, muted);
      y += 22;
      this.drawTotal(document, snapshot.business.taxName, snapshot.taxMinor, snapshot, y, muted);
      y += 24;
      document
        .roundedRect(350, y, 195, 42, 7)
        .fill(cobalt)
        .fillColor(readableTextColor(cobalt))
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("TOTAL", 365, y + 14, { width: 55 });
      document.text(this.money(snapshot.totalMinor, snapshot), 425, y + 14, {
        align: "right",
        width: 105,
      });

      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8)
        .text(input.footer, 50, 755, { align: "center", width: 495 });
      document.end();
    });
  }

  private drawTableHeader(
    document: PDFKit.PDFDocument,
    y: number,
    rule: string,
    muted: string,
  ): void {
    document
      .rect(50, y, 495, 26)
      .fill("#f5f7fa")
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("DESCRIPTION", 58, y + 9, { width: 232 })
      .text("QTY", 300, y + 9, { align: "right", width: 55 })
      .text("PRICE", 365, y + 9, { align: "right", width: 75 })
      .text("AMOUNT", 450, y + 9, { align: "right", width: 87 });
    document
      .moveTo(50, y + 26)
      .lineTo(545, y + 26)
      .strokeColor(rule)
      .stroke();
  }

  private drawTotal(
    document: PDFKit.PDFDocument,
    label: string,
    amount: string,
    snapshot: MoneySnapshot,
    y: number,
    muted: string,
  ): void {
    document
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(9)
      .text(label, 365, y, { width: 75 })
      .fillColor("#172033")
      .font("Helvetica-Bold")
      .text(this.money(amount, snapshot), 450, y, { align: "right", width: 95 });
  }

  private money(amountMinor: string, snapshot: MoneySnapshot): string {
    return `${snapshot.currencyCode} ${formatScaledInteger(
      BigInt(amountMinor),
      snapshot.currencyScale,
    )}`;
  }
}

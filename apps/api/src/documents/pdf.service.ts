import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

import { formatScaledInteger } from "@bizo/contracts/money";

import { type QuotationSnapshot } from "./quotation-snapshot.js";

@Injectable()
export class PdfService {
  async renderQuotation(snapshot: QuotationSnapshot): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Quotation ${snapshot.number}`,
          Author: snapshot.business.name,
          Subject: `Quotation for ${snapshot.customer.name}`,
        },
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      const cobalt = "#2457d6";
      const charcoal = "#172033";
      const muted = "#667085";
      const rule = "#dfe3ea";

      document.fillColor(cobalt).fontSize(12).font("Helvetica-Bold").text("bizOS");
      document
        .fillColor(charcoal)
        .fontSize(26)
        .text("QUOTATION", 350, 50, { align: "right", width: 195 });
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
      if (snapshot.business.taxRegistrationNumber) {
        document.text(
          `${snapshot.business.taxName} number: ${snapshot.business.taxRegistrationNumber}`,
        );
      }

      document
        .fillColor(charcoal)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`No. ${snapshot.number}`, 350, 100, { align: "right", width: 195 });
      document
        .font("Helvetica")
        .fillColor(muted)
        .text(`Issued ${snapshot.issueDate}`, { align: "right" })
        .text(`Valid until ${snapshot.validUntil}`, { align: "right" });

      document.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("PREPARED FOR", 50, 205);
      document.fillColor(charcoal).fontSize(13).text(snapshot.customer.name, 50, 223);
      document.font("Helvetica").fillColor(muted).fontSize(9);
      for (const line of snapshot.customer.address) document.text(line);
      if (snapshot.customer.email) document.text(snapshot.customer.email);
      if (snapshot.customer.phone) document.text(snapshot.customer.phone);

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
        .fillColor("#ffffff")
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
        .text(
          `Thank you for the opportunity to work with you. This quotation is valid until ${snapshot.validUntil}.`,
          50,
          755,
          { align: "center", width: 495 },
        );
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
    snapshot: QuotationSnapshot,
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

  private money(amountMinor: string, snapshot: QuotationSnapshot): string {
    return `${snapshot.currencyCode} ${formatScaledInteger(
      BigInt(amountMinor),
      snapshot.currencyScale,
    )}`;
  }
}

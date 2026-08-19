import { CheckCircle2, ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

import { invoiceStatusLabel, type Invoice } from "@bizo/contracts/invoices";

import {
  deriveSettlementStatus,
  settlementStatusLabel,
  type Payment,
} from "@bizo/contracts/payments";

import { ArchiveInvoiceButton, MarkInvoiceReadyButton } from "@/components/invoice-actions";
import { SendInvoiceForm } from "@/components/send-invoice-form";
import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; invoiceId: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { businessId, invoiceId } = await params;
  const query = await searchParams;
  const [invoice, payments] = await Promise.all([
    apiJson<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}`),
    apiJson<Payment[]>(`/businesses/${businessId}/payments`),
  ]);
  const justSent = query.sent === "1";
  const pdfPath = `/api/businesses/${businessId}/invoices/${invoiceId}/pdf`;
  const canSend =
    invoice.status === "READY_TO_SEND" ||
    invoice.status === "SENT" ||
    invoice.status === "SEND_FAILED";
  const canMarkReady = invoice.status === "DRAFT";
  const canEdit = invoice.status === "DRAFT" || invoice.status === "READY_TO_SEND";
  const canArchive = invoice.status !== "ARCHIVED";

  const appliedPayments = payments.filter(
    (p) => p.allocations.some((a) => a.documentId === invoiceId) && p.status === "COMPLETED",
  );
  const amountPaidMinor = appliedPayments.reduce((acc, p) => {
    const alloc = p.allocations.find((a) => a.documentId === invoiceId);
    return acc + BigInt(alloc?.amountMinor || "0");
  }, 0n);
  const invoiceTotalMinor = BigInt(invoice.totalMinor);
  const amountDueMinor = invoiceTotalMinor - amountPaidMinor;
  const paymentStatus = settlementStatusLabel(
    deriveSettlementStatus(amountPaidMinor, invoiceTotalMinor),
  );

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/invoices`}>
          <ChevronLeft aria-hidden="true" size={18} /> Invoices
        </Link>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {canEdit ? (
            <Link
              className="button button-secondary"
              href={`/b/${businessId}/invoices/${invoiceId}/edit`}
            >
              Edit draft
            </Link>
          ) : null}
          <a className="button button-secondary" href={`${pdfPath}?download=1`}>
            <Download aria-hidden="true" size={17} /> Download PDF
          </a>
        </div>
      </div>
      {justSent ? (
        <div className="success-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Invoice sent</strong>A professional PDF was emailed to the customer.
          </span>
        </div>
      ) : null}
      <header className="preview-title">
        <div>
          <span className={`status status-${invoice.status.toLowerCase()}`}>
            {invoiceStatusLabel(invoice.status)}
          </span>
          <h1>{invoice.number}</h1>
          <p>For {invoice.customer.name}</p>
        </div>
      </header>

      <section className="panel readiness-panel">
        <h2>Customer PO</h2>
        <p>
          <strong>{invoice.poNumber ?? "Not set"}</strong>
          {invoice.projectReference ? ` · ${invoice.projectReference}` : ""}
        </p>
        <p>
          From quotation{" "}
          <Link href={`/b/${businessId}/quotations/${invoice.sourceQuotation.id}`}>
            {invoice.sourceQuotation.number}
          </Link>
          {invoice.purchaseOrder ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/b/${businessId}/purchase-orders/${invoice.purchaseOrder.id}`}>
                View PO
              </Link>
            </>
          ) : null}
        </p>
        <dl className="detail-grid">
          <div>
            <dt>Issue date</dt>
            <dd>{invoice.issueDate}</dd>
          </div>
          <div>
            <dt>Due date</dt>
            <dd>{invoice.dueDate}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatMoney(invoice.totalMinor, invoice.currencyCode, invoice.currencyScale)}</dd>
          </div>
          <div>
            <dt>Payment status</dt>
            <dd>
              {paymentStatus}
              {amountPaidMinor > 0n
                ? ` (${formatMoney(amountPaidMinor.toString(), invoice.currencyCode, invoice.currencyScale)} paid)`
                : ""}
            </dd>
          </div>
          <div>
            <dt>Amount due</dt>
            <dd>
              <strong>
                {formatMoney(
                  amountDueMinor.toString(),
                  invoice.currencyCode,
                  invoice.currencyScale,
                )}
              </strong>
            </dd>
          </div>
        </dl>
        <div className="section-heading" style={{ marginTop: "1rem", gap: "0.75rem" }}>
          {canMarkReady ? (
            <MarkInvoiceReadyButton businessId={businessId} invoiceId={invoiceId} />
          ) : null}
          {canArchive ? (
            <ArchiveInvoiceButton businessId={businessId} invoiceId={invoiceId} />
          ) : null}
        </div>
      </section>

      <div className="preview-grid">
        <div className="pdf-frame">
          <iframe src={pdfPath} title={`Preview of invoice ${invoice.number}`} />
        </div>
        {canSend ? (
          <SendInvoiceForm
            businessId={businessId}
            invoiceId={invoiceId}
            customerName={invoice.customer.name}
            customerEmail={invoice.customer.email}
            sent={invoice.status === "SENT"}
            sendFailed={invoice.status === "SEND_FAILED"}
          />
        ) : (
          <div className="send-panel">
            <span className="eyebrow">Sending</span>
            <h2>
              {invoice.status === "DRAFT"
                ? "Mark ready before sending"
                : "This invoice cannot be sent"}
            </h2>
          </div>
        )}
      </div>
    </div>
  );
}

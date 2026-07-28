import { CheckCircle2, ChevronLeft, Download, Plus } from "lucide-react";
import Link from "next/link";

import { invoiceStatusLabel, type Invoice } from "@bizo/contracts/invoices";
import {
  invoiceBalanceStatusLabel,
  paymentMethodLabel,
  type InvoicePaymentSummary,
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
  const invoice = await apiJson<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}`);
  let paymentSummary: InvoicePaymentSummary | null = null;
  if (invoice.status === "SENT" || invoice.status === "ARCHIVED") {
    try {
      paymentSummary = await apiJson<InvoicePaymentSummary>(
        `/businesses/${businessId}/invoices/${invoiceId}/payments`,
      );
    } catch {
      paymentSummary = null;
    }
  }
  const justSent = query.sent === "1";
  const pdfPath = `/api/businesses/${businessId}/invoices/${invoiceId}/pdf`;
  const canSend =
    invoice.status === "READY_TO_SEND" ||
    invoice.status === "SENT" ||
    invoice.status === "SEND_FAILED";
  const canMarkReady = invoice.status === "DRAFT";
  const canEdit = invoice.status === "DRAFT" || invoice.status === "READY_TO_SEND";
  const canArchive = invoice.status !== "ARCHIVED";
  const canRecordPayment =
    invoice.status === "SENT" && paymentSummary !== null && paymentSummary.balanceStatus !== "PAID";

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
          {paymentSummary ? (
            <span
              className={`status readiness-${paymentSummary.balanceStatus.toLowerCase()}`}
              style={{ marginLeft: "0.5rem" }}
            >
              {invoiceBalanceStatusLabel(paymentSummary.balanceStatus)}
            </span>
          ) : null}
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

      {paymentSummary ? (
        <section className="panel readiness-panel">
          <div className="section-heading">
            <h2>Payments</h2>
            {canRecordPayment ? (
              <Link
                className="button button-primary"
                href={`/b/${businessId}/payments/new?invoiceId=${invoice.id}`}
              >
                <Plus aria-hidden="true" size={16} /> Record payment
              </Link>
            ) : null}
          </div>
          <p>
            Outstanding{" "}
            <strong>
              {formatMoney(
                paymentSummary.outstandingMinor,
                invoice.currencyCode,
                invoice.currencyScale,
              )}
            </strong>{" "}
            of {formatMoney(paymentSummary.totalMinor, invoice.currencyCode, invoice.currencyScale)}
          </p>
          {paymentSummary.payments.length ? (
            <div className="data-list">
              {paymentSummary.payments.map((payment) => (
                <Link
                  key={payment.id}
                  className="data-row"
                  href={`/b/${businessId}/payments/${payment.id}`}
                >
                  <span className="grow">
                    <strong>{payment.number}</strong>
                    <small>
                      {paymentMethodLabel(payment.method)} · {payment.receivedOn}
                      {payment.status === "VOIDED" ? " · Voided" : ""}
                    </small>
                  </span>
                  <strong>
                    {formatMoney(
                      payment.allocationAmountMinor,
                      invoice.currencyCode,
                      invoice.currencyScale,
                    )}
                  </strong>
                </Link>
              ))}
            </div>
          ) : (
            <p>No payments recorded yet.</p>
          )}
        </section>
      ) : null}

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

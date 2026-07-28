import { CheckCircle2, ChevronLeft, Download, Plus } from "lucide-react";
import Link from "next/link";

import { type PurchaseOrder, type Readiness } from "@bizo/contracts/purchase-orders";
import { type Quotation } from "@bizo/contracts/quotations";

import { CreateInvoiceFromQuotationButton } from "@/components/invoice-actions";
import { SendQuotationForm } from "@/components/send-quotation-form";
import { apiJson } from "@/lib/api";

export default async function QuotationPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; quotationId: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { businessId, quotationId } = await params;
  const query = await searchParams;
  const [quotation, linked] = await Promise.all([
    apiJson<Quotation>(`/businesses/${businessId}/quotations/${quotationId}`),
    apiJson<{
      purchaseOrders: PurchaseOrder[];
      readiness: Readiness;
      customerPoRequired: boolean;
      canCreateInvoice: boolean;
    }>(`/businesses/${businessId}/quotations/${quotationId}/purchase-orders`),
  ]);
  const justSent = query.sent === "1";
  const pdfPath = `/api/businesses/${businessId}/quotations/${quotationId}/pdf`;
  const customerPoRequired = linked.customerPoRequired;
  const canCreateInvoice = linked.canCreateInvoice;

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/quotations`}>
          <ChevronLeft aria-hidden="true" size={18} /> Quotations
        </Link>
        <a className="button button-secondary" href={`${pdfPath}?download=1`}>
          <Download aria-hidden="true" size={17} /> Download PDF
        </a>
      </div>
      {justSent ? (
        <div className="success-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Quotation sent</strong>A professional PDF was emailed to{" "}
            {quotation.customer.email}.
          </span>
        </div>
      ) : null}
      <header className="preview-title">
        <div>
          <span className={`status status-${quotation.status.toLowerCase()}`}>
            {quotation.status === "SENT" ? "Sent" : "Draft"}
          </span>
          <h1>{quotation.number}</h1>
          <p>For {quotation.customer.name}</p>
        </div>
      </header>

      <section className="panel readiness-panel">
        <div className="section-heading">
          <h2>{customerPoRequired ? "Invoice readiness" : "Next step"}</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {canCreateInvoice ? (
              <CreateInvoiceFromQuotationButton
                businessId={businessId}
                quotationId={quotation.id}
              />
            ) : null}
            <Link
              className="button button-secondary"
              href={`/b/${businessId}/purchase-orders/new?customer=${quotation.customer.id}&quotation=${quotation.id}`}
            >
              <Plus aria-hidden="true" size={16} />{" "}
              {customerPoRequired ? "Add customer PO" : "Add customer PO (optional)"}
            </Link>
          </div>
        </div>
        <p>
          <span className={`status readiness-${linked.readiness.code.toLowerCase()}`}>
            {linked.readiness.label}
          </span>
        </p>
        <p>{linked.readiness.explanation}</p>
        {!customerPoRequired && quotation.status === "DRAFT" && !canCreateInvoice ? (
          <p>Send this quotation first, then you can create an invoice.</p>
        ) : null}
        {linked.purchaseOrders.length ? (
          <div className="data-list">
            {linked.purchaseOrders.map((purchaseOrder) => (
              <Link
                className="data-row"
                href={`/b/${businessId}/purchase-orders/${purchaseOrder.id}`}
                key={purchaseOrder.id}
              >
                <span className="grow">
                  <strong>{purchaseOrder.poNumber}</strong>
                  <small>{purchaseOrder.readiness.label}</small>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <div className="preview-grid">
        <div className="pdf-frame">
          <iframe src={pdfPath} title={`Preview of quotation ${quotation.number}`} />
        </div>
        <SendQuotationForm
          businessId={businessId}
          quotationId={quotationId}
          customerName={quotation.customer.name}
          customerEmail={quotation.customer.email}
          sent={quotation.status === "SENT"}
        />
      </div>
    </div>
  );
}

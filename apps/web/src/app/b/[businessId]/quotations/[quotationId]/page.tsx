import { CheckCircle2, ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

import { type Quotation } from "@bizo/contracts/quotations";

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
  const quotation = await apiJson<Quotation>(`/businesses/${businessId}/quotations/${quotationId}`);
  const justSent = query.sent === "1";
  const pdfPath = `/api/businesses/${businessId}/quotations/${quotationId}/pdf`;

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

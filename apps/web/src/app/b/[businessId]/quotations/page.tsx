import { FileText, Plus } from "lucide-react";
import Link from "next/link";

import { type Quotation } from "@bizo/contracts/quotations";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

function money(quotation: Quotation) {
  return formatMoney(quotation.totalMinor, quotation.currencyCode, quotation.currencyScale);
}

export default async function QuotationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const quotations = await apiJson<Quotation[]>(`/businesses/${businessId}/quotations`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Quotations</h1>
          <p>Drafts and quotations you’ve sent.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/quotations/new`}>
          <Plus aria-hidden="true" size={18} /> New quotation
        </Link>
      </header>
      {quotations.length ? (
        <div className="data-list">
          {quotations.map((quotation) => (
            <Link
              key={quotation.id}
              href={`/b/${businessId}/quotations/${quotation.id}`}
              className="data-row quotation-row"
            >
              <span>
                <strong>{quotation.number}</strong>
                <small>{quotation.customer.name}</small>
              </span>
              <span className="row-date">{quotation.issueDate}</span>
              <strong>{money(quotation)}</strong>
              <span className={`status status-${quotation.status.toLowerCase()}`}>
                {quotation.status === "SENT" ? "Sent" : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText aria-hidden="true" size={30} />
          <h2>Create your first quotation</h2>
          <p>A polished PDF is only a few fields away.</p>
        </div>
      )}
    </div>
  );
}

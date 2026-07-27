import { ScrollText } from "lucide-react";
import Link from "next/link";

import { invoiceStatusLabel, type Invoice } from "@bizo/contracts/invoices";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

function money(invoice: Invoice) {
  return formatMoney(invoice.totalMinor, invoice.currencyCode, invoice.currencyScale);
}

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const invoices = await apiJson<Invoice[]>(`/businesses/${businessId}/invoices`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Created from ready quotations and sent to customers.</p>
        </div>
      </header>
      {invoices.length ? (
        <div className="data-list">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/b/${businessId}/invoices/${invoice.id}`}
              className="data-row quotation-row"
            >
              <span>
                <strong>{invoice.number}</strong>
                <small>
                  {invoice.customer.name}
                  {invoice.poNumber ? ` · PO ${invoice.poNumber}` : ""}
                </small>
              </span>
              <span className="row-date">{invoice.dueDate}</span>
              <strong>{money(invoice)}</strong>
              <span className={`status status-${invoice.status.toLowerCase()}`}>
                {invoiceStatusLabel(invoice.status)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <ScrollText aria-hidden="true" size={30} />
          <h2>No invoices yet</h2>
          <p>When a quotation is ready to invoice, create the invoice from that quotation.</p>
        </div>
      )}
    </div>
  );
}

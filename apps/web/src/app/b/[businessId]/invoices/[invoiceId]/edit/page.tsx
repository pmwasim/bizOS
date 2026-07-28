import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { type Invoice } from "@bizo/contracts/invoices";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { InvoiceEditor } from "@/components/invoice-editor";
import { apiJson } from "@/lib/api";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ businessId: string; invoiceId: string }>;
}) {
  const { businessId, invoiceId } = await params;
  const [invoice, settings] = await Promise.all([
    apiJson<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);

  if (invoice.status !== "DRAFT" && invoice.status !== "READY_TO_SEND") {
    return (
      <div className="page">
        <Link className="back-link" href={`/b/${businessId}/invoices/${invoiceId}`}>
          <ChevronLeft aria-hidden="true" size={18} /> Back to invoice
        </Link>
        <h1>This invoice cannot be edited</h1>
        <p>Sent and archived invoices keep their original amounts and details.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Link className="back-link" href={`/b/${businessId}/invoices/${invoiceId}`}>
        <ChevronLeft aria-hidden="true" size={18} /> Back to invoice
      </Link>
      <header className="page-header">
        <div>
          <h1>Edit {invoice.number}</h1>
          <p>
            Customer PO {invoice.poNumber ?? "not set"}
            {invoice.projectReference ? ` · ${invoice.projectReference}` : ""}
          </p>
        </div>
      </header>
      <InvoiceEditor
        businessId={businessId}
        currency={invoice.currencyCode}
        invoice={invoice}
        locale={settings.locale}
      />
    </div>
  );
}

import { ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

import { type PurchaseOrder } from "@bizo/contracts/purchase-orders";

import { CreateInvoiceFromQuotationButton } from "@/components/invoice-actions";
import { PurchaseOrderActions } from "@/components/purchase-order-actions";
import { apiJson } from "@/lib/api";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; purchaseOrderId: string }>;
}) {
  const { businessId, purchaseOrderId } = await params;
  const purchaseOrder = await apiJson<PurchaseOrder>(
    `/businesses/${businessId}/purchase-orders/${purchaseOrderId}`,
  );
  const readyToInvoice =
    purchaseOrder.readiness.code === "READY_TO_INVOICE" && Boolean(purchaseOrder.quotation);

  return (
    <div className="page">
      <Link className="back-link" href={`/b/${businessId}/purchase-orders`}>
        <ChevronLeft aria-hidden="true" size={18} /> Purchase orders
      </Link>
      <header className="preview-title">
        <div>
          <span className={`status readiness-${purchaseOrder.readiness.code.toLowerCase()}`}>
            {purchaseOrder.readiness.label}
          </span>
          <h1>{purchaseOrder.poNumber}</h1>
          <p>
            {purchaseOrder.customer.name}
            {purchaseOrder.quotation ? ` · Linked to ${purchaseOrder.quotation.number}` : ""}
          </p>
        </div>
      </header>

      <section className="panel readiness-panel">
        <div className="section-heading">
          <h2>Ready to invoice?</h2>
          {readyToInvoice && purchaseOrder.quotation ? (
            <CreateInvoiceFromQuotationButton
              businessId={businessId}
              quotationId={purchaseOrder.quotation.id}
            />
          ) : null}
        </div>
        <p>{purchaseOrder.readiness.explanation}</p>
      </section>

      <dl className="detail-grid">
        <div>
          <dt>PO date</dt>
          <dd>{purchaseOrder.poDate ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Project / job</dt>
          <dd>{purchaseOrder.projectReference ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>
            {purchaseOrder.amountMinor && purchaseOrder.currencyCode
              ? `${purchaseOrder.currencyCode} ${(
                  Number(purchaseOrder.amountMinor) /
                  10 ** (purchaseOrder.currencyScale ?? 2)
                ).toFixed(purchaseOrder.currencyScale ?? 2)}`
              : "Not set"}
          </dd>
        </div>
        <div>
          <dt>Approval</dt>
          <dd>{purchaseOrder.approvalStatus.replaceAll("_", " ").toLowerCase()}</dd>
        </div>
      </dl>

      {purchaseOrder.notes ? (
        <section className="panel">
          <h2>Notes</h2>
          <p>{purchaseOrder.notes}</p>
        </section>
      ) : null}

      <section className="panel">
        <h2>Files</h2>
        <ul className="file-list">
          <li>
            PO file:{" "}
            {purchaseOrder.poFile ? (
              <a
                href={`/api/businesses/${businessId}/purchase-orders/${purchaseOrderId}/files/${purchaseOrder.poFile.id}`}
              >
                <Download aria-hidden="true" size={16} /> {purchaseOrder.poFile.originalFilename}
              </a>
            ) : (
              "Not uploaded"
            )}
          </li>
          <li>
            Approval evidence:{" "}
            {purchaseOrder.approvalEvidence ? (
              <a
                href={`/api/businesses/${businessId}/purchase-orders/${purchaseOrderId}/files/${purchaseOrder.approvalEvidence.id}`}
              >
                <Download aria-hidden="true" size={16} />{" "}
                {purchaseOrder.approvalEvidence.originalFilename}
              </a>
            ) : (
              "Not uploaded"
            )}
          </li>
        </ul>
      </section>

      {purchaseOrder.status === "ACTIVE" ? (
        <PurchaseOrderActions
          businessId={businessId}
          purchaseOrderId={purchaseOrderId}
          approvalStatus={purchaseOrder.approvalStatus}
        />
      ) : null}
    </div>
  );
}

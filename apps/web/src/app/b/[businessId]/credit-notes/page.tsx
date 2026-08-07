import { Plus, ReceiptText } from "lucide-react";
import Link from "next/link";

import { creditNoteReasonLabel, type CreditNote } from "@bizo/contracts/credit-notes";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function CreditNotesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const notes = await apiJson<CreditNote[]>(`/businesses/${businessId}/credit-notes`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Credit Notes</h1>
          <p>Adjustments and corrections to issued invoices.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/credit-notes/new`}>
          <Plus aria-hidden="true" size={18} /> New credit note
        </Link>
      </header>
      {notes.length ? (
        <div className="data-list">
          {notes.map((note) => (
            <div className="data-row" key={note.id}>
              <span className="avatar">{note.number.slice(0, 1)}</span>
              <span className="grow">
                <strong>{note.number}</strong>
                <small>
                  {note.customer.name} &middot; {creditNoteReasonLabel(note.reason)} &middot;{" "}
                  {formatMinor(note.totalMinor, note.currencyScale, note.currencyCode)}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <ReceiptText aria-hidden="true" size={30} />
          <h2>No credit notes yet</h2>
          <p>Issue credit notes to correct or adjust invoices.</p>
        </div>
      )}
    </div>
  );
}

import { Plus, Truck } from "lucide-react";
import Link from "next/link";

import { deliveryNoteStatusLabel, type DeliveryNote } from "@bizo/contracts/delivery-notes";

import { apiJson } from "@/lib/api";

export default async function DeliveryNotesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const notes = await apiJson<DeliveryNote[]>(`/businesses/${businessId}/delivery-notes`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Delivery Notes</h1>
          <p>Record goods delivered or services completed.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/delivery-notes/new`}>
          <Plus aria-hidden="true" size={18} /> New delivery note
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
                  {note.customer.name} &middot; {deliveryNoteStatusLabel(note.status)}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Truck aria-hidden="true" size={30} />
          <h2>No delivery notes yet</h2>
          <p>Track fulfilment of your sales orders.</p>
        </div>
      )}
    </div>
  );
}

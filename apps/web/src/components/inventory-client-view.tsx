"use client";

import { useActionState, useState } from "react";
import { Package, Plus, X } from "lucide-react";

import { type InventoryItem } from "@bizo/contracts/inventory";
import { type ActionState, createInventoryItemAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/display";

export function InventoryClientView({
  businessId,
  initialItems,
  currency,
  currencyScale,
}: {
  businessId: string;
  initialItems: InventoryItem[];
  currency: string;
  currencyScale: number;
}) {
  const items = initialItems;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    createInventoryItemAction.bind(null, businessId),
    {},
  );

  // Stock valuation and low-stock alerts are not derivable yet: InventoryItem records a
  // reorder level but bizOS has no quantity-on-hand column and no stock-movement ledger, so
  // there is nothing to value or to compare a threshold against. Both were previously shown
  // from an assumed batch quantity of 20 and an AVCO factor of 0.96 — invented numbers. They
  // return with the stock-ledger slice, not before.

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Item catalogue</h1>
          <p>The products and services you sell, with their prices and tax rates.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus aria-hidden="true" size={18} /> Add item
        </button>
      </header>

      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr", margin: "1rem 0 2rem" }}>
        <a>
          <Package size={28} />
          <span>Catalogue items</span>
          <strong>{items.length}</strong>
        </a>
        <a>
          <Package size={28} />
          <span>Sold as services</span>
          <strong>{items.filter((item) => item.itemType === "SERVICE").length}</strong>
        </a>
      </div>

      <div className="empty-state" style={{ marginBottom: "2rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Stock levels are not tracked yet</h2>
        <p style={{ margin: "0.4rem 0 0" }}>
          bizOS records what you sell and what it costs, but it does not yet record how much of it
          you hold. Stock valuation (FIFO/AVCO) and low-stock alerts need a stock ledger, and will
          appear here once that ships rather than being estimated in the meantime.
        </p>
      </div>

      {/* Catalog Table */}
      <div className="recent-section">
        <div className="section-heading">
          <h2>Stock Catalog</h2>
          <small>{items.length} total items</small>
        </div>

        <div className="data-list">
          <div
            className="data-row"
            style={{
              fontWeight: 800,
              background: "var(--surface-subtle)",
              borderBottom: "2px solid var(--border)",
            }}
          >
            <span style={{ width: "130px" }}>SKU</span>
            <span className="grow">Item Name & Description</span>
            <span style={{ width: "110px" }}>Type</span>
            <span style={{ width: "80px" }}>Unit</span>
            <span style={{ width: "110px", textAlign: "right" }}>Cost Price</span>
            <span style={{ width: "110px", textAlign: "right" }}>Selling Price</span>
            <span style={{ width: "90px", textAlign: "right" }}>Tax Rate</span>
            <span style={{ width: "100px", textAlign: "right" }}>Reorder Lvl</span>
          </div>

          {items.length === 0 && (
            <div className="data-row">
              <span className="grow">
                <strong>No items yet</strong>
                <small>Add the products and services you sell to build your catalogue.</small>
              </span>
            </div>
          )}

          {items.map((item) => (
            <div className="data-row" key={item.id}>
              <strong style={{ width: "130px" }}>{item.sku}</strong>
              <span className="grow">
                <strong>{item.name}</strong>
                <small>{item.description || "No description provided"}</small>
              </span>
              <span style={{ width: "110px" }}>
                <span
                  className={`status ${item.itemType === "INVENTORY" ? "status-sent" : "status-draft"}`}
                >
                  {item.itemType}
                </span>
              </span>
              <span style={{ width: "80px" }}>{item.unit || "pcs"}</span>
              <span style={{ width: "110px", textAlign: "right" }}>
                {item.costPriceMinor
                  ? formatMoney(item.costPriceMinor, currency, currencyScale)
                  : "—"}
              </span>
              <strong style={{ width: "110px", textAlign: "right" }}>
                {item.sellingPriceMinor
                  ? formatMoney(item.sellingPriceMinor, currency, currencyScale)
                  : "—"}
              </strong>
              <span style={{ width: "90px", textAlign: "right" }}>
                {(item.taxRatePpm / 10000).toFixed(0)}%
              </span>
              <span style={{ width: "100px", textAlign: "right" }}>
                {item.reorderLevel !== null ? (
                  <span
                    style={{
                      color: item.reorderLevel > 0 ? "#b54708" : "inherit",
                      fontWeight: 700,
                    }}
                  >
                    {item.reorderLevel}
                  </span>
                ) : (
                  "—"
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal / Form */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: "2rem",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Add Stock Item</h2>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: "0.4rem 0.6rem", minHeight: "auto" }}
              >
                <X size={18} />
              </button>
            </div>

            <ActionMessage error={state.error} />

            <form action={formAction} className="form-stack">
              <div className="field-grid">
                <label className="field">
                  <span>SKU</span>
                  <input name="sku" placeholder="e.g. SKU-PRO-009" required />
                </label>

                <label className="field">
                  <span>Item Type</span>
                  <select name="itemType" defaultValue="INVENTORY">
                    <option value="INVENTORY">INVENTORY (Physical)</option>
                    <option value="SERVICE">SERVICE (Labor)</option>
                    <option value="NON_INVENTORY">NON_INVENTORY</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Item Name</span>
                <input name="name" placeholder="Product or service name" required />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Detailed product specification..."
                />
              </label>

              <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label className="field">
                  <span>Unit</span>
                  <input name="unit" placeholder="e.g. pcs, hrs" defaultValue="pcs" />
                </label>

                <label className="field">
                  <span>Cost Price (Minor)</span>
                  <input
                    name="costPriceMinor"
                    type="number"
                    placeholder="5000"
                    defaultValue="5000"
                  />
                </label>

                <label className="field">
                  <span>Selling Price (Minor)</span>
                  <input
                    name="sellingPriceMinor"
                    type="number"
                    placeholder="8500"
                    defaultValue="8500"
                  />
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Tax Rate (PPM: 150000 = 15%)</span>
                  <input name="taxRatePpm" type="number" defaultValue={150000} />
                </label>

                <label className="field">
                  <span>Reorder Level Threshold</span>
                  <input name="reorderLevel" type="number" defaultValue={10} />
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1rem",
                }}
              >
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <SubmitButton pendingText="Saving...">Save Stock Item</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

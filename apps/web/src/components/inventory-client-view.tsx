"use client";

import { useState } from "react";
import { Package, Plus, X } from "lucide-react";

import { type InventoryItem, type InventoryItemType } from "@bizo/contracts/inventory";
import { ActionMessage } from "@/components/action-message";
import { formatMoney } from "@/lib/display";

export function InventoryClientView({
  businessId,
  initialItems,
}: {
  businessId: string;
  initialItems: InventoryItem[];
}) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Form State
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<InventoryItemType>("INVENTORY");
  const [unit, setUnit] = useState("pcs");
  const [costPriceMinor, setCostPriceMinor] = useState("5000");
  const [sellingPriceMinor, setSellingPriceMinor] = useState("8500");
  const [taxRatePpm, setTaxRatePpm] = useState(150000); // 15%
  const [reorderLevel, setReorderLevel] = useState(10);

  // Stock valuation and low-stock alerts are not derivable yet: InventoryItem records a
  // reorder level but bizOS has no quantity-on-hand column and no stock-movement ledger, so
  // there is nothing to value or to compare a threshold against. Both were previously shown
  // from an assumed batch quantity of 20 and an AVCO factor of 0.96 — invented numbers. They
  // return with the stock-ledger slice, not before.

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      sku,
      name,
      description: description || undefined,
      itemType,
      unit: unit || undefined,
      costPriceMinor: costPriceMinor || undefined,
      sellingPriceMinor: sellingPriceMinor || undefined,
      taxRatePpm,
      reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : undefined,
    };

    try {
      const res = await fetch(`/api/businesses/${businessId}/inventory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newItem: InventoryItem = await res.json();
        setItems((prev) => [newItem, ...prev]);
        setIsModalOpen(false);
        return;
      }

      // The server rejected the item. Adding it to the list anyway would tell the
      // business it holds stock it does not hold.
      setError("The item could not be saved. Nothing was added.");
    } catch {
      setError("The item could not be saved — bizOS could not be reached. Nothing was added.");
    } finally {
      setLoading(false);
    }
  }

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
                {item.costPriceMinor ? formatMoney(item.costPriceMinor, "USD", 2) : "—"}
              </span>
              <strong style={{ width: "110px", textAlign: "right" }}>
                {item.sellingPriceMinor ? formatMoney(item.sellingPriceMinor, "USD", 2) : "—"}
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

            <ActionMessage error={error} />

            <form onSubmit={handleAddItem} className="form-stack">
              <div className="field-grid">
                <label className="field">
                  <span>SKU</span>
                  <input
                    placeholder="e.g. SKU-PRO-009"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  <span>Item Type</span>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as InventoryItemType)}
                  >
                    <option value="INVENTORY">INVENTORY (Physical)</option>
                    <option value="SERVICE">SERVICE (Labor)</option>
                    <option value="NON_INVENTORY">NON_INVENTORY</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Item Name</span>
                <input
                  placeholder="Product or service name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows={2}
                  placeholder="Detailed product specification..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label className="field">
                  <span>Unit</span>
                  <input
                    placeholder="e.g. pcs, hrs"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Cost Price (Minor)</span>
                  <input
                    type="number"
                    placeholder="5000"
                    value={costPriceMinor}
                    onChange={(e) => setCostPriceMinor(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Selling Price (Minor)</span>
                  <input
                    type="number"
                    placeholder="8500"
                    value={sellingPriceMinor}
                    onChange={(e) => setSellingPriceMinor(e.target.value)}
                  />
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Tax Rate (PPM: 150000 = 15%)</span>
                  <input
                    type="number"
                    value={taxRatePpm}
                    onChange={(e) => setTaxRatePpm(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Reorder Level Threshold</span>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                  />
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
                <button className="button button-primary" type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Stock Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

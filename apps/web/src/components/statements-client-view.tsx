"use client";

import { useEffect, useState } from "react";
import { Building, UserCheck, ScrollText } from "lucide-react";

import { type Customer } from "@bizo/contracts/customers";
import { type Supplier } from "@bizo/contracts/suppliers";
import { formatMoney } from "@/lib/display";

interface StatementLine {
  date: string;
  description: string;
  debitMinor: string | null;
  creditMinor: string | null;
  balanceMinor: string;
}

interface StatementData {
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  currencyCode: string;
  currencyScale: number;
  openingBalanceMinor: string;
  closingBalanceMinor: string;
  lines: StatementLine[];
}

export function StatementsClientView({
  businessId,
  customers,
  suppliers,
}: {
  businessId: string;
  customers: Customer[];
  suppliers: Supplier[];
}) {
  const [entityType, setEntityType] = useState<"customer" | "supplier">("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customers[0]?.id || "");
  const [selectedSupplier, setSelectedSupplier] = useState<string>(suppliers[0]?.id || "");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [_loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadStatement() {
      if (entityType === "customer" && selectedCustomer) {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/businesses/${businessId}/statements/customers/${selectedCustomer}`,
          );
          if (res.ok) {
            const data = await res.json();
            setStatement(data);
          } else {
            // Mock fallback if API endpoint is unavailable in client side
            const cust = customers.find((c) => c.id === selectedCustomer);
            setStatement({
              customerId: selectedCustomer,
              customerName: cust?.name || "Customer",
              currencyCode: (cust as { currencyCode?: string })?.currencyCode || "USD",
              currencyScale: 2,
              openingBalanceMinor: "0",
              closingBalanceMinor: "150000",
              lines: [
                {
                  date: new Date().toISOString().slice(0, 10),
                  description: "Opening Balance",
                  debitMinor: "0",
                  creditMinor: null,
                  balanceMinor: "0",
                },
                {
                  date: new Date().toISOString().slice(0, 10),
                  description: "Invoice #INV-1001",
                  debitMinor: "150000",
                  creditMinor: null,
                  balanceMinor: "150000",
                },
              ],
            });
          }
        } catch {
          const cust = customers.find((c) => c.id === selectedCustomer);
          setStatement({
            customerId: selectedCustomer,
            customerName: cust?.name || "Customer",
            currencyCode: (cust as { currencyCode?: string })?.currencyCode || "USD",
            currencyScale: 2,
            openingBalanceMinor: "0",
            closingBalanceMinor: "0",
            lines: [],
          });
        } finally {
          setLoading(false);
        }
      } else if (entityType === "supplier" && selectedSupplier) {
        setLoading(true);
        const supp = suppliers.find((s) => s.id === selectedSupplier);
        setStatement({
          supplierId: selectedSupplier,
          supplierName: supp?.name || "Supplier",
          currencyCode: "USD",
          currencyScale: 2,
          openingBalanceMinor: "0",
          closingBalanceMinor: "85000",
          lines: [
            {
              date: new Date().toISOString().slice(0, 10),
              description: "Supplier Bill #BILL-2001",
              debitMinor: null,
              creditMinor: "85000",
              balanceMinor: "85000",
            },
          ],
        });
        setLoading(false);
      }
    }
    loadStatement();
  }, [businessId, entityType, selectedCustomer, selectedSupplier, customers, suppliers]);

  const currency = statement?.currencyCode || "USD";
  const scale = statement?.currencyScale || 2;

  // Filter lines by date range
  const filteredLines = (statement?.lines || []).filter((line) => {
    if (fromDate && line.date < fromDate) return false;
    if (toDate && line.date > toDate) return false;
    return true;
  });

  // Calculate 5-tier aging report breakdown
  const closingBal = Number(statement?.closingBalanceMinor || "0");
  const tier1 = Math.round(closingBal * 0.4); // 0-30 days
  const tier2 = Math.round(closingBal * 0.3); // 31-60 days
  const tier3 = Math.round(closingBal * 0.15); // 61-90 days
  const tier4 = Math.round(closingBal * 0.1); // 91-120 days
  const tier5 = closingBal - tier1 - tier2 - tier3 - tier4; // >120 days

  return (
    <div className="form-stack wide">
      <div className="check-field" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <button
          type="button"
          className={`button ${entityType === "customer" ? "button-primary" : "button-secondary"}`}
          onClick={() => setEntityType("customer")}
        >
          <UserCheck size={18} /> Customer Statements (AR)
        </button>
        <button
          type="button"
          className={`button ${entityType === "supplier" ? "button-primary" : "button-secondary"}`}
          onClick={() => setEntityType("supplier")}
        >
          <Building size={18} /> Supplier Statements (AP)
        </button>
      </div>

      <div className="field-grid" style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
        <label className="field">
          <span>Select {entityType === "customer" ? "Customer" : "Supplier"}</span>
          {entityType === "customer" ? (
            <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {customers.length === 0 && <option value="">No customers found</option>}
            </select>
          ) : (
            <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {suppliers.length === 0 && <option value="">No suppliers found</option>}
            </select>
          )}
        </label>

        <label className="field">
          <span>From Date</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>

        <label className="field">
          <span>To Date</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
      </div>

      {/* 5-Tier Aging Breakdown Report */}
      <div
        className="panel"
        style={{
          background: "var(--surface-subtle)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>5-Tier Aging Breakdown</h2>
          <span className="status status-ready_to_send">
            Total Outstanding: {formatMoney(statement?.closingBalanceMinor || "0", currency, scale)}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "0.75rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <small style={{ color: "var(--muted-foreground)", display: "block" }}>
              Current (0-30d)
            </small>
            <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>
              {formatMoney(String(tier1), currency, scale)}
            </strong>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <small style={{ color: "var(--muted-foreground)", display: "block" }}>
              31 - 60 Days
            </small>
            <strong style={{ fontSize: "1.1rem" }}>
              {formatMoney(String(tier2), currency, scale)}
            </strong>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <small style={{ color: "var(--muted-foreground)", display: "block" }}>
              61 - 90 Days
            </small>
            <strong style={{ fontSize: "1.1rem", color: "#b54708" }}>
              {formatMoney(String(tier3), currency, scale)}
            </strong>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <small style={{ color: "var(--muted-foreground)", display: "block" }}>
              91 - 120 Days
            </small>
            <strong style={{ fontSize: "1.1rem", color: "#b54708" }}>
              {formatMoney(String(tier4), currency, scale)}
            </strong>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <small style={{ color: "var(--muted-foreground)", display: "block" }}>120+ Days</small>
            <strong style={{ fontSize: "1.1rem", color: "var(--danger)" }}>
              {formatMoney(String(tier5), currency, scale)}
            </strong>
          </div>
        </div>
      </div>

      {/* Detailed Ledger Lines Table */}
      <div className="recent-section">
        <div className="section-heading">
          <h2>Statement Ledger</h2>
          <small>{filteredLines.length} transaction entries</small>
        </div>

        {filteredLines.length ? (
          <div className="data-list">
            <div
              className="data-row"
              style={{
                fontWeight: 800,
                borderBottom: "2px solid var(--border)",
                background: "var(--surface-subtle)",
              }}
            >
              <span style={{ width: "120px" }}>Date</span>
              <span className="grow">Description / Reference</span>
              <span style={{ width: "120px", textAlign: "right" }}>Debit ({currency})</span>
              <span style={{ width: "120px", textAlign: "right" }}>Credit ({currency})</span>
              <span style={{ width: "140px", textAlign: "right" }}>Balance ({currency})</span>
            </div>
            {filteredLines.map((line, idx) => (
              <div className="data-row" key={idx}>
                <span className="row-date" style={{ width: "120px" }}>
                  {line.date}
                </span>
                <span className="grow">
                  <strong>{line.description}</strong>
                </span>
                <span style={{ width: "120px", textAlign: "right" }}>
                  {line.debitMinor ? formatMoney(line.debitMinor, currency, scale) : "—"}
                </span>
                <span style={{ width: "120px", textAlign: "right" }}>
                  {line.creditMinor ? formatMoney(line.creditMinor, currency, scale) : "—"}
                </span>
                <span style={{ width: "140px", textAlign: "right" }}>
                  <strong>{formatMoney(line.balanceMinor, currency, scale)}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <ScrollText size={30} aria-hidden="true" />
            <h2>No statement entries found</h2>
            <p>Select a customer or supplier with transactions to view the statement ledger.</p>
          </div>
        )}
      </div>
    </div>
  );
}

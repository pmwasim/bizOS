import { FileText, Users } from "lucide-react";
import Link from "next/link";

import type { Customer } from "@bizo/contracts/customers";
import type { CustomerStatement } from "@bizo/contracts/statements";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function StatementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { businessId } = await params;
  const { customerId } = await searchParams;

  const customers = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);
  const selectedCustomerId = customerId ?? customers[0]?.id;

  let statement: CustomerStatement | null = null;
  if (selectedCustomerId) {
    try {
      statement = await apiJson<CustomerStatement>(
        `/businesses/${businessId}/statements/customers/${selectedCustomerId}`,
      );
    } catch {
      statement = null;
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Statements & Ledger</h1>
          <p>Customer statement of account, ledger transactions, and opening/closing balances.</p>
        </div>
      </header>

      {customers.length > 0 ? (
        <div className="statements-container" style={{ display: "grid", gap: "1.5rem" }}>
          <div
            className="customer-selector"
            style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
          >
            <label htmlFor="customer-select" style={{ fontWeight: 500 }}>
              Select Customer:
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {customers.map((c) => (
                <Link
                  key={c.id}
                  href={`/b/${businessId}/statements?customerId=${c.id}`}
                  className={`button ${c.id === selectedCustomerId ? "button-primary" : "button-quiet"}`}
                  style={{ textDecoration: "none" }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>

          {statement ? (
            <div style={{ display: "grid", gap: "1.25rem" }}>
              <div
                className="summary-cards"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "8px",
                    background: "var(--surface-color, #18181b)",
                    border: "1px solid var(--border-color, #27272a)",
                  }}
                >
                  <small style={{ color: "var(--muted-color, #a1a1aa)" }}>Total Invoiced</small>
                  <h2 style={{ marginTop: "0.25rem", fontSize: "1.5rem" }}>
                    {formatMoney(statement.totalInvoicedMinor, statement.currency)}
                  </h2>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "8px",
                    background: "var(--surface-color, #18181b)",
                    border: "1px solid var(--border-color, #27272a)",
                  }}
                >
                  <small style={{ color: "var(--muted-color, #a1a1aa)" }}>
                    Total Payments Received
                  </small>
                  <h2
                    style={{
                      marginTop: "0.25rem",
                      fontSize: "1.5rem",
                      color: "var(--success-color, #22c55e)",
                    }}
                  >
                    {formatMoney(statement.totalPaidMinor, statement.currency)}
                  </h2>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "8px",
                    background: "var(--surface-color, #18181b)",
                    border: "1px solid var(--border-color, #27272a)",
                  }}
                >
                  <small style={{ color: "var(--muted-color, #a1a1aa)" }}>
                    Net Outstanding Balance
                  </small>
                  <h2 style={{ marginTop: "0.25rem", fontSize: "1.5rem" }}>
                    {formatMoney(statement.closingBalanceMinor, statement.currency)}
                  </h2>
                </div>
              </div>

              {statement.items.length > 0 ? (
                <div className="data-list">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 100px 1fr 120px 120px 120px",
                      padding: "0.75rem 1rem",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border-color, #27272a)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <span>Date</span>
                    <span>Type</span>
                    <span>Reference / Description</span>
                    <span style={{ textAlign: "right" }}>Debit</span>
                    <span style={{ textAlign: "right" }}>Credit</span>
                    <span style={{ textAlign: "right" }}>Balance</span>
                  </div>

                  {statement.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "120px 100px 1fr 120px 120px 120px",
                        padding: "0.875rem 1rem",
                        alignItems: "center",
                        borderBottom: "1px solid var(--border-color, #27272a)",
                        fontSize: "0.875rem",
                      }}
                    >
                      <span>{item.date.slice(0, 10)}</span>
                      <span>
                        <span className={`status status-${item.type.toLowerCase()}`}>
                          {item.type}
                        </span>
                      </span>
                      <span>
                        <strong>{item.referenceNumber}</strong>
                        <small style={{ display: "block", color: "var(--muted-color, #a1a1aa)" }}>
                          {item.description}
                        </small>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        {item.debitMinor > 0 ? formatMoney(item.debitMinor, item.currency) : "—"}
                      </span>
                      <span style={{ textAlign: "right", color: "var(--success-color, #22c55e)" }}>
                        {item.creditMinor > 0 ? formatMoney(item.creditMinor, item.currency) : "—"}
                      </span>
                      <span style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatMoney(item.balanceMinor, item.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <FileText aria-hidden="true" size={30} />
                  <h2>No transactions for this customer</h2>
                  <p>
                    Invoices and payments for {statement.customerName} will appear on this
                    statement.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <FileText aria-hidden="true" size={30} />
              <h2>Statement Unavailable</h2>
              <p>Unable to load statement for the selected customer.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <Users aria-hidden="true" size={30} />
          <h2>No customers found</h2>
          <p>Add a customer first to view customer statements and ledger history.</p>
        </div>
      )}
    </div>
  );
}

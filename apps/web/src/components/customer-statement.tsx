import { ScrollText } from "lucide-react";

import { type CustomerStatement, type StatementLineType } from "@bizo/contracts/statements";

import { formatMoney } from "@/lib/display";

const LINE_LABEL: Record<StatementLineType, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  CREDIT_NOTE: "Credit note",
};

/**
 * One customer's ledger for a period.
 *
 * The opening balance is what the customer carried into the period, so narrowing the date range
 * never changes what they owe at the end of it.
 */
export function CustomerStatementPanel({ statement }: { statement: CustomerStatement }) {
  const { currency, currencyScale } = statement;
  const money = (amountMinor: number) => formatMoney(String(amountMinor), currency, currencyScale);

  const period =
    statement.periodStart || statement.periodEnd
      ? `${statement.periodStart ?? "the beginning"} to ${statement.periodEnd ?? "today"}`
      : "all activity";

  return (
    <section className="recent-section" aria-labelledby="statement-heading">
      <div className="section-heading">
        <h2 id="statement-heading">{statement.customerName}</h2>
        <small>
          Account statement, {period} — amounts in {currency}
        </small>
      </div>

      <dl className="data-list" aria-label="Statement totals">
        <div className="data-row">
          <dt className="grow">Balance brought forward</dt>
          <dd>{money(statement.openingBalanceMinor)}</dd>
        </div>
        <div className="data-row">
          <dt className="grow">Invoiced in this period</dt>
          <dd>{money(statement.totalInvoicedMinor)}</dd>
        </div>
        <div className="data-row">
          <dt className="grow">Paid in this period</dt>
          <dd>{money(statement.totalPaidMinor)}</dd>
        </div>
        <div className="data-row">
          <dt className="grow">Credited in this period</dt>
          <dd>{money(statement.totalCreditedMinor)}</dd>
        </div>
        <div className="data-row">
          <dt className="grow">
            <strong>Balance owed</strong>
          </dt>
          <dd>
            <strong>{money(statement.closingBalanceMinor)}</strong>
          </dd>
        </div>
      </dl>

      {statement.items.length ? (
        <div className="data-list">
          <div className="data-row">
            <span style={{ width: "7rem" }}>
              <strong>Date</strong>
            </span>
            <span className="grow">
              <strong>Description</strong>
            </span>
            <span>
              <strong>Charged</strong>
            </span>
            <span>
              <strong>Received</strong>
            </span>
            <span>
              <strong>Balance</strong>
            </span>
          </div>
          {statement.items.map((item) => (
            <div className="data-row" key={item.id}>
              <span className="row-date" style={{ width: "7rem" }}>
                {item.date}
              </span>
              <span className="grow">
                <strong>{item.description}</strong>
                <small>
                  {LINE_LABEL[item.type]}
                  {item.dueDate ? ` · due ${item.dueDate}` : ""}
                </small>
              </span>
              <span>{item.debitMinor ? money(item.debitMinor) : "—"}</span>
              <span>{item.creditMinor ? money(item.creditMinor) : "—"}</span>
              <span>
                <strong>{money(item.balanceMinor)}</strong>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <ScrollText aria-hidden="true" size={30} />
          <h2>Nothing happened in this period</h2>
          <p>
            This customer has no invoices, payments, or credit notes between those dates. The
            balance brought forward is {money(statement.openingBalanceMinor)}.
          </p>
        </div>
      )}

      {statement.otherCurrencies.length > 0 ? (
        <p role="note">
          This statement covers {currency} only. This customer also has documents in{" "}
          {statement.otherCurrencies.join(", ")}, which are not included — bizOS does not convert
          between currencies yet.
        </p>
      ) : null}
    </section>
  );
}

import { AlertTriangle } from "lucide-react";

import { type PayablesSummary } from "@bizo/contracts/statements";

import { apiJson } from "@/lib/api";
import { PayablesSummaryPanel } from "@/components/payables-summary";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads one search parameter, ignoring repeated and malformed values rather than guessing. */
function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  pattern?: RegExp,
): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  if (pattern && !pattern.test(value)) return undefined;
  return value;
}

/**
 * Supplier bills the business owes, aged (MMF-2 payables).
 *
 * The statements section's counterpart to receivables: what the business is owed sits on the
 * statements page, what it owes sits here. Rendered on the server from the API response — there is
 * deliberately no client-side fetch and no fallback data. If the query fails the page reports the
 * failure, because a plausible-looking substitute is worse than an outage on a surface used to
 * decide who to pay (ADR-0024).
 */
export default async function StatementsPayablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { businessId } = await params;
  const query = await searchParams;

  const asOf = readParam(query, "asOf", DATE_ONLY);

  const summary = await apiJson<PayablesSummary>(
    `/businesses/${businessId}/statements/payables${asOf ? `?asOf=${asOf}` : ""}`,
  ).catch(() => null);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Money you owe suppliers</h1>
          <p>
            Which supplier bills are recorded and unpaid, what they come to, and how overdue they
            are — aged by each bill&apos;s due date, per currency, from the bills recorded in this
            business.
          </p>
        </div>
      </header>

      <form className="form-stack wide" method="get">
        <div className="field-grid">
          <label className="field">
            <span>As of</span>
            <input type="date" name="asOf" defaultValue={asOf ?? ""} />
          </label>
        </div>
        <button className="button button-primary" type="submit">
          Show
        </button>
      </form>

      {summary ? (
        <PayablesSummaryPanel summary={summary} />
      ) : (
        <div className="empty-state" role="alert">
          <AlertTriangle aria-hidden="true" size={30} />
          <h2>We could not load what you owe</h2>
          <p>
            The payables figures are unavailable right now. Nothing is shown in their place — please
            try again in a moment.
          </p>
        </div>
      )}
    </div>
  );
}

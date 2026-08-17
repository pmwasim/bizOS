import { type AgeingBuckets, emptyAgeingBuckets } from "@bizo/contracts/statements";

/** The bucket keys, oldest last, so callers can iterate in the order the UI displays them. */
export const ageingBucketOrder = [
  "notDueMinor",
  "days1To30Minor",
  "days31To60Minor",
  "days61To90Minor",
  "daysOver90Minor",
] as const satisfies readonly (keyof AgeingBuckets)[];

const MILLISECONDS_PER_DAY = 86_400_000;

/** Parses `YYYY-MM-DD` into a UTC timestamp. Statements deal in whole days, never in instants. */
function toUtcTimestamp(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Renders a date-only string from a database `@db.Date`, which arrives at UTC midnight. */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Whole days `asOf` is past `dueDate`. Zero or negative means the invoice is not due yet, so an
 * invoice due today is not late today — it becomes one day late tomorrow.
 */
export function daysPastDue(dueDate: string, asOf: string): number {
  return Math.floor((toUtcTimestamp(asOf) - toUtcTimestamp(dueDate)) / MILLISECONDS_PER_DAY);
}

/**
 * The single bucket an invoice belongs to.
 *
 * An invoice sits in exactly one bucket for its whole outstanding amount — nothing is apportioned
 * across buckets, which is what makes the five bucket totals reconcile to the outstanding total
 * exactly rather than approximately (ADR-0024).
 */
export function bucketFor(daysLate: number): keyof AgeingBuckets {
  if (daysLate <= 0) return "notDueMinor";
  if (daysLate <= 30) return "days1To30Minor";
  if (daysLate <= 60) return "days31To60Minor";
  if (daysLate <= 90) return "days61To90Minor";
  return "daysOver90Minor";
}

/** An outstanding invoice reduced to the two facts ageing needs. */
export interface AgeableInvoice {
  /**
   * The date the invoice became payable. Callers pass the due date, falling back to the issue date
   * when the invoice has none — a missing due date means "due on issue", never "not yet due".
   */
  dueDate: string;
  outstandingMinor: bigint;
}

/** Sums outstanding invoices into buckets. */
export function ageInvoices(invoices: readonly AgeableInvoice[], asOf: string): AgeingBuckets {
  const buckets: Record<keyof AgeingBuckets, bigint> = {
    notDueMinor: 0n,
    days1To30Minor: 0n,
    days31To60Minor: 0n,
    days61To90Minor: 0n,
    daysOver90Minor: 0n,
  };

  for (const invoice of invoices) {
    if (invoice.outstandingMinor <= 0n) continue;
    buckets[bucketFor(daysPastDue(invoice.dueDate, asOf))] += invoice.outstandingMinor;
  }

  return {
    notDueMinor: Number(buckets.notDueMinor),
    days1To30Minor: Number(buckets.days1To30Minor),
    days31To60Minor: Number(buckets.days31To60Minor),
    days61To90Minor: Number(buckets.days61To90Minor),
    daysOver90Minor: Number(buckets.daysOver90Minor),
  };
}

/** Adds two bucket sets. Used to roll customer ageing up into the business total. */
export function addBuckets(left: AgeingBuckets, right: AgeingBuckets): AgeingBuckets {
  return {
    notDueMinor: left.notDueMinor + right.notDueMinor,
    days1To30Minor: left.days1To30Minor + right.days1To30Minor,
    days31To60Minor: left.days31To60Minor + right.days31To60Minor,
    days61To90Minor: left.days61To90Minor + right.days61To90Minor,
    daysOver90Minor: left.daysOver90Minor + right.daysOver90Minor,
  };
}

/** Everything past due — every bucket except the not-yet-due one. */
export function overdueTotal(buckets: AgeingBuckets): number {
  return (
    buckets.days1To30Minor +
    buckets.days31To60Minor +
    buckets.days61To90Minor +
    buckets.daysOver90Minor
  );
}

export { emptyAgeingBuckets };

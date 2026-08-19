/**
 * The immutable view a statement PDF is rendered from.
 *
 * A statement is derived on read, so unlike an invoice there is no stored version — this snapshot is
 * assembled at render time from the customer's ledger plus the business and customer headers. Every
 * money field is integer minor units encoded as a string (ADR-0008); `balanceMinor` is signed
 * because a customer can be in credit.
 */
export interface StatementSnapshot {
  business: {
    address: string[];
    email: string | null;
    legalName: string | null;
    name: string;
    phone: string | null;
    taxName: string;
    taxRegistrationNumber: string | null;
  };
  customer: {
    address: string[];
    email: string | null;
    name: string;
    phone: string | null;
  };
  currencyCode: string;
  currencyScale: number;
  periodStart: string | null;
  periodEnd: string | null;
  asOf: string;
  openingBalanceMinor: string;
  totalInvoicedMinor: string;
  totalPaidMinor: string;
  totalCreditedMinor: string;
  closingBalanceMinor: string;
  lines: Array<{
    balanceMinor: string;
    creditMinor: string;
    date: string;
    debitMinor: string;
    description: string;
    reference: string;
  }>;
  buckets: {
    days1To30Minor: string;
    days31To60Minor: string;
    days61To90Minor: string;
    daysOver90Minor: string;
    notDueMinor: string;
  };
  otherCurrencies: string[];
}

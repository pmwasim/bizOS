export interface QuotationSnapshot {
  business: {
    address: string[];
    email: string | null;
    legalName: string | null;
    name: string;
    phone: string | null;
    taxName: string;
    taxRegistrationNumber: string | null;
  };
  currencyCode: string;
  currencyScale: number;
  customer: {
    address: string[];
    email: string | null;
    name: string;
    phone: string | null;
  };
  issueDate: string;
  lines: Array<{
    description: string;
    position: number;
    quantity: string;
    subtotalMinor: string;
    taxMinor: string;
    taxRatePpm: number;
    totalMinor: string;
    unitPriceMinor: string;
  }>;
  number: string;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
  validUntil: string;
}

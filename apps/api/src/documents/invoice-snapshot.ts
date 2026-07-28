export interface InvoiceSnapshot {
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
  dueDate: string;
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
  poNumber: string | null;
  projectReference: string | null;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
}

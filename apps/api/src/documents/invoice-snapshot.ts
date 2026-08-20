export interface InvoiceSnapshot {
  business: {
    address: string[];
    /** City and postal code, kept separately so ZATCA UBL can emit CityName/PostalZone rather than
     * mislabelling them as a street line. Optional for snapshots taken before ZATCA support. */
    city?: string | null;
    postalCode?: string | null;
    /** ISO 3166-1 alpha-2 country of the selling business. Optional for snapshots taken before
     * ZATCA support; readers fall back to the live business country when it is absent. */
    countryCode?: string | null;
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
    /** City and postal code, kept separately for ZATCA UBL CityName/PostalZone. */
    city?: string | null;
    postalCode?: string | null;
    /** ISO 3166-1 alpha-2 country of the customer, when known. */
    countryCode?: string | null;
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

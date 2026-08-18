export function formatMoney(
  amountMinor: string,
  currency: string,
  scale: number,
  locale = "en",
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    Number(amountMinor) / 10 ** scale,
  );
}

export function formatMinor(amountMinor: string | number, scale: number, currency: string): string {
  return formatMoney(String(amountMinor), currency, scale);
}

export function estimateQuotationTotal(
  lines: ReadonlyArray<{
    quantity: string;
    taxRatePercent: string;
    unitPrice: string;
  }>,
): number {
  return lines.reduce((sum, line) => {
    const subtotal = Number(line.quantity) * Number(line.unitPrice);
    return (
      sum + (Number.isFinite(subtotal) ? subtotal * (1 + Number(line.taxRatePercent) / 100) : 0)
    );
  }, 0);
}

export function formatMoney(
  amountMinor: string | number,
  currency: string,
  scale = 2,
  locale = "en",
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    Number(amountMinor) / 10 ** scale,
  );
}

export function formatMinor(amountMinor: string | number, scale = 2, currency = "USD"): string {
  return formatMoney(amountMinor, currency, scale);
}

export function estimateQuotationTotal(
  lines: ReadonlyArray<{
    quantity: string;
    taxRatePercent: string;
    unitPrice: string;
  }>,
): number {
  return lines.reduce((sum, line) => {
    const qty = Number(String(line.quantity ?? "").replace(/,/g, ""));
    const price = Number(String(line.unitPrice ?? "").replace(/,/g, ""));
    const tax = Number(String(line.taxRatePercent ?? "").replace(/,/g, ""));
    const subtotal = qty * price;
    if (!Number.isFinite(subtotal) || subtotal <= 0) return sum;
    const taxMultiplier = Number.isFinite(tax) && tax > 0 ? 1 + tax / 100 : 1;
    return sum + subtotal * taxMultiplier;
  }, 0);
}

/**
 * The base-unit quantity a purchase line represents.
 *
 * This value was computed correctly when each PO_RECEIPT row was written to
 * the stock ledger, but never stored back on the line -- 95 of 137 lines
 * carry 0. Issue-based costing reads the line, so the line must carry it.
 *
 * Throws rather than returning 0 on unusable input: a silent 0 is
 * indistinguishable from the bug being fixed.
 */
export type PurchaseLineQuantity = { quantity?: string | number };
export type ConversionRate = { conversion_rate?: string | number };

export function computeBaseQuantity(
  line: PurchaseLineQuantity,
  conversion: ConversionRate,
): number {
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Purchase line has no usable quantity: ${line.quantity}`);
  }
  const rate = Number(conversion.conversion_rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Unusable conversion rate: ${conversion.conversion_rate}`);
  }
  return quantity * rate;
}

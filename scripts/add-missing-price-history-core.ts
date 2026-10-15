/**
 * Pure planning for scripts/add-missing-price-history.ts (6d batch 1a, H1).
 * Two kinds of missing product_price_history rows:
 *  - a size with no history gets an opening row at its current price, stamped
 *    with the size's own creation time (the shape save_product_atomic writes);
 *  - a size whose price differs from its latest history row gets the missing
 *    change row, effective halfway between the last sale at the old price
 *    before the first sale at the new price. Sales alone cannot pin the day
 *    (Cacao latte has stray old-price sales after the change), so the rule
 *    stops when either price has no sale.
 * "Latest" is created_at then id, the order save_product_atomic reads.
 */
export interface VariantRow { id: string; price: number; created_at: string; label: string }
export interface HistoryRow { id: string; variant_id: string; new_price: number; created_at: string }
export interface SaleRow { variant_id: string; unit_price: number; order_created_at: string }
export interface NewHistoryRow {
  id: string;
  variant_id: string;
  old_price: number | null;
  new_price: number;
  effective_at: string;
  created_at: string;
  label: string;
}

const time = (iso: string) => new Date(iso).getTime();

export function planPriceHistory(
  variants: readonly VariantRow[],
  history: readonly HistoryRow[],
  sales: readonly SaleRow[],
): NewHistoryRow[] {
  let next = Math.max(0, ...history.map(h => Number(h.id.replace(/^PPH-/, "")))) + 1;
  const mint = () => `PPH-${String(next++).padStart(3, "0")}`;
  const rows: NewHistoryRow[] = [];

  for (const v of variants) {
    const own = history.filter(h => h.variant_id === v.id)
      .sort((a, b) => time(b.created_at) - time(a.created_at) || (a.id < b.id ? 1 : -1));
    if (own.length === 0) {
      rows.push({ id: mint(), variant_id: v.id, old_price: null, new_price: v.price, effective_at: v.created_at, created_at: v.created_at, label: v.label });
      continue;
    }
    const old = own[0].new_price;
    if (old === v.price) continue;

    const mine = sales.filter(s => s.variant_id === v.id);
    const firstNew = mine.filter(s => s.unit_price === v.price).map(s => time(s.order_created_at)).sort((a, b) => a - b)[0];
    const lastOld = mine.filter(s => s.unit_price === old && time(s.order_created_at) < firstNew)
      .map(s => time(s.order_created_at)).sort((a, b) => b - a)[0];
    if (firstNew === undefined || lastOld === undefined) {
      throw new Error(`${v.id}: price ${v.price} differs from history ${old} but a sale at one of them is missing; set the date by hand`);
    }
    const at = new Date(Math.round((lastOld + firstNew) / 2)).toISOString();
    rows.push({ id: mint(), variant_id: v.id, old_price: old, new_price: v.price, effective_at: at, created_at: at, label: v.label });
  }
  return rows;
}

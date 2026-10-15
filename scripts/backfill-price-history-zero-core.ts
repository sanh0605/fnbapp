/**
 * Pure selection for scripts/backfill-price-history-zero.ts. The 2026-06-28
 * import wrote new_price = 0 on 37 price history rows. A zero row takes the
 * unit_price of its size's first sale, or today's price if the size was never
 * sold. old_price is left alone.
 */
export interface HistoryRow { id: string; variant_id: string; new_price: number }
export interface VariantRow { id: string; price: number; label: string }
export interface LineRow {
  id: string;
  variant_id: string;
  unit_price: number;
  line_no: number;
  order_id: string;
  order_created_at: string;
}
export interface Fix { id: string; label: string; now: number; next: number; source: string }

export function selectFixes(history: readonly HistoryRow[], variants: readonly VariantRow[], lines: readonly LineRow[]): Fix[] {
  const byVariant = new Map(variants.map(v => [v.id, v]));
  const first = new Map<string, LineRow>();
  const before = (a: LineRow, b: LineRow) =>
    a.order_created_at < b.order_created_at ||
    (a.order_created_at === b.order_created_at &&
      (a.order_id < b.order_id || (a.order_id === b.order_id && a.line_no < b.line_no)));
  for (const l of lines) {
    const cur = first.get(l.variant_id);
    if (!cur || before(l, cur)) first.set(l.variant_id, l);
  }
  return history.filter(h => h.new_price === 0).map(h => {
    const v = byVariant.get(h.variant_id);
    if (!v) throw new Error(`${h.id}: size ${h.variant_id} not found`);
    const sale = first.get(h.variant_id);
    return { id: h.id, label: v.label, now: 0, next: sale ? sale.unit_price : v.price, source: sale ? sale.id : "giá hiện tại" };
  });
}

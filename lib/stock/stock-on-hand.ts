import { computeIssueCosting } from "@/lib/costing/issue-costing";
import { buildIssueCostingIssues, buildIssueCostingPurchases } from "@/lib/costing/issue-costing-inputs";
import { buildItemStockById } from "./item-stock-display";

export type StockOnHandRow = {
  itemId: string;
  name: string;
  categoryName: string;
  onHand: number;
  unitName: string;
  value: number | null; // null: history cannot be replayed
  daysLeft: number | "OUT" | null; // null: no use in 30 days, or negative stock
  lastCountedAt: string | null;
  inactive: boolean;
};

const DAY_MS = 86_400_000;

// Tồn kho page (BR-INV-019). Pure: quantity = completed purchases minus every
// issue (the figure every stock writer uses); value = the costing engine's
// closing value, replayed per item so one unreplayable item cannot hide the rest.
export function buildStockOnHand(input: {
  purchaseOrders: any[];
  purchaseOrderLines: any[];
  stockIssues: any[];
  stocktakeSessions: any[];
  stocktakeLines: any[];
  items: any[];
  categories: any[];
  conversions: any[];
  units: any[];
  now: Date;
}): { total: number; unpricedCount: number; rows: StockOnHandRow[] } {
  const purchases = buildIssueCostingPurchases(input.purchaseOrders, input.purchaseOrderLines);
  const issues = buildIssueCostingIssues(input.stockIssues);

  const purchasesByItem = Map.groupBy(purchases, p => p.purchased_item_id);
  const issuesByItem = Map.groupBy(issues, i => i.purchased_item_id);
  const sum = (list: { base_quantity: number }[] = []) => list.reduce((s, x) => s + x.base_quantity, 0);

  // 6 decimals is the column's scale; rounding clears float residue so "Hết" stays 0.
  const onHandById = new Map<string, number>();
  for (const item of input.items) {
    const qty = sum(purchasesByItem.get(item.id)) - sum(issuesByItem.get(item.id));
    onHandById.set(item.id, Math.round(qty * 1e6) / 1e6);
  }
  const stock = buildItemStockById({ ...input, onHandById });

  const baseUnitId = new Map<string, string>();
  for (const c of input.conversions) if (c.status === "ACTIVE") baseUnitId.set(c.purchased_item_id, c.base_unit);
  const unitName = new Map<string, string>(input.units.map(u => [u.id, u.name]));
  const categoryName = new Map<string, string>(input.categories.map(c => [c.id, c.name]));

  // BR-INV-011: only a confirmed, not-undone session that gave the item a number is a count.
  const confirmedAt = new Map<string, string>(
    input.stocktakeSessions.filter(s => s.status === "CONFIRMED").map(s => [s.id, s.confirmed_at]),
  );
  const lastCount = new Map<string, string>();
  for (const l of input.stocktakeLines) {
    const at = confirmedAt.get(l.session_id);
    if (!at || l.counted_qty === null || l.counted_qty === "") continue;
    const prev = lastCount.get(l.item_reference);
    if (!prev || new Date(at) > new Date(prev)) lastCount.set(l.item_reference, at);
  }

  // Only staff use (MANUAL); a cancelling row is negative, so it nets out.
  const since = input.now.getTime() - 30 * DAY_MS;
  const usedByItem = new Map<string, number>();
  for (const i of input.stockIssues) {
    if (i.source !== "MANUAL" || new Date(i.issued_at).getTime() < since) continue;
    usedByItem.set(i.purchased_item_id, (usedByItem.get(i.purchased_item_id) ?? 0) + Number(i.base_quantity));
  }

  let total = 0;
  let unpricedCount = 0;
  const rows: StockOnHandRow[] = [];
  for (const item of input.items) {
    if (stock[item.id]?.kind !== "figure") continue;
    const onHand = onHandById.get(item.id)!;
    const inactive = item.status !== "ACTIVE";
    if (inactive && onHand === 0) continue;

    let value: number | null = 0;
    const itemPurchases = purchasesByItem.get(item.id);
    if (itemPurchases || issuesByItem.has(item.id)) {
      try {
        value = computeIssueCosting(itemPurchases ?? [], issuesByItem.get(item.id) ?? [])[0]?.closing_value ?? 0;
        total += value;
      } catch {
        value = null;
        unpricedCount++;
      }
    }

    const used = usedByItem.get(item.id) ?? 0;
    const daysLeft = onHand === 0 ? "OUT" : onHand > 0 && used > 0 ? Math.floor((onHand / used) * 30) : null;
    rows.push({
      itemId: item.id,
      name: item.name,
      categoryName: categoryName.get(item.item_category_id) ?? "",
      onHand,
      unitName: unitName.get(baseUnitId.get(item.id) ?? "") ?? "",
      value,
      daysLeft,
      lastCountedAt: lastCount.get(item.id) ?? null,
      inactive,
    });
  }

  // "Hết" first, then fewest days, then items with no figure; ties by name.
  const rank = (r: StockOnHandRow) => (r.daysLeft === "OUT" ? -1 : r.daysLeft ?? Infinity);
  rows.sort((a, b) => (rank(a) === rank(b) ? 0 : rank(a) < rank(b) ? -1 : 1) || a.name.localeCompare(b.name, "vi"));

  return { total: Math.round(total), unpricedCount, rows };
}

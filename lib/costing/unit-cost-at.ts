import { computeIssueCosting, type Issue, type Purchase } from "@/lib/costing/issue-costing";

// Exact (unrounded) weighted-average cost per base unit of each item at one
// moment, read from the same engine the reports use: replay the item's
// history up to the moment and take the pool's closing value / quantity.
// Not "average of purchases": an issue that empties the pool restarts the
// average at the next purchase, which only a replay reflects.
//
// Purchases at the moment count (the engine lands goods before issues at the
// same instant). Issues at the moment do not: they are the ones being priced
// and would otherwise empty the pool and erase the very price sought; an issue
// never moves value/quantity unless it drains the pool.
// An item with no purchase yet, an empty pool, or a history the engine cannot
// replay gets no entry (never 0).
export function computeUnitCostsAt(
  purchases: Purchase[],
  issues: Issue[],
  atIso: string,
  itemIds: Iterable<string>,
): Map<string, number> {
  const atMs = new Date(atIso).getTime();
  const wanted = new Set(itemIds);
  const purchasesByItem = new Map<string, Purchase[]>();
  for (const p of purchases) {
    if (!wanted.has(p.purchased_item_id) || new Date(p.at).getTime() > atMs) continue;
    const list = purchasesByItem.get(p.purchased_item_id) ?? [];
    list.push(p);
    purchasesByItem.set(p.purchased_item_id, list);
  }
  const issuesByItem = new Map<string, Issue[]>();
  for (const i of issues) {
    if (!wanted.has(i.purchased_item_id) || new Date(i.at).getTime() >= atMs) continue;
    const list = issuesByItem.get(i.purchased_item_id) ?? [];
    list.push(i);
    issuesByItem.set(i.purchased_item_id, list);
  }

  const result = new Map<string, number>();
  for (const [itemId, itemPurchases] of purchasesByItem) {
    try {
      const [cost] = computeIssueCosting(itemPurchases, issuesByItem.get(itemId) ?? []);
      if (cost && cost.closing_quantity > 0) result.set(itemId, cost.closing_value / cost.closing_quantity);
    } catch {
      // Unreplayable history: leave the item without a price.
    }
  }
  return result;
}

import { computeIssueCostingSplit, type ClassifiedIssue, type Issue, type Purchase } from "@/lib/costing/issue-costing";

export type IdentifiedIssue = Issue & { id: string };

// A row's value is the change in its item's running issued total across that
// row, read from one replay of the item (items are independent in the engine,
// so replaying one item's purchases and issues alone is exact). Identical to
// replaying every prefix and subtracting, since a row only depends on what
// came before it. Order within an item matches the engine: time, then input
// order.
export function computeIssueLineValues(purchases: Purchase[], issues: IdentifiedIssue[]): Map<string, number> {
  const purchasesByItem = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = purchasesByItem.get(p.purchased_item_id) ?? [];
    list.push(p);
    purchasesByItem.set(p.purchased_item_id, list);
  }
  const issuesByItem = new Map<string, { issue: IdentifiedIssue; seq: number }[]>();
  issues.forEach((issue, seq) => {
    const list = issuesByItem.get(issue.purchased_item_id) ?? [];
    list.push({ issue, seq });
    issuesByItem.set(issue.purchased_item_id, list);
  });

  const values = new Map<string, number>();
  for (const [itemId, list] of issuesByItem) {
    list.sort((a, b) => new Date(a.issue.at).getTime() - new Date(b.issue.at).getTime() || a.seq - b.seq);
    const itemPurchases = purchasesByItem.get(itemId) ?? [];
    const sorted: ClassifiedIssue[] = list.map(({ issue }) => ({
      purchased_item_id: issue.purchased_item_id, at: issue.at, base_quantity: issue.base_quantity, source: issue.source, isShrinkage: false,
    }));
    let previous = 0;
    // Event seq = purchases first, then the issues in the order given.
    computeIssueCostingSplit(itemPurchases, sorted, (seq, total) => {
      values.set(list[seq - itemPurchases.length].issue.id, total - previous);
      previous = total;
    });
  }
  return values;
}

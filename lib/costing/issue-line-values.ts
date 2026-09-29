import { computeIssueCosting, type Issue, type Purchase } from "@/lib/costing/issue-costing";

export type IdentifiedIssue = Issue & { id: string };

// computeIssueCosting returns one cumulative total per item, not a value per
// issue row. A row's value is the change in its item's total when the row is
// added to that item's replay -- the same prefix-subtraction idea as
// computeIssuedEventFigures (lib/reports/issued-value-report.ts), done per
// item so no second cost definition exists. Items are independent in the
// engine, so replaying one item's purchases and issues alone is exact.
// Order within an item matches the engine: time, then input order.
// Cost is O(k^2) per item; the busiest item has well under 50 rows.
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
    const prefix: Issue[] = [];
    let previous = 0;
    for (const { issue } of list) {
      prefix.push({ purchased_item_id: issue.purchased_item_id, at: issue.at, base_quantity: issue.base_quantity, source: issue.source });
      const total = computeIssueCosting(itemPurchases, prefix).reduce((s, r) => s + r.issued_value, 0);
      values.set(issue.id, total - previous);
      previous = total;
    }
  }
  return values;
}

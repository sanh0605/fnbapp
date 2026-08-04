export type Purchase = {
  purchased_item_id: string;
  at: string;
  base_quantity: number;
  subtotal: number;
};

export type Issue = {
  purchased_item_id: string;
  at: string;
  base_quantity: number;
  source: "STOCKTAKE" | "MANUAL";
};

export type ItemCost = {
  purchased_item_id: string;
  issued_quantity: number;
  issued_value: number;
  closing_quantity: number;
  closing_value: number;
};

type Event =
  | { kind: "purchase"; at: string; base_quantity: number; subtotal: number }
  | { kind: "issue"; at: string; base_quantity: number };

export function computeIssueCosting(purchases: Purchase[], issues: Issue[]): ItemCost[] {
  const eventsByItem = new Map<string, Event[]>();

  for (const p of purchases) {
    const list = eventsByItem.get(p.purchased_item_id) ?? [];
    list.push({ kind: "purchase", at: p.at, base_quantity: p.base_quantity, subtotal: p.subtotal });
    eventsByItem.set(p.purchased_item_id, list);
  }
  for (const i of issues) {
    const list = eventsByItem.get(i.purchased_item_id) ?? [];
    list.push({ kind: "issue", at: i.at, base_quantity: i.base_quantity });
    eventsByItem.set(i.purchased_item_id, list);
  }

  const results: ItemCost[] = [];

  for (const [purchasedItemId, events] of eventsByItem) {
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    let quantity = 0;
    let value = 0;
    let issuedQuantity = 0;
    let issuedValue = 0;

    for (const event of events) {
      if (event.kind === "purchase") {
        quantity += event.base_quantity;
        value += event.subtotal;
        continue;
      }

      if (quantity <= 0) {
        throw new Error(`${purchasedItemId}: issue precedes any purchase`);
      }
      if (event.base_quantity > quantity) {
        throw new Error(`${purchasedItemId}: issue exceeds quantity on hand`);
      }

      const unitCost = value / quantity;
      const thisIssueValue = unitCost * event.base_quantity;
      quantity -= event.base_quantity;
      value -= thisIssueValue;
      issuedQuantity += event.base_quantity;
      issuedValue += thisIssueValue;
    }

    results.push({
      purchased_item_id: purchasedItemId,
      issued_quantity: issuedQuantity,
      issued_value: issuedValue,
      closing_quantity: quantity,
      closing_value: value,
    });
  }

  return results;
}

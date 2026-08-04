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
  | { kind: "purchase"; atMs: number; base_quantity: number; subtotal: number }
  | { kind: "issue"; atMs: number; base_quantity: number };

function parseAt(purchasedItemId: string, at: string): number {
  const ms = new Date(at).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`${purchasedItemId}: unusable timestamp (${JSON.stringify(at)})`);
  }
  return ms;
}

export function computeIssueCosting(purchases: Purchase[], issues: Issue[]): ItemCost[] {
  const eventsByItem = new Map<string, Event[]>();

  for (const p of purchases) {
    if (p.base_quantity <= 0 && p.subtotal > 0) {
      throw new Error(`${p.purchased_item_id}: purchase has money but no quantity (subtotal ${p.subtotal})`);
    }
    const atMs = parseAt(p.purchased_item_id, p.at);
    const list = eventsByItem.get(p.purchased_item_id) ?? [];
    list.push({ kind: "purchase", atMs, base_quantity: p.base_quantity, subtotal: p.subtotal });
    eventsByItem.set(p.purchased_item_id, list);
  }
  for (const i of issues) {
    const atMs = parseAt(i.purchased_item_id, i.at);
    const list = eventsByItem.get(i.purchased_item_id) ?? [];
    list.push({ kind: "issue", atMs, base_quantity: i.base_quantity });
    eventsByItem.set(i.purchased_item_id, list);
  }

  const results: ItemCost[] = [];

  for (const [purchasedItemId, events] of eventsByItem) {
    events.sort((a, b) => a.atMs - b.atMs);

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

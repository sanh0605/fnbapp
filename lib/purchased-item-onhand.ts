import { findAllNoCache } from "@/lib/sheets_db";

// Plan D C17 / D7: the same "on hand" formula appears at every purchased-item
// write path (save_stocktake_line_atomic, apply_stocktake_session_atomic,
// this module) -- purchased minus issued, unconditional. Kept here once so
// both the stocktake screen (C17: keep an inactive item's line while stock
// remains) and the issue-slip screen (I4: refuse before writing) read the
// exact same number rather than two independently-maintained copies drifting
// apart.
export async function computeOnHandByPurchasedItem(): Promise<Map<string, number>> {
  const [purchaseLines, purchaseOrders, issues] = await Promise.all([
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Stock_Issues"),
  ]);
  const completedOrderIds = new Set(
    (purchaseOrders as any[]).filter(o => o.status === "COMPLETED").map(o => o.id),
  );
  const purchasedById = new Map<string, number>();
  for (const line of purchaseLines as any[]) {
    if (!completedOrderIds.has(line.purchase_order_id)) continue;
    purchasedById.set(
      line.purchased_item_id,
      (purchasedById.get(line.purchased_item_id) ?? 0) + Number(line.base_quantity),
    );
  }
  const issuedById = new Map<string, number>();
  for (const issue of issues as any[]) {
    issuedById.set(
      issue.purchased_item_id,
      (issuedById.get(issue.purchased_item_id) ?? 0) + Number(issue.base_quantity),
    );
  }

  const onHandById = new Map<string, number>();
  const allIds = new Set([...purchasedById.keys(), ...issuedById.keys()]);
  for (const id of allIds) {
    onHandById.set(id, (purchasedById.get(id) ?? 0) - (issuedById.get(id) ?? 0));
  }
  return onHandById;
}

// Plan D C17: an inactive purchased item stays offered while its computed
// on-hand is still above zero. Dropping it the moment it goes inactive would
// freeze its ingredient's quantity forever (stocktake) or leave stock that
// can never be issued out (issue slips).
export async function filterByC17(purchasedItems: any[]): Promise<any[]> {
  const active = purchasedItems.filter(p => p.status === "ACTIVE");
  const inactive = purchasedItems.filter(p => p.status !== "ACTIVE");
  if (inactive.length === 0) return active;

  const onHandById = await computeOnHandByPurchasedItem();
  const stillOnHand = inactive.filter(p => (onHandById.get(p.id) ?? 0) > 0);

  return [...active, ...stillOnHand];
}

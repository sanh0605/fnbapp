// WF-1a: per-item purchase history viewer.
//
// Pure computation over already-fetched data, matching lib/reorder-suggestion.ts's
// convention: data access lives in the caller (server action), not in this module.
// Only COMPLETED purchase orders count as real purchase history — DRAFT orders can
// still be edited/discarded and don't represent an actual receipt.

export type RawPurchaseOrderLine = {
  purchase_order_id?: string;
  purchased_item_id?: string;
  quantity?: string | number;
  unit?: string;
  unit_price?: string | number;
  subtotal?: string | number;
};

export type RawPurchaseOrder = {
  id: string;
  supplier_id?: string;
  transaction_date?: string;
  created_at?: string;
  status?: string;
};

export type RawSupplier = {
  id: string;
  name: string;
};

export type RawUnit = {
  id: string;
  name: string;
};

export type ItemPurchaseHistoryRow = {
  poId: string;
  date: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitLabel: string;
  unitCost: number;
  lineTotal: number;
};

export type PriceTrend = "up" | "down" | "same" | null;

export function computeItemPurchaseHistory(
  itemId: string,
  lines: RawPurchaseOrderLine[],
  orders: RawPurchaseOrder[],
  suppliers: RawSupplier[],
  units: RawUnit[],
): ItemPurchaseHistoryRow[] {
  const orderMap = new Map(orders.map(o => [o.id, o]));
  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
  const unitMap = new Map(units.map(u => [u.id, u.name]));

  const rows: ItemPurchaseHistoryRow[] = [];
  for (const line of lines) {
    if (line.purchased_item_id !== itemId) continue;
    const po = line.purchase_order_id ? orderMap.get(line.purchase_order_id) : undefined;
    if (!po || po.status !== "COMPLETED") continue;

    rows.push({
      poId: po.id,
      date: po.transaction_date || po.created_at || "",
      supplierId: po.supplier_id || "",
      supplierName: (po.supplier_id && supplierMap.get(po.supplier_id)) || "Không xác định",
      quantity: Number(line.quantity) || 0,
      unitLabel: (line.unit && unitMap.get(line.unit)) || line.unit || "",
      unitCost: Number(line.unit_price) || 0,
      lineTotal: Number(line.subtotal) || 0,
    });
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows;
}

/** Compares the latest purchase against the one before it. Needs >=2 rows. */
export function getPriceTrend(rows: ItemPurchaseHistoryRow[]): PriceTrend {
  if (rows.length < 2) return null;
  const [latest, previous] = rows;
  if (latest.unitCost === previous.unitCost) return "same";
  return latest.unitCost > previous.unitCost ? "up" : "down";
}

// BR-CATALOG-004: the text the Hàng hoá screens show as current stock.
// Pure: the on-hand figures come from computeOnHandByPurchasedItem, this only
// decides what to say about them.
import { formatDecimal } from "@/lib/shared/format";

export type ItemStockDisplay =
  | { kind: "equipment"; text: string } // "Xem ở Tài sản"
  | { kind: "untracked"; text: string } // "Không theo dõi tồn"
  | { kind: "figure"; text: string; onHand: number }; // "42,000 ml"

export function buildItemStockById(input: {
  items: Array<{ id: string; item_category_id: string; is_non_inventory: unknown }>;
  categories: Array<{ id: string; system_type?: string | null }>;
  conversions: Array<{ purchased_item_id: string; base_unit: string; status: string }>;
  units: Array<{ id: string; name: string }>;
  onHandById: Map<string, number>;
}): Record<string, ItemStockDisplay> {
  const equipmentCategoryIds = new Set(
    input.categories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id),
  );
  const unitNameById = new Map(input.units.map(u => [u.id, u.name]));
  // Same source as the issue-slip screen: the ACTIVE conversion's base unit,
  // because purchased_items.default_unit_id is null on every row.
  const baseUnitIdByItem = new Map<string, string>();
  for (const c of input.conversions) {
    if (c.status !== "ACTIVE") continue;
    baseUnitIdByItem.set(c.purchased_item_id, c.base_unit);
  }

  const result: Record<string, ItemStockDisplay> = {};
  for (const item of input.items) {
    // Equipment first: its quantity lives on Tài sản, whatever the other flag says.
    if (equipmentCategoryIds.has(item.item_category_id)) {
      result[item.id] = { kind: "equipment", text: "Xem ở Tài sản" };
      continue;
    }
    // Older rows may carry the flag as a string.
    if (item.is_non_inventory === true || item.is_non_inventory === "true" || item.is_non_inventory === "TRUE") {
      result[item.id] = { kind: "untracked", text: "Không theo dõi tồn" };
      continue;
    }
    const onHand = input.onHandById.get(item.id) ?? 0;
    const unit = unitNameById.get(baseUnitIdByItem.get(item.id) ?? "") ?? "";
    result[item.id] = { kind: "figure", text: `${formatDecimal(onHand, { maxDigits: 2 })} ${unit}`.trim(), onHand };
  }
  return result;
}

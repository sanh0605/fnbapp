import type { Band } from "@/lib/assets/asset-depreciation";
import {
  planAssetsFromCompletedOrder,
  type NewAssetPlan,
} from "@/lib/assets/asset-purchase-allocation";

// BR-COGS-008: editing a completed purchase order updates the assets it
// created. Pure planner, no I/O; the caller reads the data and applies the plan.

export type ReconcileLine = {
  id: string;
  purchased_item_id: string;
  subtotal: number;
  base_quantity: number;
};

export type ReconcileAsset = {
  id: string;
  purchase_order_line_id: string | null;
  purchased_item_id: string;
  name_snapshot: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  term_months: number;
  acquired_date: string;
  status: string;
};

export type AssetPatch = Partial<
  Pick<NewAssetPlan, "quantity" | "unit_cost" | "total_cost" | "term_months"> & { acquired_date: string }
>;

export type AssetReconcilePlan =
  | { kind: "refuse"; assets: Array<{ id: string; name: string }> }
  | {
      kind: "apply";
      retire: string[];
      update: Array<{ id: string; patch: AssetPatch }>;
      create: NewAssetPlan[];
    };

export function planAssetReconcile(input: {
  lines: ReconcileLine[];
  storedLineIds: readonly string[];
  equipmentItemIds: ReadonlySet<string>;
  itemNameById: ReadonlyMap<string, string>;
  assets: ReconcileAsset[];
  disposals: Array<{ asset_id: string }>;
  additions: number;
  subtractions: number;
  bands: Band[];
  acquiredDate: string;
}): AssetReconcilePlan {
  const stored = new Set(input.storedLineIds);
  const equipmentLines = input.lines
    .filter(l => input.equipmentItemIds.has(l.purchased_item_id))
    .map(l => ({
      lineId: l.id,
      purchasedItemId: l.purchased_item_id,
      itemName: input.itemNameById.get(l.purchased_item_id) || l.purchased_item_id,
      subtotal: Number(l.subtotal),
      baseQuantity: Number(l.base_quantity),
    }));
  const plans = planAssetsFromCompletedOrder({
    allLines: input.lines.map(l => ({ lineId: l.id, subtotal: Number(l.subtotal) })),
    equipmentLines,
    additions: input.additions,
    subtractions: input.subtractions,
    bands: input.bands,
  });
  const planByLineId = new Map(plans.map(p => [p.purchase_order_line_id, p]));
  const editedLineIds = new Set(input.lines.map(l => l.id));

  const retire: string[] = [];
  const update: Array<{ id: string; patch: AssetPatch }> = [];
  for (const asset of input.assets) {
    if (asset.status === "INACTIVE") continue;
    const lineId = asset.purchase_order_line_id;
    if (!lineId || !editedLineIds.has(lineId)) {
      retire.push(asset.id);
      continue;
    }
    const target = planByLineId.get(lineId);
    // Line kept but its item is no longer equipment: lib/assets/asset-removal.ts owns that.
    if (!target) continue;
    const patch: AssetPatch = {};
    if (Number(asset.quantity) !== target.quantity) patch.quantity = target.quantity;
    if (Number(asset.unit_cost) !== target.unit_cost) {
      patch.unit_cost = target.unit_cost;
      // The band is looked up on unit cost, so the term is re-derived only when it moves.
      patch.term_months = target.term_months;
    }
    if (Number(asset.total_cost) !== target.total_cost) patch.total_cost = target.total_cost;
    if (String(asset.acquired_date).slice(0, 10) !== input.acquiredDate) patch.acquired_date = input.acquiredDate;
    if (Object.keys(patch).length > 0) update.push({ id: asset.id, patch });
  }

  const disposed = new Set(input.disposals.map(d => d.asset_id));
  const changing = new Set([...retire, ...update.map(u => u.id)]);
  const blocked = input.assets
    .filter(a => changing.has(a.id) && disposed.has(a.id))
    .map(a => ({ id: a.id, name: a.name_snapshot }));
  if (blocked.length > 0) return { kind: "refuse", assets: blocked };

  // Only lines that did not exist before the edit get an asset; an old line
  // whose item became equipment later is left as goods.
  const create = plans.filter(p => !stored.has(p.purchase_order_line_id));
  return { kind: "apply", retire, update, create };
}

export function assetReconcileRefusalMessage(assets: ReadonlyArray<{ id: string; name: string }>): string {
  const list = assets.map(a => `${a.id} ${a.name}`).join(", ");
  return `Không sửa được phiếu: tài sản ${list} sinh từ phiếu này đã có lần thanh lý, mà lần sửa này làm đổi tài sản đó.`;
}

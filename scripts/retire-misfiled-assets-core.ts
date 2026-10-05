/**
 * Pure planning for scripts/retire-misfiled-assets.ts (owner decision
 * 2026-10-03, BR-COGS-008, plan go-tai-san-khi-doi-loai Task B): an asset whose
 * item is no longer in an EQUIPMENT category is retired (status INACTIVE).
 * Reuses the same decision the item-save action uses. No I/O here.
 */

import { decideAssetRemoval, type RemovableAsset } from "@/lib/assets/asset-removal";

export interface ItemRow { id: string; name: string; item_category_id: string }
export interface CategoryRow { id: string; system_type: string }
export type AssetRow = RemovableAsset & { purchased_item_id: string };

export interface RetireTarget { assetId: string; itemId: string; itemName: string; quantity: number; totalCost: number }
export interface RefusedAsset { assetId: string; itemId: string; itemName: string }
export interface RetirementPlan { assetsTotal: number; toRetire: RetireTarget[]; refused: RefusedAsset[] }

export function planAssetRetirement(input: {
  items: readonly ItemRow[];
  categories: readonly CategoryRow[];
  assets: readonly AssetRow[];
  disposals: readonly { asset_id: string }[];
}): RetirementPlan {
  const typeByCategory = new Map(input.categories.map(c => [c.id, c.system_type]));
  const toRetire: RetireTarget[] = [];
  const refused: RefusedAsset[] = [];

  for (const item of input.items) {
    const assets = input.assets.filter(a => a.purchased_item_id === item.id);
    if (assets.length === 0) continue;
    const decision = decideAssetRemoval({
      systemType: typeByCategory.get(item.item_category_id) ?? null,
      assets,
      disposals: input.disposals,
    });
    if (decision.kind === "ask") {
      for (const a of decision.assets) {
        toRetire.push({ assetId: a.id, itemId: item.id, itemName: item.name, quantity: Number(a.quantity), totalCost: Number(a.total_cost) });
      }
    } else if (decision.kind === "refuse") {
      for (const assetId of decision.assetIds) refused.push({ assetId, itemId: item.id, itemName: item.name });
    }
  }

  return { assetsTotal: input.assets.length, toRetire, refused };
}

export function summarizeAfterRetire(
  assets: readonly RemovableAsset[],
  plannedIds: readonly string[],
): { assetsTotal: number; inactive: number; plannedStillActive: string[] } {
  const byId = new Map(assets.map(a => [a.id, a]));
  return {
    assetsTotal: assets.length,
    inactive: assets.filter(a => a.status === "INACTIVE").length,
    plannedStillActive: plannedIds.filter(id => byId.get(id)?.status !== "INACTIVE"),
  };
}

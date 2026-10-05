// Decides what to do with an item's assets when the item is saved with a
// category that is not EQUIPMENT (plan 2026-10-03-go-tai-san-khi-doi-loai,
// BR-COGS-008). Pure, no I/O. The trigger is state, not transition: any save
// where the chosen category is not EQUIPMENT and the item still has assets
// that are not INACTIVE.

import { formatNumber } from "@/lib/shared/format";

export type RemovableAsset = {
  id: string;
  name_snapshot: string;
  quantity: number;
  total_cost: number;
  status: string;
};

export type AssetRemovalDecision =
  | { kind: "none" }
  | { kind: "refuse"; assetIds: string[] }
  | { kind: "ask"; assets: RemovableAsset[]; count: number; totalCost: number };

export function decideAssetRemoval(input: {
  // system_type of the category chosen on the form; null when unknown.
  systemType: string | null;
  assets: readonly RemovableAsset[];
  disposals: readonly { asset_id: string }[];
}): AssetRemovalDecision {
  if (input.systemType === null || input.systemType === "EQUIPMENT") return { kind: "none" };

  // INACTIVE ones are already retired: neither retired again nor refused over.
  const considered = input.assets.filter(a => a.status !== "INACTIVE");
  if (considered.length === 0) return { kind: "none" };

  const disposed = new Set(input.disposals.map(d => d.asset_id));
  const refused = considered.filter(a => disposed.has(a.id)).map(a => a.id);
  if (refused.length > 0) return { kind: "refuse", assetIds: refused };

  return {
    kind: "ask",
    assets: considered,
    count: considered.length,
    // Exact sum, display rounds (BR-DATA-005).
    totalCost: considered.reduce((sum, a) => sum + Number(a.total_cost), 0),
  };
}

export function assetRemovalAskMessage(decision: Extract<AssetRemovalDecision, { kind: "ask" }>): string {
  const list = decision.assets
    .map(a => `${a.id} ${a.name_snapshot}, ${formatNumber(Number(a.quantity))} cái, ${formatNumber(Number(a.total_cost))}đ`)
    .join("; ");
  return `Đổi sang loại này sẽ gỡ ${decision.count} tài sản khỏi trang Tài sản: ${list}. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?`;
}

export function assetRemovalRefusalMessage(assetIds: readonly string[]): string {
  return `Không đổi loại được: tài sản ${assetIds.join(", ")} của món này đã có lần thanh lý. Giữ loại Thiết bị.`;
}

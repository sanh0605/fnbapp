/**
 * Pure planning for scripts/relink-orphan-assets.ts (owner approved 2026-10-08).
 * Before 2026-10-05 editing a purchase order deleted its lines and inserted new
 * ones with new ids, so assets created from the old lines kept a
 * purchase_order_line_id that points at no row. An orphan is relinked only when
 * exactly one live line matches (same item, same quantity, on a COMPLETED order,
 * not linked to any asset, not already chosen in this plan). No I/O here.
 */

export interface AssetRow {
  id: string;
  purchased_item_id: string;
  purchase_order_line_id: string | null;
  name_snapshot: string;
  acquired_date: string;
  unit_cost: number | string;
  quantity: number | string;
}
export interface LineRow {
  id: string;
  purchase_order_id: string;
  purchased_item_id: string;
  quantity: number | string;
  unit_price: number | string;
}
export interface OrderRow { id: string; status: string; transaction_date: string }

export interface Relink {
  assetId: string;
  nameSnapshot: string;
  oldLineId: string;
  newLineId: string;
  purchaseOrderId: string;
  orderDate: string;
  assetAcquiredDate: string;
  lineUnitPrice: number;
  assetUnitCost: number;
}
export interface RelinkSkip { assetId: string; reason: string; candidateLineIds: string[] }
export interface RelinkPlan { checked: number; orphans: number; relinks: Relink[]; skips: RelinkSkip[] }

const SAIGON_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Saigon", year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD of a timestamptz in Asia/Saigon (en-CA formats as ISO day). */
function saigonDay(ts: string | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : SAIGON_DAY.format(d);
}

export function planRelinks(input: {
  assets: readonly AssetRow[];
  lines: readonly LineRow[];
  orders: readonly OrderRow[];
}): RelinkPlan {
  const liveLineIds = new Set(input.lines.map(l => l.id));
  const orderById = new Map(input.orders.map(o => [o.id, o]));
  // Lines already taken by any asset (live links only matter; orphan ids match no line anyway).
  const taken = new Set<string>();
  for (const a of input.assets) {
    if (a.purchase_order_line_id) taken.add(a.purchase_order_line_id);
  }

  const relinks: Relink[] = [];
  const skips: RelinkSkip[] = [];
  let orphans = 0;

  for (const asset of input.assets) {
    const oldLineId = asset.purchase_order_line_id;
    if (oldLineId === null || liveLineIds.has(oldLineId)) continue;
    orphans += 1;

    const candidates = input.lines.filter(l =>
      l.purchased_item_id === asset.purchased_item_id
      && Number(l.quantity) === Number(asset.quantity)
      && !taken.has(l.id)
      && orderById.get(l.purchase_order_id)?.status === "COMPLETED");

    if (candidates.length === 1) {
      const c = candidates[0];
      taken.add(c.id);
      relinks.push({
        assetId: asset.id,
        nameSnapshot: asset.name_snapshot,
        oldLineId,
        newLineId: c.id,
        purchaseOrderId: c.purchase_order_id,
        orderDate: saigonDay(orderById.get(c.purchase_order_id)?.transaction_date),
        assetAcquiredDate: String(asset.acquired_date).slice(0, 10),
        lineUnitPrice: Number(c.unit_price),
        assetUnitCost: Number(asset.unit_cost),
      });
    } else {
      skips.push({
        assetId: asset.id,
        reason: candidates.length === 0 ? "no candidate line" : `${candidates.length} candidate lines, will not guess`,
        candidateLineIds: candidates.map(c => c.id),
      });
    }
  }

  return { checked: input.assets.length, orphans, relinks, skips };
}

/** After the write: how many assets point at a live line, and which planned ones still do not. */
export function summarizeAfterRelink(
  assets: readonly Pick<AssetRow, "id" | "purchase_order_line_id">[],
  liveLineIds: ReadonlySet<string>,
  plannedAssetIds: readonly string[],
): { assetsTotal: number; pointingAtLiveLine: number; orphansNow: number; plannedStillOrphan: string[] } {
  const byId = new Map(assets.map(a => [a.id, a]));
  const isLive = (a: { purchase_order_line_id: string | null } | undefined) =>
    !!a && a.purchase_order_line_id !== null && liveLineIds.has(a.purchase_order_line_id);
  return {
    assetsTotal: assets.length,
    pointingAtLiveLine: assets.filter(isLive).length,
    orphansNow: assets.filter(a => a.purchase_order_line_id !== null && !liveLineIds.has(a.purchase_order_line_id)).length,
    plannedStillOrphan: plannedAssetIds.filter(id => !isLive(byId.get(id))),
  };
}

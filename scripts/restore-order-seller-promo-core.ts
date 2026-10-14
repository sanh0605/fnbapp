/**
 * Pure selection for scripts/restore-order-seller-promo.ts. Before 2026-10-15
 * every "Sửa đơn" rebuilt the order: the live version took the editor as
 * seller and dropped the promotion link. The root version still holds the
 * original sale, so patch the live version from it.
 */
export interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  parent_order_id: string | null;
  superseded_by: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  applied_promotion_id: string | null;
  applied_promotion_snapshot_json: unknown;
}

export interface Change {
  order_no: string;
  id: string;
  field: string;
  now: unknown;
  next: unknown;
}

export interface Patch {
  id: string;
  order_no: string;
  values: Record<string, unknown>;
  changes: Change[];
}

function rootOf(row: OrderRow, byId: Map<string, OrderRow>): OrderRow {
  let cur = row;
  const seen = new Set<string>();
  while (cur.parent_order_id && byId.has(cur.parent_order_id) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parent_order_id)!;
  }
  return cur;
}

export function selectPatches(rows: readonly OrderRow[]): Patch[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  const patches: Patch[] = [];
  for (const live of rows) {
    if (live.status !== "COMPLETED" || live.superseded_by || !live.parent_order_id) continue;
    const root = rootOf(live, byId);
    if (root.id === live.id) continue;
    const values: Record<string, unknown> = {};
    const changes: Change[] = [];
    const add = (field: string, now: unknown, next: unknown) => {
      values[field] = next;
      changes.push({ order_no: live.order_no, id: live.id, field, now, next });
    };
    if (live.created_by_id !== root.created_by_id) add("created_by_id", live.created_by_id, root.created_by_id);
    if (live.created_by_name !== root.created_by_name) add("created_by_name", live.created_by_name, root.created_by_name);
    if (!live.applied_promotion_id && root.applied_promotion_id) {
      add("applied_promotion_id", live.applied_promotion_id, root.applied_promotion_id);
      add("applied_promotion_snapshot_json", live.applied_promotion_snapshot_json, root.applied_promotion_snapshot_json);
    }
    if (changes.length) patches.push({ id: live.id, order_no: live.order_no, values, changes });
  }
  return patches;
}

// Shared, non-server-action helpers for the report actions in this folder
// (pnl-actions, sales-actions, engagement-actions). "use server" files may
// export only async functions, so these live here.

import { findAllWhere } from "@/lib/db/tables";
import type { SheetFilter } from "@/lib/db/tables";
import { ORDER_STATUS } from "@/lib/sales/order-types";
import type { OrderLineV2 } from "@/lib/sales/order-types";
import type { ProductRevenueRow } from "@/lib/reports/report-v2-allocators";
import { toSaigonUtcRange } from "@/lib/shared/report-time";

export interface PnLReportFilters {
  startDate?: string;
  endDate?: string;
  brandId?: string;
  staffName?: string;
  categoryId?: string;
}


// COMPLETED and not replaced by a later version: the one definition of a counted order.
export async function findCompletedOrders(
  dateRange: ReturnType<typeof toSaigonUtcRange>,
  reportFilters: PnLReportFilters = {},
): Promise<any[]> {
  const filters: SheetFilter = {
    eq: { status: ORDER_STATUS.COMPLETED },
  };
  if (reportFilters.brandId) {
    filters.eq!.brand_id = reportFilters.brandId;
  }
  if (reportFilters.staffName) {
    filters.eq!.created_by_name = reportFilters.staffName;
  }
  if (dateRange) {
    filters.gte = { created_at: dateRange.startUtc };
    filters.lte = { created_at: dateRange.endUtc };
  }
  return (await findAllWhere("Orders_V2", filters)).filter(o => !o.superseded_by);
}

// Same order set for the full Doanh số report and its compare cards.
export function selectSalesOrders(orders: any[], filters: PnLReportFilters): any[] {
  const { startDate, endDate, brandId, staffName } = filters;
  // Claude code — Phase 5.3: Asia/Saigon date bounds.
  const dateRange = toSaigonUtcRange(startDate, endDate);
  return orders.filter(o => {
    if (o.status !== ORDER_STATUS.COMPLETED) return false;
    if (!o.created_at) return false;
    if (dateRange) {
      const d = new Date(o.created_at);
      if (d < dateRange.startUtc || d > dateRange.endUtc) return false;
    }
    if (brandId && o.brand_id !== brandId) return false;
    if (staffName && o.created_by_name !== staffName) return false;
    return true;
  });
}

export function filterLinesByCategory(lines: OrderLineV2[], categoryId: string): OrderLineV2[] {
  return lines.filter(l => {
    try {
      const snap = JSON.parse(l.product_snapshot_json || "{}");
      return snap.category_id === categoryId;
    } catch {
      return false;
    }
  });
}

/** Sums net_line_total per order in one pass (same add order as filtering the lines per order). */
export function sumNetByOrder(lines: Array<{ order_id: string; net_line_total: number }>): Map<string, number> {
  const byOrder = new Map<string, number>();
  for (const l of lines) byOrder.set(l.order_id, (byOrder.get(l.order_id) ?? 0) + l.net_line_total);
  return byOrder;
}

export function mergeModifierRevenueRows(
  productRows: ProductRevenueRow[],
  canonicalModifiers: ReturnType<typeof buildCanonicalModifierLookup>,
): ProductRevenueRow[] {
  const map = new Map<string, ProductRevenueRow>();

  for (const row of productRows.filter(r => r.product_id.startsWith("MOD:"))) {
    const modifierId = row.product_id.replace("MOD:", "");
    const canonical = canonicalModifiers.byId.get(modifierId)
      || canonicalModifiers.byName.get(normalizeModifierName(row.product_name))
      || { id: modifierId, name: row.product_name };
    const key = `MOD:${canonical.id}`;
    const current = map.get(key);
    if (current) {
      current.qty += row.qty;
      current.revenue += row.revenue;
    } else {
      map.set(key, {
        ...row,
        product_id: key,
        product_name: canonical.name,
        variant_id: "",
        size_name: "",
      });
    }
  }

  return Array.from(map.values());
}

export type CanonicalModifier = { id: string; name: string };

export function buildCanonicalModifierLookup(modifiers: any[]): {
  byId: Map<string, CanonicalModifier>;
  byName: Map<string, CanonicalModifier>;
} {
  const byNameGroup = new Map<string, any[]>();
  for (const modifier of modifiers) {
    const id = String(modifier.id || "");
    const name = String(modifier.name || "").trim();
    if (!id || !name) continue;
    const key = normalizeModifierName(name);
    if (!key) continue;
    const group = byNameGroup.get(key) || [];
    group.push(modifier);
    byNameGroup.set(key, group);
  }

  const byId = new Map<string, CanonicalModifier>();
  const byName = new Map<string, CanonicalModifier>();

  for (const [nameKey, group] of byNameGroup.entries()) {
    const canonicalRow = [...group].sort(compareModifierCanonicalPriority)[0];
    const canonical = {
      id: String(canonicalRow.id),
      name: String(canonicalRow.name || canonicalRow.id),
    };
    byName.set(nameKey, canonical);
    for (const row of group) {
      byId.set(String(row.id), canonical);
    }
  }

  return { byId, byName };
}

function compareModifierCanonicalPriority(a: any, b: any): number {
  const aActive = a.status === "ACTIVE" ? 1 : 0;
  const bActive = b.status === "ACTIVE" ? 1 : 0;
  if (aActive !== bActive) return bActive - aActive;

  const aTime = new Date(a.created_at || 0).getTime();
  const bTime = new Date(b.created_at || 0).getTime();
  if (aTime !== bTime) return bTime - aTime;

  return modifierIdNumber(b.id) - modifierIdNumber(a.id);
}

function modifierIdNumber(id: string): number {
  const match = String(id || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function normalizeModifierName(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

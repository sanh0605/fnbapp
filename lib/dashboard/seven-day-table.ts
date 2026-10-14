import { saigonToday } from "@/lib/shared/datetime";
import { displayMoney } from "@/lib/reports/display-rounding";
import { addDays } from "@/lib/shared/date-range-presets";

export interface SevenDayRow {
  day: string; // "YYYY-MM-DD", Saigon
  revenue: number; // sum of orders' net_total
  cups: number;
  cupMoney: number; // sum of drink lines' net_line_total
  avgPerCup: number; // displayMoney(cupMoney / cups), 0 when cups = 0
  foodQty: Record<string, number>; // productId -> qty, every chosen id present
  toppingQty: number | null; // null when no topping type is set
}

export function buildSevenDayTable(input: {
  today: string; // "YYYY-MM-DD" Saigon
  orders: Array<{ id: string; status: string; superseded_by: string | null; created_at: string; net_total: number | string }>;
  lines: Array<{ order_id: string; product_id: string; qty: number | string; net_line_total: number | string; product_snapshot_json: { category_id?: string } | null }>;
  categoryTypeId: Map<string, string>; // category id -> product type id
  drinkTypeIds: Set<string>;
  foodProductIds: string[];
  toppingTypeId: string | null;
}): SevenDayRow[] {
  const { today, orders, lines, categoryTypeId, drinkTypeIds, foodProductIds, toppingTypeId } = input;

  const rows = new Map<string, SevenDayRow>();
  for (let back = 6; back >= 0; back--) {
    const day = addDays(today, -back);
    rows.set(day, {
      day,
      revenue: 0,
      cups: 0,
      cupMoney: 0,
      avgPerCup: 0,
      foodQty: Object.fromEntries(foodProductIds.map(id => [id, 0])),
      toppingQty: toppingTypeId === null ? null : 0,
    });
  }

  // superseded_by is null OR "" on live data; only a real value means replaced.
  const rowByOrderId = new Map<string, SevenDayRow>();
  for (const o of orders) {
    if (o.status !== "COMPLETED" || o.superseded_by) continue;
    const row = rows.get(saigonToday(new Date(o.created_at)));
    if (!row) continue;
    row.revenue += Number(o.net_total) || 0;
    rowByOrderId.set(o.id, row);
  }

  for (const l of lines) {
    const row = rowByOrderId.get(l.order_id);
    if (!row) continue;
    const qty = Number(l.qty) || 0;
    const typeId = categoryTypeId.get(l.product_snapshot_json?.category_id ?? "");
    if (typeId !== undefined && drinkTypeIds.has(typeId)) {
      row.cups += qty;
      row.cupMoney += Number(l.net_line_total) || 0;
    }
    if (l.product_id in row.foodQty) row.foodQty[l.product_id] += qty;
    if (toppingTypeId !== null && typeId === toppingTypeId) row.toppingQty = (row.toppingQty ?? 0) + qty;
  }

  for (const row of rows.values()) {
    row.avgPerCup = row.cups > 0 ? displayMoney(row.cupMoney / row.cups) : 0;
  }
  return [...rows.values()];
}

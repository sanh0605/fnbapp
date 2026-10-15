import { findAll, findAllWhere, findAllWhereInBatches, findById } from "@/lib/db/tables";
import { computeOnHandByPurchasedItem } from "@/lib/stock/purchased-item-onhand";
import { saigonToday } from "@/lib/shared/datetime";
import { toSaigonUtcRange } from "@/lib/shared/report-time";
import { buildSevenDayTable, type SevenDayRow } from "./seven-day-table";
import { computeMonthlyReminders, type MonthlyReminder } from "./monthly-reminders";
import { computeStocktakeAlerts, negativeStockItems, type StocktakeAlerts } from "./alerts";
import type {
  DBCashEntry, DBDashboardSettings, DBMonthlyExpenseItem, DBProduct, DBProductCategory, DBProductType,
} from "@/types/db";

export interface DashboardData {
  negativeStock: Array<{ id: string; name: string; qty: number }>;
  stocktake: StocktakeAlerts;
  reminders: MonthlyReminder[];
  table: SevenDayRow[];
  foodColumns: Array<{ id: string; name: string }>;
  toppingColumnName: string | null;
}

// 00:00 Saigon of the oldest of the seven days (today minus 6), as a UTC instant.
function oldestDayStartIso(now: Date): string {
  const oldest = saigonToday(new Date(now.getTime() - 6 * 86_400_000));
  return toSaigonUtcRange(oldest, oldest)!.startUtc.toISOString();
}

function parseSnapshot(raw: unknown): { category_id?: string } | null {
  if (raw && typeof raw === "object") return raw as { category_id?: string };
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const today = saigonToday(now);
  const since = { gte: { created_at: oldestDayStartIso(now) } };

  const [
    onHand, sessions, settings, monthlyItems,
    rawOrders, rawLines, categories, types,
  ] = await Promise.all([
    computeOnHandByPurchasedItem(),
    // A cancelled count raises no alert, so it is not read.
    findAllWhere<any>("Stocktake_Sessions", { in: { status: ["OPEN", "CONFIRMED"] } }),
    findById("Dashboard_Settings", "1") as Promise<DBDashboardSettings | null>,
    findAll("Monthly_Expense_Items") as Promise<DBMonthlyExpenseItem[]>,
    findAllWhere<any>("Orders_V2", since),
    findAllWhere<any>("Order_Lines_V2", since),
    findAll("Product_Categories") as Promise<DBProductCategory[]>,
    findAll("Product_Types") as Promise<DBProductType[]>,
  ]);

  if (!settings) throw new Error("Chưa có dòng cài đặt Tổng quan (dashboard_settings id 1)");

  // A reminder starts at its item's creation month, so no earlier hand row can matter.
  const oldestItemMonth = monthlyItems
    .filter((i) => i.status === "ACTIVE")
    .map((i) => saigonToday(new Date(i.created_at)).slice(0, 7))
    .sort()[0];
  const [cashEntries, purchasedItems, products] = await Promise.all([
    oldestItemMonth
      ? findAllWhere<DBCashEntry>("Cash_Entries", { gte: { entry_date: `${oldestItemMonth}-01` } })
      : Promise.resolve([] as DBCashEntry[]),
    findAllWhereInBatches<{ id: string; name: string }>("Purchased_Items", "id", [...onHand].filter(([, qty]) => qty < 0).map(([id]) => id)),
    findAllWhereInBatches<DBProduct>("Products", "id", settings.food_product_ids),
  ]);

  const orders = rawOrders.map((o) => ({
    id: o.id,
    status: o.status,
    superseded_by: o.superseded_by ?? null,
    created_at: o.created_at,
    net_total: o.net_total,
  }));
  const orderIds = new Set(orders.map((o) => o.id));
  const lines = rawLines
    .filter((l) => orderIds.has(l.order_id))
    .map((l) => ({
      order_id: l.order_id,
      product_id: l.product_id,
      qty: l.qty,
      net_line_total: l.net_line_total,
      product_snapshot_json: parseSnapshot(l.product_snapshot_json),
    }));

  const categoryTypeId = new Map<string, string>();
  for (const c of categories) categoryTypeId.set(c.id, c.type_id);
  const drinkTypeIds = new Set(types.filter((t) => t.is_drink).map((t) => t.id));

  const table = buildSevenDayTable({
    today,
    orders,
    lines,
    categoryTypeId,
    drinkTypeIds,
    foodProductIds: settings.food_product_ids,
    toppingTypeId: settings.topping_type_id,
  });

  const productName = new Map(products.map((p) => [p.id, p.name]));
  const foodColumns = settings.food_product_ids.map((id) => ({ id, name: productName.get(id) ?? id }));
  const toppingColumnName = settings.topping_type_id
    ? types.find((t) => t.id === settings.topping_type_id)?.name ?? null
    : null;

  return {
    negativeStock: negativeStockItems(onHand, new Map(purchasedItems.map((i) => [i.id, i.name]))),
    stocktake: computeStocktakeAlerts({
      today,
      staleDays: settings.stale_stocktake_days,
      openDays: settings.open_stocktake_days,
      sessions,
    }),
    reminders: computeMonthlyReminders({
      today,
      reminderStartDay: settings.reminder_start_day,
      items: monthlyItems,
      entries: cashEntries.filter((e) => e.monthly_item_id),
    }),
    table,
    foodColumns,
    toppingColumnName,
  };
}

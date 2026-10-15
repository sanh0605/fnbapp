import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only check of lib/dashboard/seven-day-table.ts against the table the
 * owner confirmed (spec docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md, section 3).
 * Reads live orders and lines, builds 2026-10-08..2026-10-13, compares every
 * cell. No writes. The dates are fixed on purpose: they are the owner's confirmed example (spec
 * 2026-10-14), so the script must not follow today's date.
 *
 * Run: npx vite-node scripts/verify-dashboard-seven-days.ts
 */

const TODAY = "2026-10-13";
interface Expected { day: string; revenue: number; avg: number; cups: number; egg: number; potato: number; topping: number }
const EXPECTED: Expected[] = [
  { day: "2026-10-08", revenue: 714000, avg: 20889, cups: 27, egg: 22, potato: 12, topping: 0 },
  { day: "2026-10-09", revenue: 838000, avg: 21344, cups: 32, egg: 25, potato: 14, topping: 0 },
  { day: "2026-10-10", revenue: 480000, avg: 20000, cups: 19, egg: 19, potato: 9, topping: 0 },
  { day: "2026-10-11", revenue: 30000, avg: 15000, cups: 2, egg: 0, potato: 0, topping: 0 },
  { day: "2026-10-12", revenue: 873000, avg: 20848, cups: 33, egg: 25, potato: 18, topping: 0 },
  { day: "2026-10-13", revenue: 526000, avg: 21235, cups: 17, egg: 22, potato: 11, topping: 0 },
];

async function main(): Promise<void> {
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { buildSevenDayTable } = await import("@/lib/dashboard/seven-day-table");

  // findAllNoCache paginates past PostgREST's 1,000-row cap.
  const [rawOrders, rawLines, categories, types, settingsRows] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Product_Categories") as Promise<Array<{ id: string; type_id: string }>>,
    findAllNoCache("Product_Types") as Promise<Array<{ id: string; is_drink: boolean }>>,
    findAllNoCache("Dashboard_Settings") as Promise<Array<{ id: number | string; food_product_ids: string[]; topping_type_id: string | null }>>,
  ]);
  console.log(`Fetched ${rawOrders.length} orders, ${rawLines.length} lines, ${categories.length} categories, ${types.length} types.`);

  const settings = settingsRows.find(r => String(r.id) === "1");
  if (!settings) throw new Error("dashboard_settings id 1 is missing");

  // product_snapshot_json comes back as a JSON string (see verify-revenue.ts).
  const lines = (rawLines as any[]).map(l => {
    let snap: { category_id?: string } | null = null;
    try {
      const parsed = JSON.parse(l.product_snapshot_json || "{}");
      snap = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      snap = null;
    }
    return {
      order_id: l.order_id,
      product_id: l.product_id,
      qty: l.qty,
      net_line_total: l.net_line_total,
      product_snapshot_json: snap,
    };
  });

  const rows = buildSevenDayTable({
    today: TODAY,
    orders: (rawOrders as any[]).map(o => ({
      id: o.id,
      status: o.status,
      superseded_by: o.superseded_by ?? null,
      created_at: o.created_at,
      net_total: o.net_total,
    })),
    lines,
    categoryTypeId: new Map(categories.map(c => [c.id, c.type_id])),
    drinkTypeIds: new Set(types.filter(t => t.is_drink).map(t => t.id)),
    foodProductIds: settings.food_product_ids,
    toppingTypeId: settings.topping_type_id,
  });

  let cells = 0;
  const mismatches: string[] = [];
  const check = (day: string, name: string, expected: number, actual: number | null) => {
    cells++;
    if (expected !== actual) mismatches.push(`${day} ${name}: expected ${expected}, got ${actual}`);
  };

  console.log("\nday        revenue   avg/cup  cups  Trung luoc  Khoai lang  topping");
  for (const e of EXPECTED) {
    const r = rows.find(x => x.day === e.day);
    if (!r) {
      mismatches.push(`${e.day}: row missing`);
      cells += 6;
      continue;
    }
    console.log(
      `${r.day} ${String(r.revenue).padStart(9)} ${String(r.avgPerCup).padStart(9)} ${String(r.cups).padStart(5)} ` +
        `${String(r.foodQty["PROD-028"]).padStart(11)} ${String(r.foodQty["PROD-027"]).padStart(11)} ${String(r.toppingQty).padStart(8)}`,
    );
    check(e.day, "revenue", e.revenue, r.revenue);
    check(e.day, "avgPerCup", e.avg, r.avgPerCup);
    check(e.day, "cups", e.cups, r.cups);
    check(e.day, "Trung luoc", e.egg, r.foodQty["PROD-028"]);
    check(e.day, "Khoai lang", e.potato, r.foodQty["PROD-027"]);
    check(e.day, "topping", e.topping, r.toppingQty);
  }

  if (mismatches.length === 0) {
    console.log(`\n0 lech tren ${cells} o.`);
    return;
  }
  console.log(`\n${mismatches.length} lech tren ${cells} o:`);
  for (const m of mismatches) console.log(`  ${m}`);
  process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

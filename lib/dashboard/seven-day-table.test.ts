import { describe, it, expect } from "vitest";
import { buildSevenDayTable } from "./seven-day-table";

const categoryTypeId = new Map([
  ["CAT-001", "PT-001"],
  ["CAT-003", "PT-001"],
  ["CAT-006", "PT-002"],
  ["CAT-007", "PT-003"],
]);
const drinkTypeIds = new Set(["PT-001"]);

type Order = Parameters<typeof buildSevenDayTable>[0]["orders"][number];
type Line = Parameters<typeof buildSevenDayTable>[0]["lines"][number];

// 2026-10-08T03:00:00Z is 10:00 on 08/10 in Saigon.
function order(id: string, over: Partial<Order> = {}): Order {
  return { id, status: "COMPLETED", superseded_by: null, created_at: "2026-10-08T03:00:00Z", net_total: 10000, ...over };
}
function line(order_id: string, over: Partial<Line> = {}): Line {
  return {
    order_id,
    product_id: "PROD-001",
    qty: 1,
    net_line_total: 10000,
    product_snapshot_json: { category_id: "CAT-001" },
    ...over,
  };
}
function run(orders: Order[], lines: Line[], over: Partial<Parameters<typeof buildSevenDayTable>[0]> = {}) {
  return buildSevenDayTable({
    today: "2026-10-13",
    orders,
    lines,
    categoryTypeId,
    drinkTypeIds,
    foodProductIds: ["PROD-028", "PROD-027"],
    toppingTypeId: "PT-003",
    ...over,
  });
}

describe("buildSevenDayTable", () => {
  it("returns 7 rows oldest first with zeros on empty days", () => {
    const rows = run([], []);
    expect(rows.map(r => r.day)).toEqual([
      "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13",
    ]);
    for (const r of rows) {
      expect(r).toMatchObject({ revenue: 0, cups: 0, cupMoney: 0, avgPerCup: 0, toppingQty: 0 });
      expect(r.foodQty).toEqual({ "PROD-028": 0, "PROD-027": 0 });
    }
  });

  it("does not count superseded or cancelled orders", () => {
    const orders = [
      order("a"),
      order("b", { superseded_by: "a" }),
      order("c", { status: "CANCELLED" }),
    ];
    const lines = [line("a"), line("b"), line("c")];
    const row = run(orders, lines).find(r => r.day === "2026-10-08")!;
    expect(row.revenue).toBe(10000);
    expect(row.cups).toBe(1);
  });

  it("counts orders whose superseded_by is null or an empty string", () => {
    const orders = [order("a", { superseded_by: null }), order("b", { superseded_by: "" })];
    const row = run(orders, []).find(r => r.day === "2026-10-08")!;
    expect(row.revenue).toBe(20000);
  });

  it("counts a 0 dong order and its cup", () => {
    const orders = [order("a", { net_total: 0 })];
    const lines = [line("a", { net_line_total: 0 })];
    const row = run(orders, lines).find(r => r.day === "2026-10-08")!;
    expect(row.revenue).toBe(0);
    expect(row.cups).toBe(1);
    expect(row.avgPerCup).toBe(0);
  });

  it("counts a line of the deleted category CAT-003 as a cup, and ignores unmapped categories", () => {
    const orders = [order("a")];
    const lines = [
      line("a", { product_snapshot_json: { category_id: "CAT-003" } }),
      line("a", { product_snapshot_json: { category_id: "CAT-999" } }),
      line("a", { product_snapshot_json: null }),
    ];
    const row = run(orders, lines).find(r => r.day === "2026-10-08")!;
    expect(row.cups).toBe(1);
  });

  it("puts an order created 23:30 Saigon on 08/10 (16:30Z) into 08/10", () => {
    const orders = [order("a", { created_at: "2026-10-08T16:30:00Z" })];
    const rows = run(orders, []);
    expect(rows.find(r => r.day === "2026-10-08")!.revenue).toBe(10000);
    expect(rows.find(r => r.day === "2026-10-09")!.revenue).toBe(0);
  });

  it("returns toppingQty null when no topping type is set, sums qty otherwise", () => {
    const orders = [order("a")];
    const lines = [
      line("a", { qty: 2, product_snapshot_json: { category_id: "CAT-007" } }),
      line("a", { qty: "3", product_snapshot_json: { category_id: "CAT-007" } }),
    ];
    expect(run(orders, lines, { toppingTypeId: null }).every(r => r.toppingQty === null)).toBe(true);
    expect(run(orders, lines).find(r => r.day === "2026-10-08")!.toppingQty).toBe(5);
  });

  it("sums food qty per chosen product and accepts money as strings", () => {
    const orders = [order("a", { net_total: "50000.00" })];
    const lines = [
      line("a", { product_id: "PROD-028", qty: "2", net_line_total: "20000", product_snapshot_json: { category_id: "CAT-006" } }),
      line("a", { product_id: "PROD-027", qty: 1, net_line_total: "10000", product_snapshot_json: { category_id: "CAT-006" } }),
    ];
    const row = run(orders, lines).find(r => r.day === "2026-10-08")!;
    expect(row.foodQty).toEqual({ "PROD-028": 2, "PROD-027": 1 });
    expect(row.revenue).toBe(50000);
    expect(row.cups).toBe(0);
  });

  it("rounds the average per cup: 564000 / 27 is 20889", () => {
    const orders = [order("a")];
    const lines = Array.from({ length: 27 }, (_, i) =>
      line("a", { net_line_total: i === 0 ? 564000 - 26 * 20000 : 20000 }),
    );
    const row = run(orders, lines).find(r => r.day === "2026-10-08")!;
    expect(row.cups).toBe(27);
    expect(row.cupMoney).toBe(564000);
    expect(row.avgPerCup).toBe(20889);
  });
});

import { describe, expect, it, vi } from "vitest";

const tables = vi.hoisted(() => ({ data: {} as Record<string, any[]> }));
vi.mock("@/lib/db/tables", () => ({ findAllNoCache: async (name: string) => tables.data[name] ?? [] }));

import { buildStockOnHand } from "./stock-on-hand";
import { computeOnHandByPurchasedItem } from "./purchased-item-onhand";

const NOW = new Date("2026-10-15T05:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const categories = [
  { id: "C-RAW", name: "Nguyên liệu", system_type: "RAW" },
  { id: "C-EQ", name: "Dụng cụ", system_type: "EQUIPMENT" },
];
const units = [{ id: "U-G", name: "g" }];
const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: id, item_category_id: "C-RAW", status: "ACTIVE", is_non_inventory: false, ...extra,
});
const conversions = ["A", "B", "D", "E", "F", "G", "EQ"].map(id => ({ purchased_item_id: id, base_unit: "U-G", status: "ACTIVE" }));

const po = { id: "PO1", status: "COMPLETED", transaction_date: daysAgo(60), shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0 };
let n = 0;
const line = (purchased_item_id: string, base_quantity: number, subtotal: number) =>
  ({ id: `L${n++}`, purchase_order_id: "PO1", purchased_item_id, base_quantity, subtotal });
const issue = (purchased_item_id: string, base_quantity: number, issued_at: string, extra: Record<string, unknown> = {}) =>
  ({ id: `I${n++}`, purchased_item_id, base_quantity, issued_at, source: "MANUAL", session_id: null, ...extra });

const base = {
  purchaseOrders: [po], purchaseOrderLines: [] as any[], stockIssues: [] as any[],
  stocktakeSessions: [] as any[], stocktakeLines: [] as any[],
  items: [item("A")] as any[], categories, conversions, units, now: NOW,
};
const row = (input: typeof base, id: string) => buildStockOnHand(input).rows.find(r => r.itemId === id)!;

describe("buildStockOnHand", () => {
  it("days left = on hand / 30-day use * 30: 2.500 / 7.500 -> 10", () => {
    const r = row({ ...base, purchaseOrderLines: [line("A", 10000, 100000)], stockIssues: [issue("A", 7500, daysAgo(5))] }, "A");
    expect(r.onHand).toBe(2500);
    expect(r.daysLeft).toBe(10);
    expect(r.unitName).toBe("g");
    expect(r.categoryName).toBe("Nguyên liệu");
  });

  it("rounds days down: 1.100 / 5.600 -> 5", () => {
    const r = row({ ...base, purchaseOrderLines: [line("A", 6700, 67000)], stockIssues: [issue("A", 5600, daysAgo(3))] }, "A");
    expect(r.daysLeft).toBe(5);
  });

  it("a cancelling row nets out of the use; stocktake and older-than-30-day rows do not count", () => {
    const r = row({
      ...base,
      purchaseOrderLines: [line("A", 10000, 100000)],
      stockIssues: [
        issue("A", 3000, daysAgo(5)),
        issue("A", -1000, daysAgo(4), { reverses_issue_id: "x" }),
        issue("A", 500, daysAgo(2), { source: "STOCKTAKE", session_id: "S" }),
        issue("A", 2000, daysAgo(40)),
      ],
    }, "A");
    expect(r.onHand).toBe(5500);
    expect(r.daysLeft).toBe(82); // 5500 / 2000 * 30 = 82.5
  });

  it("no use in 30 days -> null; zero stock -> OUT", () => {
    const input = { ...base, items: [item("A"), item("B")], purchaseOrderLines: [line("A", 100, 1000), line("B", 100, 1000)], stockIssues: [issue("B", 100, daysAgo(50))] };
    expect(row(input, "A").daysLeft).toBeNull();
    expect(row(input, "B").daysLeft).toBe("OUT");
  });

  it("negative stock gets no days label", () => {
    const r = row({ ...base, purchaseOrderLines: [line("A", 100, 1000)], stockIssues: [issue("A", 300, daysAgo(1))] }, "A");
    expect(r.onHand).toBe(-200);
    expect(r.daysLeft).toBeNull();
  });

  it("last count = latest confirmed session that gave the item a number", () => {
    const input = {
      ...base,
      purchaseOrderLines: [line("A", 100, 1000)],
      stocktakeSessions: [
        { id: "S1", status: "CONFIRMED", confirmed_at: "2026-08-09T15:00:00Z" },
        { id: "S2", status: "CONFIRMED", confirmed_at: "2026-09-09T15:00:00Z" },
        { id: "S3", status: "REVERSED", confirmed_at: "2026-10-01T15:00:00Z" },
        { id: "S4", status: "CONFIRMED", confirmed_at: "2026-10-05T15:00:00Z" },
      ],
      stocktakeLines: [
        { session_id: "S1", item_reference: "A", counted_qty: 5 },
        { session_id: "S2", item_reference: "A", counted_qty: 0 },
        { session_id: "S3", item_reference: "A", counted_qty: 5 },
        { session_id: "S4", item_reference: "A", counted_qty: null },
      ],
    };
    expect(row(input, "A").lastCountedAt).toBe("2026-09-09T15:00:00Z");
    expect(buildStockOnHand({ ...input, stocktakeLines: [] }).rows[0].lastCountedAt).toBeNull();
  });

  it("drops Dụng cụ, untracked and stopped-with-zero items; keeps stopped items that still hold stock", () => {
    const input = {
      ...base,
      items: [item("A"), item("EQ", { item_category_id: "C-EQ" }), item("D", { is_non_inventory: true }), item("E", { status: "INACTIVE" }), item("F", { status: "INACTIVE" })],
      purchaseOrderLines: [line("A", 10, 100), line("EQ", 1, 10), line("D", 1, 10), line("E", 10, 100), line("F", 10, 100)],
      stockIssues: [issue("F", 10, daysAgo(50))],
    };
    const rows = buildStockOnHand(input).rows;
    expect(rows.map(r => r.itemId).sort()).toEqual(["A", "E"]);
    expect(rows.find(r => r.itemId === "E")!.inactive).toBe(true);
  });

  it("orders OUT, fewest days, then null items by name", () => {
    const input = {
      ...base,
      items: [item("A", { name: "Zeta" }), item("B", { name: "Beta" }), item("D", { name: "Delta" }), item("E", { name: "Echo" })],
      purchaseOrderLines: [line("A", 100, 1000), line("B", 100, 1000), line("D", 100, 1000), line("E", 100, 1000)],
      stockIssues: [issue("A", 10, daysAgo(2)), issue("D", 50, daysAgo(2)), issue("E", 100, daysAgo(2))],
    };
    expect(buildStockOnHand(input).rows.map(r => r.name)).toEqual(["Echo", "Delta", "Zeta", "Beta"]);
  });

  it("value is the costing closing value; total is the rounded sum of unrounded values", () => {
    const input = {
      ...base,
      items: [item("A"), item("B")],
      purchaseOrderLines: [line("A", 3, 100), line("B", 3, 100)],
      stockIssues: [issue("A", 1, daysAgo(2)), issue("B", 1, daysAgo(2))],
    };
    const out = buildStockOnHand(input);
    expect(out.rows[0].value).toBeCloseTo(66.6667, 3);
    expect(out.total).toBe(133); // 2 x 66.67 = 133.33, rounded once
    expect(out.unpricedCount).toBe(0);
  });

  it("an item whose history cannot be replayed keeps its quantity, gets value null and is counted", () => {
    const input = {
      ...base,
      items: [item("A"), item("B")],
      purchaseOrderLines: [line("A", 100, 1000), line("B", 100, 1000)],
      // B: issued before it was ever bought
      stockIssues: [issue("B", 10, daysAgo(90))],
    };
    const out = buildStockOnHand(input);
    const b = out.rows.find(r => r.itemId === "B")!;
    expect(b.onHand).toBe(90);
    expect(b.value).toBeNull();
    expect(out.unpricedCount).toBe(1);
    expect(out.total).toBe(1000);
  });

  it("quantities equal computeOnHandByPurchasedItem on the same data", async () => {
    const input = {
      ...base,
      items: [item("A"), item("B")],
      purchaseOrderLines: [line("A", 10000, 100000), line("B", 500, 5000)],
      stockIssues: [issue("A", 7500, daysAgo(5)), issue("B", -20, daysAgo(4)), issue("B", 40, daysAgo(40), { source: "STOCKTAKE" })],
    };
    tables.data = { Purchase_Order_Lines: input.purchaseOrderLines, Purchase_Orders: input.purchaseOrders, Stock_Issues: input.stockIssues };
    const expected = await computeOnHandByPurchasedItem();
    for (const r of buildStockOnHand(input).rows) expect(r.onHand).toBe(expected.get(r.itemId));
  });
});

import { describe, it, expect } from "vitest";
import { computeIssuedItemFigures, computeIssuedEventFigures, computeIssuedMonthFigures } from "@/lib/reports/issued-value-report";
import { computeProfitAndLoss } from "@/lib/reports/profit-and-loss";
import { buildIssueCostingPurchases, buildIssueCostingIssues, buildClassifiedIssues, selectCostedIssues } from "@/lib/costing/issue-costing-inputs";
import type { Purchase, Issue } from "@/lib/costing/issue-costing";
import liveSnapshot from "@/app/admin/reports/issued/__fixtures__/2026-08-13-live-snapshot.json";

// Plan G section 5's gate: a stocktake session's or an issue slip's value is
// derived by prefix subtraction in the engine's own order, never by
// multiplying a quantity by a unit cost computed some other way -- that
// would be a second cost definition, disagreeing with the total by
// construction. The only proof that the derivation is doing that (and not
// something that merely looks similar) is that summing every group's exact
// value reproduces the exact per-item grand total, with nothing left over.
describe("computeIssuedEventFigures: the section 5 sum gate", () => {
  it("real snapshot (2026-08-13): sum of exact per-event values equals the exact per-item grand total", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const allIssues = buildIssueCostingIssues(liveSnapshot.stockIssues as any[]);

    const itemFigures = computeIssuedItemFigures(purchases, allIssues);
    const grandTotalExact = itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0);

    const eventFigures = computeIssuedEventFigures(liveSnapshot.stockIssues as any[], purchases);
    const sumOfEventValuesExact = eventFigures.reduce((sum, f) => sum + f.valueExact, 0);

    // Telescoping sum in floating point -- exact to within FP noise, not
    // display rounding (lib/reports/display-rounding.ts rounds each part
    // independently for the page, which is a separate, accepted trade-off
    // this test does not exercise).
    expect(sumOfEventValuesExact).toBeCloseTo(grandTotalExact, 6);
  });

  it("real snapshot: no group has a negative value", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const eventFigures = computeIssuedEventFigures(liveSnapshot.stockIssues as any[], purchases);

    for (const f of eventFigures) {
      expect(f.valueExact).toBeGreaterThanOrEqual(-0.005);
    }
  });

  it("real snapshot: STOCKTAKE rows group by session_id, MANUAL rows group by issue_slip_id -- one group per real slip/session, not one per row", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const eventFigures = computeIssuedEventFigures(liveSnapshot.stockIssues as any[], purchases);

    const stocktakeGroups = eventFigures.filter(f => f.kind === "STOCKTAKE");
    const manualGroups = eventFigures.filter(f => f.kind === "MANUAL");

    // The live snapshot has 49 STOCKTAKE rows under one session, and 10
    // MANUAL rows under 6 slips (verified live 2026-08-13).
    expect(stocktakeGroups).toHaveLength(1);
    expect(manualGroups).toHaveLength(6);
  });

  it("synthetic: three groups touching the same item, ordered out of insertion order, still sum exactly", () => {
    // Deliberately hands the groups to computeIssuedEventFigures in an
    // order different from their real chronological order (group C's rows
    // appear first in the array), to prove group ordering is derived from
    // each row's own issued_at, not from array position.
    const purchases: Purchase[] = [
      { purchased_item_id: "SPM-TEST", at: "2026-01-01T00:00:00Z", base_quantity: 100, subtotal: 1000 },
    ];
    const stockIssues = [
      { id: "R3", purchased_item_id: "SPM-TEST", issued_at: "2026-01-03T00:00:00Z", base_quantity: 10, source: "MANUAL", issue_slip_id: "SLIP-C" },
      { id: "R1", purchased_item_id: "SPM-TEST", issued_at: "2026-01-01T01:00:00Z", base_quantity: 20, source: "STOCKTAKE", session_id: "SESSION-A" },
      { id: "R2", purchased_item_id: "SPM-TEST", issued_at: "2026-01-02T00:00:00Z", base_quantity: 15, source: "MANUAL", issue_slip_id: "SLIP-B" },
    ];

    const allIssues: Issue[] = buildIssueCostingIssues(stockIssues);
    const itemFigures = computeIssuedItemFigures(purchases, allIssues);
    const grandTotalExact = itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0);

    const eventFigures = computeIssuedEventFigures(stockIssues, purchases);
    expect(eventFigures).toHaveLength(3);
    // Newest first.
    expect(eventFigures.map(f => f.key)).toEqual(["M:SLIP-C", "M:SLIP-B", "S:SESSION-A"]);

    const sumOfEventValuesExact = eventFigures.reduce((sum, f) => sum + f.valueExact, 0);
    expect(sumOfEventValuesExact).toBeCloseTo(grandTotalExact, 6);

    // All three issues share one weighted-average rate (10/unit, since
    // there is only one purchase) -- each group's value is exactly its own
    // quantity times that rate.
    expect(eventFigures.find(f => f.key === "S:SESSION-A")!.valueExact).toBeCloseTo(200, 6);
    expect(eventFigures.find(f => f.key === "M:SLIP-B")!.valueExact).toBeCloseTo(150, 6);
    expect(eventFigures.find(f => f.key === "M:SLIP-C")!.valueExact).toBeCloseTo(100, 6);
  });
});

// Plan G G5's own sum gate, same shape as section 5's: the months must sum
// exactly to the same exact grand total the other two tabs derive from, or
// the month boundaries have a gap or an overlap and the tab is wrong. This
// holds regardless of what "today" is when the test runs -- every month
// after the fixture's real data reads 0đ (nothing to add), so the sum
// stays exact no matter how far in the future this suite is run.
const classified = (issues: Issue[]) => issues.map(i => ({ ...i, isShrinkage: false }));
const total = (f: { costExact: number; shrinkageExact: number }) => f.costExact + f.shrinkageExact;

describe("computeIssuedMonthFigures: the G5 sum gate", () => {
  it("real snapshot (2026-08-13): sum of exact per-month values equals the exact per-item grand total", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const allIssues = buildIssueCostingIssues(liveSnapshot.stockIssues as any[]);

    const itemFigures = computeIssuedItemFigures(purchases, allIssues);
    const grandTotalExact = itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0);

    const monthFigures = computeIssuedMonthFigures(purchases, classified(allIssues), "2026-06", "2026-10");
    const sumOfMonthValuesExact = monthFigures.reduce((sum, f) => sum + total(f), 0);

    expect(sumOfMonthValuesExact).toBeCloseTo(grandTotalExact, 6);
  });

  it("real snapshot: zero months are present, not hidden -- June and July read 0đ, August carries the whole total", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const allIssues = buildIssueCostingIssues(liveSnapshot.stockIssues as any[]);
    const monthFigures = computeIssuedMonthFigures(purchases, classified(allIssues), "2026-06", "2026-10");

    const june = monthFigures.find(f => f.yearMonth === "2026-06");
    const july = monthFigures.find(f => f.yearMonth === "2026-07");
    const august = monthFigures.find(f => f.yearMonth === "2026-08");

    expect(june).toBeDefined();
    expect(july).toBeDefined();
    expect(total(june!)).toBe(0);
    expect(total(july!)).toBe(0);
    expect(total(august!)).toBeCloseTo(35_616_235.842, 2);
  });

  it("real snapshot: months are newest first", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const allIssues = buildIssueCostingIssues(liveSnapshot.stockIssues as any[]);
    const monthFigures = computeIssuedMonthFigures(purchases, classified(allIssues), "2026-06", "2026-10");

    const yearMonths = monthFigures.map(f => f.yearMonth);
    const sorted = [...yearMonths].sort().reverse();
    expect(yearMonths).toEqual(sorted);
  });

  it("synthetic: three consecutive months, no purchases or issues before or after, sum exactly with no gap or overlap", () => {
    const purchases: Purchase[] = [
      { purchased_item_id: "SPM-TEST", at: "2026-02-01T00:00:00+07:00", base_quantity: 100, subtotal: 1000 },
    ];
    const stockIssues = [
      // Deliberately near month boundaries -- the last instant of February
      // and the first instant of March, Saigon time -- to prove the
      // boundary itself has no gap or double-counted millisecond.
      { id: "R1", purchased_item_id: "SPM-TEST", issued_at: "2026-02-28T23:59:59.999+07:00", base_quantity: 10, source: "MANUAL", issue_slip_id: "SLIP-FEB" },
      { id: "R2", purchased_item_id: "SPM-TEST", issued_at: "2026-03-01T00:00:00.000+07:00", base_quantity: 20, source: "MANUAL", issue_slip_id: "SLIP-MAR" },
    ];
    const allIssues: Issue[] = buildIssueCostingIssues(stockIssues);

    const itemFigures = computeIssuedItemFigures(purchases, allIssues);
    const grandTotalExact = itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0);

    const monthFigures = computeIssuedMonthFigures(purchases, classified(allIssues), "2026-02", "2026-03");
    const feb = monthFigures.find(f => f.yearMonth === "2026-02")!;
    const mar = monthFigures.find(f => f.yearMonth === "2026-03")!;

    expect(feb).toBeDefined();
    expect(mar).toBeDefined();
    // 10/unit rate: R1 (10 units, still February) = 100; R2 (20 units, now
    // March) = 200. Neither event's value leaked into the other's month.
    expect(total(feb)).toBeCloseTo(100, 6);
    expect(total(mar)).toBeCloseTo(200, 6);

    const sumOfMonthValuesExact = monthFigures.reduce((sum, f) => sum + total(f), 0);
    expect(sumOfMonthValuesExact).toBeCloseTo(grandTotalExact, 6);
  });
});

// BR-INV-014 (2026-10-01): an issue slip carries no note, so its card is
// titled by the items on it, not by the note.
describe("computeIssuedEventFigures: labels", () => {
  const purchases: Purchase[] = [
    { purchased_item_id: "A", at: "2026-01-01T00:00:00Z", base_quantity: 100, subtotal: 1000 },
    { purchased_item_id: "B", at: "2026-01-01T00:00:00Z", base_quantity: 100, subtotal: 1000 },
    { purchased_item_id: "C", at: "2026-01-01T00:00:00Z", base_quantity: 100, subtotal: 1000 },
    { purchased_item_id: "D", at: "2026-01-01T00:00:00Z", base_quantity: 100, subtotal: 1000 },
  ];
  const names = new Map([["A", "Sữa tươi Mlekovita"], ["B", "Trứng gà"], ["C", "Đường"], ["D", "Cà phê"]]);
  const row = (id: string, item: string, slip: string, note = "") =>
    ({ id, purchased_item_id: item, issued_at: "2026-01-02T00:00:00Z", base_quantity: 1, source: "MANUAL", issue_slip_id: slip, note });

  it("one item: its name; ignores any leftover note", () => {
    const [f] = computeIssuedEventFigures([row("1", "A", "S1", "Khác")], purchases, names);
    expect(f.label).toBe("Sữa tươi Mlekovita");
  });

  it("two items in line order, duplicates merged", () => {
    const rows = [row("1", "B", "S1"), row("2", "A", "S1"), row("3", "B", "S1")];
    const [f] = computeIssuedEventFigures(rows, purchases, names);
    expect(f.label).toBe("Trứng gà, Sữa tươi Mlekovita");
  });

  it("more than two distinct items: first two names then 'và N mặt hàng khác'", () => {
    const rows = [row("1", "A", "S1"), row("2", "B", "S1"), row("3", "C", "S1"), row("4", "D", "S1")];
    const [f] = computeIssuedEventFigures(rows, purchases, names);
    expect(f.label).toBe("Sữa tươi Mlekovita, Trứng gà và 2 mặt hàng khác");
  });

  it("never reads 'Không có ghi chú'; stocktake label unchanged", () => {
    const rows = [row("1", "A", "S1"), { ...row("2", "A", "x"), source: "STOCKTAKE", session_id: "SES" }];
    const figures = computeIssuedEventFigures(rows, purchases, names);
    expect(figures.map(f => f.label).sort()).toEqual(["Kiểm kê định kỳ", "Sữa tươi Mlekovita"]);
    expect(figures.some(f => f.label.includes("Không có ghi chú"))).toBe(false);
  });
});

// Performance rewrite guard (audit B6): replaying only the items a group touches must equal the original
// "replay everything after each group, subtract" to the last bit.
describe("computeIssuedEventFigures: per-item replay equals the full replay per group", () => {
  it("matches the brute-force prefix replay exactly on interleaved items and slips", () => {
    const purchases: Purchase[] = ["A", "B", "C"].flatMap((id, n) => [
      { purchased_item_id: id, at: "2026-08-01T00:00:00Z", base_quantity: 100 + n, subtotal: 1000 * (n + 1) + 0.37 },
      { purchased_item_id: id, at: "2026-08-10T00:00:00Z", base_quantity: 50, subtotal: 777.77 * (n + 1) },
    ]);
    const rows: any[] = [];
    for (let i = 0; i < 30; i++) {
      for (const id of i % 2 ? ["A", "C"] : ["B", "A"]) {
        rows.push({ id: `R${i}-${id}`, purchased_item_id: id, issued_at: `2026-08-${String(2 + (i % 20)).padStart(2, "0")}T0${i % 9}:00:00Z`, base_quantity: 0.7 + (i % 3), source: "MANUAL", issue_slip_id: `S${i}` });
      }
    }
    const got = computeIssuedEventFigures(rows, purchases).reverse();

    let previous = 0;
    const cumulative: Issue[] = [];
    const expected = got.map(f => {
      cumulative.push(...buildIssueCostingIssues(rows.filter(r => `M:${r.issue_slip_id}` === f.key)));
      const total = computeIssuedItemFigures(purchases, cumulative).reduce((s, x) => s + x.issuedValueExact, 0);
      const delta = total - previous;
      previous = total;
      return delta;
    });
    expect(got.map(f => f.valueExact)).toEqual(expected);
  });
});

// Báo cáo plan root 2: each month's Hàng dùng + Hao hụt is Lãi lỗ's Giá vốn + Hao hụt for that month.
describe("computeIssuedMonthFigures: Hàng dùng and Hao hụt tie to Lãi lỗ", () => {
  const po = (id: string, at: string) => ({
    id, status: "COMPLETED", transaction_date: at, created_at: at,
    shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0,
  });
  const data = {
    purchasedItems: [{ id: "SPM-001", name: "Sữa tươi", item_category_id: "NHH-001", is_non_inventory: false }],
    itemCategories: [{ id: "NHH-001", system_type: "RAW" }],
    purchaseOrders: [po("PO-1", "2026-07-01T03:00:00Z")],
    // 100đ per unit
    purchaseOrderLines: [{ id: "POL-1", purchase_order_id: "PO-1", purchased_item_id: "SPM-001", base_quantity: 1000, subtotal: 100_000 }],
    stocktakeSessions: [{ id: "STK-001", is_shrinkage: false }, { id: "STK-003", is_shrinkage: true }],
    stockIssues: [
      { id: "ISS-1", purchased_item_id: "SPM-001", issued_at: "2026-07-10T03:00:00Z", base_quantity: 200, source: "MANUAL", issue_slip_id: "ISL-1" },
      { id: "ISS-2", purchased_item_id: "SPM-001", issued_at: "2026-08-09T03:00:00Z", base_quantity: 300, source: "STOCKTAKE", session_id: "STK-001" },
      { id: "ISS-3", purchased_item_id: "SPM-001", issued_at: "2026-08-20T03:00:00Z", base_quantity: 100, source: "STOCKTAKE", session_id: "STK-003" },
    ],
  };
  const purchases = buildIssueCostingPurchases(data.purchaseOrders, data.purchaseOrderLines);
  const issues = buildClassifiedIssues(selectCostedIssues(data.stockIssues, data.purchasedItems, data.itemCategories), data.stocktakeSessions);

  it("a counted shortage goes to Hao hụt, a slip and a not-shrinkage count to Hàng dùng", () => {
    const months = computeIssuedMonthFigures(purchases, issues, "2026-07", "2026-08");
    expect(months.map(m => m.yearMonth)).toEqual(["2026-08", "2026-07"]); // newest first
    expect(months[1].costExact).toBeCloseTo(20_000, 6);
    expect(months[1].shrinkageExact).toBeCloseTo(0, 6);
    expect(months[0].costExact).toBeCloseTo(30_000, 6);
    expect(months[0].shrinkageExact).toBeCloseTo(10_000, 6);
  });

  it("each month equals the Giá vốn and Hao hụt Lãi lỗ shows for it", () => {
    const pnl = computeProfitAndLoss({
      fromMonth: "2026-07", toMonth: "2026-08", today: "2026-09-11",
      orders: [], cashEntries: [], cashCategories: [], assets: [], assetDisposals: [], firstPaymentAt: null,
      ...data,
    });
    for (const m of computeIssuedMonthFigures(purchases, issues, "2026-07", "2026-08")) {
      const p = pnl.months.find(x => x.month === m.yearMonth)!;
      expect(m.costExact).toBeCloseTo(p.cogsExact, 6);
      expect(m.shrinkageExact).toBeCloseTo(p.shrinkageExact, 6);
    }
  });

  it("items over a range count only what left inside it", () => {
    const items = computeIssuedItemFigures(purchases, issues, new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T00:00:00Z"));
    expect(items).toHaveLength(1);
    expect(items[0].issuedQuantity).toBe(400);
    expect(items[0].issuedValueExact).toBeCloseTo(40_000, 6);
  });
});

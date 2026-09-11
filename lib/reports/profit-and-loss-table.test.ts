import { describe, expect, it } from "vitest";
import { PERCENT_DECIMALS, buildPnlTable, formatPercent, type PnlRow, type PnlTable } from "./profit-and-loss-table";
import type { PnlFigures, PnlMonthFigures } from "./profit-and-loss";

function monthFigures(month: string, overrides: Partial<PnlMonthFigures> = {}): PnlMonthFigures {
  return {
    month,
    posRevenue: 0, posOrderCount: 0, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 0, shrinkageExact: 0, nonInventoryExact: 0,
    expenseByCategory: {}, otherIncome: 0, depreciationExact: 0,
    ...overrides,
    sources: {
      manualRevenue: [], cogs: [], shrinkage: [], nonInventory: [], expense: {}, otherIncome: [], depreciation: [],
      ...overrides.sources,
    },
  };
}
function figures(months: PnlMonthFigures[], extra: Partial<PnlFigures> = {}): PnlFigures {
  return { year: 2026, months, expenseCategories: [], firstPaymentDate: "2026-07-20", ...extra };
}
function row(t: PnlTable, key: string): PnlRow {
  const found = t.rows.find(r => r.key === key);
  if (!found) throw new Error(`row ${key} not in table`);
  return found;
}
const values = (t: PnlTable, key: string) => row(t, key).cells.map(c => c.value);

const CATEGORIES = [
  { id: "CFC-001", name: "Vận hành" },
  { id: "CFC-002", name: "Điện, nước, gas" },
];

// August 2026, exact, as measured on the real server on 2026-09-11. Sources
// are trimmed to what the assertions read: this module shows sources, it
// does not add them up (scripts/verify-pnl-monthly.ts does).
function august(): PnlMonthFigures {
  return monthFigures("2026-08", {
    posRevenue: 17_682_000, posOrderCount: 644,
    cogsExact: 46_418_989.77485121,
    nonInventoryExact: 1_760_000,
    expenseByCategory: { "CFC-001": 615_000, "CFC-002": 470_000 },
    depreciationExact: 790_974.0694444443,
    sources: {
      manualRevenue: [], shrinkage: [], otherIncome: [], depreciation: [],
      cogs: [
        { kind: "STOCKTAKE", id: "STK-001", date: "2026-08-09", label: "Kiểm kê định kỳ", ref: null, amountExact: 34_864_626.83216999 },
      ],
      nonInventory: [
        { kind: "PO_LINE", id: "POL-d0228874-66d6-4e78-bef1-059b39ca423d", date: "2026-08-30", label: "Đá viên", ref: "PO-175", amountExact: 980_000 },
      ],
      expense: {
        "CFC-001": [
          { kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 300_000 },
          { kind: "CASH_ENTRY", id: "CE-025", date: "2026-08-26", label: "Photo giấy bán khoai trứng", ref: null, amountExact: 35_000 },
          { kind: "CASH_ENTRY", id: "CE-029", date: "2026-08-31", label: "Phin Đi - Gửi xe", ref: null, amountExact: 130_000 },
          { kind: "CASH_ENTRY", id: "CE-030", date: "2026-08-31", label: "Uchako - Gửi xe", ref: null, amountExact: 150_000 },
        ],
        "CFC-002": [
          { kind: "CASH_ENTRY", id: "CE-026", date: "2026-08-31", label: "Tiền gas", ref: null, amountExact: 250_000 },
          { kind: "CASH_ENTRY", id: "CE-027", date: "2026-08-31", label: "Tiền điện", ref: null, amountExact: 150_000 },
          { kind: "CASH_ENTRY", id: "CE-028", date: "2026-08-31", label: "Tiền nước sinh hoạt", ref: null, amountExact: 70_000 },
        ],
      },
    },
  });
}
const augustTable = () => buildPnlTable(figures([august()], { expenseCategories: CATEGORIES }), "2026-09-11");

describe("August 2026, real figures", () => {
  it("rounds each cell from its own exact value and computes profit from exact values", () => {
    const t = augustTable();
    expect(t.months).toEqual([{ month: "2026-08", label: "08/2026", shortLabel: "08" }]);
    expect(values(t, "revenue")).toEqual([17_682_000]);
    expect(values(t, "cogs")).toEqual([46_418_990]);
    expect(values(t, "nonInventory")).toEqual([1_760_000]);
    expect(values(t, "grossProfit")).toEqual([-30_496_990]);
    expect(values(t, "expense:CFC-001")).toEqual([615_000]);
    expect(values(t, "expense:CFC-002")).toEqual([470_000]);
    expect(values(t, "depreciation")).toEqual([790_974]);
    expect(values(t, "netProfit")).toEqual([-32_372_964]);
    expect(values(t, "margin")).toEqual([-183.08]);
    expect(values(t, "cumulative")).toEqual([-32_372_964]);
  });

  it("says how each profit cell was reached, in the numbers on screen", () => {
    const t = augustTable();
    expect(row(t, "grossProfit").cells[0].formula).toBe(
      "Doanh thu 17.682.000 − giá vốn 46.418.990 − nguyên liệu mua dùng ngay 1.760.000 = -30.496.990",
    );
    expect(row(t, "netProfit").cells[0].formula).toBe(
      "Lợi nhuận gộp -30.496.990 − chi phí 1.085.000 − khấu hao 790.974 = -32.372.964",
    );
    expect(row(t, "margin").cells[0].formula).toBe("Lợi nhuận ròng -32.372.964 ÷ doanh thu 17.682.000");
    expect(row(t, "cumulative").cells[0].formula).toBe(
      "Tháng đầu tiên có số của năm: bằng lợi nhuận ròng tháng này -32.372.964",
    );
    expect(row(t, "netProfit").cells[0].sources).toEqual([]);
  });

  it("lists what makes up a cell, rounded, with dates written the Vietnamese way", () => {
    const t = augustTable();
    expect(row(t, "revenue").cells[0].sources).toEqual([
      { kind: "POS", id: null, date: null, label: "644 đơn máy bán hàng", ref: null, amount: 17_682_000 },
    ]);
    expect(row(t, "expense:CFC-001").cells[0].sources.map(s => [s.date, s.label, s.amount])).toEqual([
      ["02/08/2026", "Dán lại xe Phin Đi", 300_000],
      ["26/08/2026", "Photo giấy bán khoai trứng", 35_000],
      ["31/08/2026", "Phin Đi - Gửi xe", 130_000],
      ["31/08/2026", "Uchako - Gửi xe", 150_000],
    ]);
    expect(row(t, "cogs").cells[0].sources[0]).toMatchObject({ kind: "STOCKTAKE", id: "STK-001", date: "09/08/2026", amount: 34_864_627 });
    expect(row(t, "nonInventory").cells[0].sources[0]).toMatchObject({ label: "Đá viên", ref: "PO-175", amount: 980_000 });
  });

  it("totals and share of revenue come from exact values", () => {
    const t = augustTable();
    expect(row(t, "cogs").total).toBe(46_418_990);
    expect(row(t, "cogs").shareOfRevenue).toBe(262.52); // 46.418.989,77 ÷ 17.682.000 = 262,521%
    expect(row(t, "revenue").shareOfRevenue).toBe(100);
    expect(row(t, "margin").total).toBe(-183.08);
    expect(row(t, "margin").shareOfRevenue).toBeNull();
    expect(row(t, "cumulative").total).toBeNull();
  });

  it("notes the stocktake inside cost of goods, and says nothing about rounding because nothing differs", () => {
    expect(augustTable().footnotes).toEqual([
      {
        key: "stocktake-STK-001-2026-08",
        text: "Giá vốn tháng 08/2026 có 34.864.627đ từ lần kiểm kho ngày 09/08/2026: hàng đã dùng mà chưa ghi phiếu xuất, không tính là hao hụt.",
      },
    ]);
  });
});

describe("rounding (BR-DATA-005)", () => {
  it("three months of 100,4 show 100 each and a total of 301, and the page says why", () => {
    const months = ["2025-01", "2025-02", "2025-03"].map(m => monthFigures(m, { depreciationExact: 100.4 }));
    const t = buildPnlTable(figures(months, { year: 2025 }), "2026-09-11");
    expect(values(t, "depreciation")).toEqual([100, 100, 100]);
    expect(row(t, "depreciation").total).toBe(301);
    expect(values(t, "netProfit")).toEqual([-100, -100, -100]);
    expect(row(t, "netProfit").total).toBe(-301);
    expect(values(t, "cumulative")).toEqual([-100, -201, -301]);
    expect(row(t, "cumulative").cells[1].formula).toBe(
      "Cộng dồn tháng trước -100 + lợi nhuận ròng tháng này -100 = -201",
    );
    expect(t.footnotes.map(f => f.key)).toEqual(["rounding"]);
    expect(t.footnotes[0].text).toContain("luật ngày 11/09/2026");
  });

  it("shows a percentage with two decimals (owner, 11/09/2026)", () => {
    expect(PERCENT_DECIMALS).toBe(2);
    expect(formatPercent(-183.08)).toBe("-183,08%");
    expect(formatPercent(13.8)).toBe("13,80%");
    expect(formatPercent(100)).toBe("100,00%");
    expect(formatPercent(null)).toBe("---");
  });
});

describe("which rows show", () => {
  it("leaves out the hand-recorded, shrinkage and other-income rows when the year has none", () => {
    expect(augustTable().rows.map(r => r.key)).toEqual([
      "revenue", "cogs", "nonInventory", "grossProfit", "expense:CFC-001", "expense:CFC-002",
      "depreciation", "netProfit", "margin", "cumulative",
    ]);
  });

  it("shows them, and folds them into profit, when the year has them", () => {
    const april = monthFigures("2026-04", {
      posRevenue: 2_190_000, posOrderCount: 53, manualRevenue: 8_411_868, shrinkageExact: 1_000, otherIncome: 200_000,
      sources: {
        manualRevenue: [
          { kind: "CASH_ENTRY", id: "CE-033", date: "2026-04-30", label: "Không có ghi chú", ref: null, amountExact: 5_000_000 },
          { kind: "CASH_ENTRY", id: "CE-034", date: "2026-04-30", label: "Không có ghi chú", ref: null, amountExact: 3_411_868 },
        ],
      } as PnlMonthFigures["sources"],
    });
    const t = buildPnlTable(figures([april]), "2026-09-11");
    expect(t.rows.map(r => r.key)).toEqual([
      "revenue", "revenueManual", "cogs", "nonInventory", "shrinkage", "grossProfit",
      "depreciation", "otherIncome", "netProfit", "margin", "cumulative",
    ]);
    expect(values(t, "revenue")).toEqual([10_601_868]);
    expect(row(t, "revenueManual").label).toBe("· trong đó ghi tay");
    expect(row(t, "revenue").cells[0].sources.map(s => s.label)).toEqual([
      "53 đơn máy bán hàng", "Không có ghi chú", "Không có ghi chú",
    ]);
    expect(row(t, "grossProfit").cells[0].formula).toBe(
      "Doanh thu 10.601.868 − giá vốn 0 − nguyên liệu mua dùng ngay 0 − hao hụt 1.000 = 10.600.868",
    );
    expect(row(t, "netProfit").cells[0].formula).toBe(
      "Lợi nhuận gộp 10.600.868 − chi phí 0 − khấu hao 0 + thu khác 200.000 = 10.800.868",
    );
    expect(t.footnotes).toContainEqual({
      key: "manual-2026-04",
      text: "Doanh thu tháng 04/2026 có 8.411.868đ ghi tay trong sổ thu chi, không qua máy bán hàng.",
    });
  });
});

describe("month labels", () => {
  it("marks the month still running with the day the figures reach", () => {
    const september = monthFigures("2026-09", { posRevenue: 5_054_000, posOrderCount: 213 });
    const t = buildPnlTable(figures([august(), september], { expenseCategories: CATEGORIES }), "2026-09-11");
    expect(t.months.map(m => m.label)).toEqual(["08/2026", "09/2026 (đến 11/09)"]);
    expect(t.periodLabel).toBe("từ đầu năm");
    const past = buildPnlTable(figures([monthFigures("2025-12", { depreciationExact: 1 })], { year: 2025 }), "2026-09-11");
    expect(past.periodLabel).toBe("cả năm");
  });
});

describe("summary and chart", () => {
  it("picks the best and the worst month from exact net profit", () => {
    const t = buildPnlTable(figures([
      monthFigures("2026-05", { posRevenue: 7_675_000, posOrderCount: 302 }),
      august(),
      monthFigures("2026-09", { posRevenue: 5_054_000, posOrderCount: 213 }),
    ], { expenseCategories: CATEGORIES }), "2026-09-11");
    expect(t.summary.revenue).toBe(30_411_000);
    // 7.675.000 − 32.372.963,84 + 5.054.000
    expect(t.summary.netProfit).toBe(-19_643_964);
    expect(t.summary.bestMonth).toEqual({ month: "2026-05", label: "05/2026", netProfit: 7_675_000 });
    expect(t.summary.worstMonth).toEqual({ month: "2026-08", label: "08/2026", netProfit: -32_372_964 });
    expect(t.chart).toEqual([
      { month: "2026-05", shortLabel: "05", netProfit: 7_675_000, cumulative: 7_675_000 },
      { month: "2026-08", shortLabel: "08", netProfit: -32_372_964, cumulative: -24_697_964 },
      { month: "2026-09", shortLabel: "09", netProfit: 5_054_000, cumulative: -19_643_964 },
    ]);
  });

  it("has no worst month when no month lost money", () => {
    const t = buildPnlTable(figures([monthFigures("2026-05", { posRevenue: 7_675_000, posOrderCount: 302 })]), "2026-09-11");
    expect(t.summary.worstMonth).toBeNull();
  });

  it("leaves margin empty for a month with no revenue", () => {
    const t = buildPnlTable(figures([monthFigures("2026-03", { depreciationExact: 49_225.708333333336 })]), "2026-09-11");
    expect(values(t, "margin")).toEqual([null]);
    expect(row(t, "margin").cells[0].formula).toBe("Tháng này chưa có doanh thu, nên không tính được biên lợi nhuận.");
    expect(row(t, "margin").total).toBeNull();
    expect(values(t, "netProfit")).toEqual([-49_226]);
    expect(t.summary.margin).toBeNull();
  });

  it("an empty year gives an empty table", () => {
    const t = buildPnlTable(figures([]), "2026-09-11");
    expect(t.months).toEqual([]);
    expect(t.chart).toEqual([]);
    expect(t.footnotes).toEqual([]);
    expect(t.summary).toEqual({ revenue: 0, netProfit: 0, margin: null, bestMonth: null, worstMonth: null });
  });
});

describe("BR-SALE-005 footnote", () => {
  it("names the months with sales from before the first payment record", () => {
    const t = buildPnlTable(figures([
      monthFigures("2026-06", { posRevenue: 22_157_000, posOrderCount: 793, posRevenueBeforePayments: 22_157_000 }),
      monthFigures("2026-07", { posRevenue: 18_661_000, posOrderCount: 664, posRevenueBeforePayments: 12_215_000 }),
      monthFigures("2026-08", { posRevenue: 17_682_000, posOrderCount: 644 }),
    ]), "2026-09-11");
    expect(t.footnotes).toContainEqual({
      key: "before-payments",
      text: "Doanh thu tháng 06/2026, 07/2026 có phần bán trước ngày 20/07/2026, ngày bắt đầu có sổ tiền nhận, nên phần đó không có sổ tiền để đối chiếu.",
    });
  });
});

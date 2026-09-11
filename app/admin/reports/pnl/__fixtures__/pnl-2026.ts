import type { PnlFigures, PnlMonthFigures } from "@/lib/reports/profit-and-loss";

// March, August and September 2026, exact, as measured on the real server on
// 2026-09-11 (plan "Ví dụ bằng số thật"). April to July are left out to keep
// the fixture short; the screen does not care which months it gets. Sources
// are trimmed to what the screen tests read -- August's Vận hành carries all
// four of its real cash-book rows.
export function monthFigures(month: string, overrides: Partial<PnlMonthFigures> = {}): PnlMonthFigures {
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

export function pnlFigures2026(): PnlFigures {
  return {
    year: 2026,
    expenseCategories: [
      { id: "CFC-001", name: "Vận hành" },
      { id: "CFC-002", name: "Điện, nước, gas" },
    ],
    firstPaymentDate: "2026-07-20",
    months: [
      monthFigures("2026-03", { depreciationExact: 49_225.708333333336 }),
      monthFigures("2026-08", {
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
      }),
      monthFigures("2026-09", {
        posRevenue: 5_054_000, posOrderCount: 213,
        cogsExact: 1_678_673.4011654996,
        nonInventoryExact: 360_000,
        expenseByCategory: { "CFC-001": 1_057_000, "CFC-002": 470_000 },
        depreciationExact: 790_974.0694444443,
      }),
    ],
  };
}

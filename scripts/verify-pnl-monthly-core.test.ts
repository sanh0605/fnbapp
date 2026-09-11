import { describe, expect, it } from "vitest";
import { checkPnlMonth } from "./verify-pnl-monthly-core";
import type { PnlMonthFigures } from "@/lib/reports/profit-and-loss";

function augustLike(): PnlMonthFigures {
  return {
    month: "2026-08",
    posRevenue: 17_682_000, posOrderCount: 644, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 46_418_989.6, shrinkageExact: 0, nonInventoryExact: 1_760_000,
    expenseByCategory: { "CFC-001": 615_000 }, otherIncome: 0, depreciationExact: 790_978,
    sources: {
      manualRevenue: [],
      cogs: [
        { kind: "STOCKTAKE", id: "STK-001", date: "2026-08-09", label: "Kiểm kê định kỳ", ref: null, amountExact: 34_864_626.6 },
        { kind: "ISSUE_SLIP", id: "ISL-00010", date: "2026-08-12", label: "Phiếu xuất: Pha chế", ref: null, amountExact: 11_554_363 },
      ],
      shrinkage: [],
      nonInventory: [{ kind: "PO_LINE", id: "POL-d0228874-66d6-4e78-bef1-059b39ca423d", date: "2026-08-30", label: "Đá viên", ref: "PO-175", amountExact: 1_760_000 }],
      expense: { "CFC-001": [{ kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 615_000 }] },
      otherIncome: [],
      depreciation: [{ kind: "ASSET", id: "TS-001", date: null, label: "Máy xay", ref: null, amountExact: 790_978 }],
    },
  };
}
const reference = { totalRevenue: 17_682_000, totalCOGS: 46_418_990, shrinkageValue: 0 };

describe("checkPnlMonth", () => {
  it("finds nothing wrong when the month agrees with getPnLDataV2 and with its own sources", () => {
    expect(checkPnlMonth(augustLike(), reference)).toEqual([]);
  });

  it("names a revenue mismatch", () => {
    const problems = checkPnlMonth(augustLike(), { ...reference, totalRevenue: 17_681_000 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("revenue");
  });

  it("names a cost-of-goods mismatch", () => {
    const problems = checkPnlMonth(augustLike(), { ...reference, totalCOGS: 46_418_991 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("totalCOGS");
  });

  it("names a line whose sources do not add up to it", () => {
    const month = augustLike();
    month.sources.cogs.pop();
    const problems = checkPnlMonth(month, reference);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("cogs");
  });
});

import { describe, it, expect } from "vitest";
import {
  CLEARABLE_ISSUE_NOTES,
  selectIssueSlipsToClear,
  selectStockIssuesToClear,
  summarizeAfterClear,
} from "./clear-issue-slip-notes-core";

describe("selectIssueSlipsToClear", () => {
  it("picks every slip whose note has text, skips empty and whitespace-only notes", () => {
    const slips = [
      { id: "ISL-1", note: "Khác" },
      { id: "ISL-2", note: "Hao hụt / hư hỏng" },
      { id: "ISL-3", note: "" },
      { id: "ISL-4", note: "   " },
      { id: "ISL-5", note: null },
    ];
    expect(selectIssueSlipsToClear(slips).map(s => s.id)).toEqual(["ISL-1", "ISL-2"]);
  });
});

describe("selectStockIssuesToClear", () => {
  const base = { purchased_item_id: "X", base_quantity: 1 };
  it("picks only MANUAL, non-return rows whose note is one of the two old reasons", () => {
    const rows = [
      { ...base, id: "A", source: "MANUAL", reverses_issue_id: null, note: "Khác" },
      { ...base, id: "B", source: "MANUAL", reverses_issue_id: null, note: "Hao hụt / hư hỏng" },
      // return row: carries the cancel reason, must never be touched
      { ...base, id: "C", source: "MANUAL", reverses_issue_id: "A", note: "Đảo phiếu ISS-00120 (ghi nhầm) -- Huỷ cả phiếu ISL-00042 -- " },
      // a return row whose note happens to equal an old reason is still protected
      { ...base, id: "D", source: "MANUAL", reverses_issue_id: "A", note: "Khác" },
      // stocktake rows are out of scope
      { ...base, id: "E", source: "STOCKTAKE", reverses_issue_id: null, note: "Khác" },
      // free-text MANUAL note that is not one of the two reasons is left alone
      { ...base, id: "F", source: "MANUAL", reverses_issue_id: null, note: "Pha chế" },
      { ...base, id: "G", source: "MANUAL", reverses_issue_id: null, note: "" },
    ];
    expect(selectStockIssuesToClear(rows).map(r => r.id)).toEqual(["A", "B"]);
    expect([...CLEARABLE_ISSUE_NOTES]).toEqual(["Khác", "Hao hụt / hư hỏng"]);
  });
});

describe("summarizeAfterClear", () => {
  it("counts leftover notes over the real denominators and checks return rows kept their notes", () => {
    const slips = [{ id: "ISL-1", note: "" }, { id: "ISL-2", note: "" }];
    const issues = [
      { id: "A", source: "MANUAL", reverses_issue_id: null, note: "" },
      { id: "C", source: "MANUAL", reverses_issue_id: "A", note: "Đảo phiếu" },
      { id: "D", source: "MANUAL", reverses_issue_id: "A", note: "" },
    ];
    expect(summarizeAfterClear(slips, issues)).toEqual({
      slipsTotal: 2,
      slipsWithNote: 0,
      manualNonReturnTotal: 1,
      manualNonReturnWithOldReason: 0,
      returnRowsTotal: 2,
      returnRowsWithNote: 1,
    });
  });
});

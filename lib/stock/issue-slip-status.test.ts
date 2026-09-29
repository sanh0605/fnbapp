import { describe, expect, it } from "vitest";
import {
  activeSlipLines, parseCancelReason, reversedIssueIds, slipCancellation, stocktakeLock,
  type IssueRowRecord, type StocktakeSessionRecord,
} from "./issue-slip-status";

const row = (over: Partial<IssueRowRecord>): IssueRowRecord => ({
  id: "X", purchased_item_id: "SPM-067", issued_at: "2026-07-09T14:49:00Z", base_quantity: 454,
  source: "MANUAL", session_id: null, note: null, created_at: null, reverses_issue_id: null, issue_slip_id: null, ...over,
});
// Real shape of ISL-00041, measured 2026-09-29.
const isl41 = [
  row({ id: "ISS-00119", issue_slip_id: "ISL-00041", note: "Hao hụt / hư hỏng" }),
  row({ id: "ISS-00122", issued_at: "2026-09-01T19:25:45.301036+00:00", base_quantity: -454, reverses_issue_id: "ISS-00119",
    note: "Đảo phiếu ISS-00119 (ghi nhầm) -- Huỷ cả phiếu ISL-00041 -- Test" }),
];
const stk001: StocktakeSessionRecord = { id: "STK-001", status: "CONFIRMED", confirmed_at: "2026-08-09T15:02:00Z", confirmed_by_name: "admin" };

describe("issue slip status", () => {
  it("reads the cancel reason written by cancel_issue_slip_atomic", () => {
    expect(parseCancelReason(isl41[1].note)).toBe("Test");
    expect(parseCancelReason("Đảo phiếu ISS-00001 (ghi nhầm)")).toBe("");
    expect(parseCancelReason(null)).toBe("");
  });

  it("reads the cancel reason when the note is stored in decomposed (NFD) form", () => {
    expect(parseCancelReason("Đảo phiếu -- Huỷ cả phiếu ISL-00041 -- Test".normalize("NFD"))).toBe("Test");
  });

  it("a slip with every line returned is cancelled, dated by its return", () => {
    const reversed = reversedIssueIds(isl41);
    expect(activeSlipLines("ISL-00041", isl41, reversed)).toEqual([]);
    expect(slipCancellation("ISL-00041", isl41, reversed)).toEqual({ at: "2026-09-01T19:25:45.301036+00:00", reason: "Test" });
  });

  it("a slip with one line still active is not cancelled", () => {
    const rows = [...isl41, row({ id: "ISS-00200", issue_slip_id: "ISL-00041" })];
    expect(slipCancellation("ISL-00041", rows, reversedIssueIds(rows))).toBeNull();
  });

  it("locks a slip dated on or before the latest confirmed stocktake", () => {
    expect(stocktakeLock("2026-07-09T14:49:00Z", [stk001])).toEqual({ sessionId: "STK-001", confirmedAt: "2026-08-09T15:02:00Z" });
    expect(stocktakeLock("2026-08-09T15:02:00Z", [stk001])).not.toBeNull();
    expect(stocktakeLock("2026-09-28T11:20:00Z", [stk001])).toBeNull();
  });

  it("an undone stocktake locks nothing", () => {
    expect(stocktakeLock("2026-07-09T14:49:00Z", [{ ...stk001, status: "REVERSED" }])).toBeNull();
  });
});

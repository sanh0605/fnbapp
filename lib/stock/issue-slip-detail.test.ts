import { describe, expect, it } from "vitest";
import { buildIssueSlipDetail } from "./issue-slip-detail";
import type { IssueRowRecord } from "./issue-slip-status";

const base = { source: "MANUAL", session_id: null, note: "Khác", created_at: null, reverses_issue_id: null } as const;
const slip = { id: "ISL-00076", issued_at: "2026-09-28T11:20:00Z", note: "Khác", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:21:58Z" };
const issues: IssueRowRecord[] = [
  { ...base, id: "ISS-00192", purchased_item_id: "SPM-038", issued_at: slip.issued_at, base_quantity: 2000, issue_slip_id: "ISL-00076" },
  { ...base, id: "ISS-00196", purchased_item_id: "SPM-070", issued_at: slip.issued_at, base_quantity: 1, issue_slip_id: "ISL-00076" },
];
const input = {
  slip, issues, sessions: [{ id: "STK-001", status: "CONFIRMED", confirmed_at: "2026-08-09T15:02:00Z", confirmed_by_name: "admin" }],
  items: [{ id: "SPM-038", name: "Sữa yến mạch Oatside" }, { id: "SPM-070", name: "Giấy lót chống tràn" }],
  baseUnitNameByItem: new Map([["SPM-038", "ml"], ["SPM-070", "Xấp"]]),
  packageLinesByItem: new Map([
    ["SPM-038", [{ conversionId: "QD-044", purchasedItemId: "SPM-038", purchasedItemName: "Sữa yến mạch Oatside", sizeLabel: "Hộp 1.000 ml", conversionRate: 1000, baseUnitName: "ml", purchasedUnitName: "Hộp" }]],
    ["SPM-070", [{ conversionId: "QD-080", purchasedItemId: "SPM-070", purchasedItemName: "Giấy lót chống tràn", sizeLabel: "Xấp 1 Xấp", conversionRate: 1, baseUnitName: "Xấp", purchasedUnitName: "Xấp" }]],
  ]),
  lineValues: new Map([["ISS-00192", 73606.1633], ["ISS-00196", 36404.6]]),
  unitCostByItem: { "SPM-038": 36.8030816 },
};

describe("buildIssueSlipDetail", () => {
  it("carries the unit cost map through untouched", () => {
    expect(buildIssueSlipDetail(input).unitCostByItem).toEqual({ "SPM-038": 36.8030816 });
  });

  it("ISL-00076: lines, values, editable", () => {
    const d = buildIssueSlipDetail(input);
    expect(d.lines.map(l => [l.name, l.quantityText, l.value])).toEqual([
      ["Sữa yến mạch Oatside", "2 Hộp (2,000 ml)", 73606], ["Giấy lót chống tràn", "1 Xấp", 36405]]);
    expect(d).toMatchObject({ totalValue: 110011, canEdit: true, cancellation: null, lock: null, createdByName: "tuyen2612" });
  });

  it("a slip dated before STK-001 is locked, not editable", () => {
    const d = buildIssueSlipDetail({ ...input, slip: { ...slip, issued_at: "2026-07-09T14:49:00Z" } });
    expect(d.lock).toMatchObject({ sessionId: "STK-001", dateText: "09/08/2026" });
    expect(d.canEdit).toBe(false);
  });

  it("a returned line is not shown", () => {
    const d = buildIssueSlipDetail({ ...input, issues: [...issues,
      { ...base, id: "ISS-00300", purchased_item_id: "SPM-070", issued_at: "2026-09-30T02:00:00Z", base_quantity: -1, issue_slip_id: null, reverses_issue_id: "ISS-00196" }] });
    expect(d.lines.map(l => l.issueId)).toEqual(["ISS-00192"]);
    expect(d.totalValue).toBe(73606);
  });
});

import { describe, expect, it } from "vitest";
import { diffIssueSlipEdit } from "./issue-slip-edit-diff";

const original = [
  { issueId: "ISS-00192", purchasedItemId: "SPM-038", baseQuantity: 2000 },
  { issueId: "ISS-00196", purchasedItemId: "SPM-070", baseQuantity: 1 },
];
const keep = original.map(l => ({ ...l, removed: false }));

describe("diffIssueSlipEdit", () => {
  it("spec example: drop Giấy lót, Oatside 2000 → 1000", () => {
    expect(diffIssueSlipEdit(original, [
      { ...keep[0], baseQuantity: 1000 }, { ...keep[1], removed: true },
    ])).toEqual({ ok: true, removeIssueIds: ["ISS-00196"], replaceIssueIds: ["ISS-00192"], addLines: [{ purchasedItemId: "SPM-038", baseQuantity: 1000 }] });
  });

  it("adds a new line and ignores an empty added row", () => {
    const d = diffIssueSlipEdit(original, [...keep,
      { issueId: null, purchasedItemId: "SPM-012", baseQuantity: 1000, removed: false },
      { issueId: null, purchasedItemId: "", baseQuantity: 0, removed: false }]);
    expect(d).toEqual({ ok: true, removeIssueIds: [], replaceIssueIds: [], addLines: [{ purchasedItemId: "SPM-012", baseQuantity: 1000 }] });
  });

  it("refuses zero, an emptied slip, no change, and a foreign line", () => {
    expect(diffIssueSlipEdit(original, [{ ...keep[0], baseQuantity: 0 }, keep[1]])).toEqual({ ok: false, error: "Dòng 1: số lượng phải lớn hơn 0" });
    expect(diffIssueSlipEdit(original, keep.map(l => ({ ...l, removed: true })))).toEqual({ ok: false, error: "Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết." });
    expect(diffIssueSlipEdit(original, keep)).toEqual({ ok: false, error: "Chưa có thay đổi nào." });
    expect(diffIssueSlipEdit(original, [...keep, { issueId: "ISS-99999", purchasedItemId: "SPM-038", baseQuantity: 1, removed: false }]))
      .toEqual({ ok: false, error: "Dòng không thuộc phiếu này. Tải lại trang rồi sửa lại." });
  });
});

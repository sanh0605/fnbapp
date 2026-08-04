import { describe, it, expect } from "vitest";
import { computeIssueCosting } from "@/lib/issue-costing";

describe("computeIssueCosting", () => {
  // Chủ quán chốt 2026-08-02, ví dụ của chính anh, mở rộng ở spec mục 1.
  it("giá vốn theo bình quân tại lúc xuất", () => {
    const [row] = computeIssueCosting(
      [
        { purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 10, subtotal: 100 },
        { purchased_item_id: "SPM-X", at: "2026-08-05T00:00:00Z", base_quantity: 10, subtotal: 120 },
      ],
      [
        { purchased_item_id: "SPM-X", at: "2026-08-02T01:00:00Z", base_quantity: 2, source: "STOCKTAKE" },
        { purchased_item_id: "SPM-X", at: "2026-08-07T00:00:00Z", base_quantity: 3, source: "STOCKTAKE" },
      ],
    );

    // 02/08: 10 túi, bình quân 10,00 -> xuất 2 = 20,00
    // 05/08: còn 8 (=80đ) + 10 (=120đ) = 18 túi / 200đ -> bình quân 11,111...
    // 07/08: xuất 3 = 33,333...
    expect(row.issued_quantity).toBe(5);
    expect(row.issued_value).toBeCloseTo(53.333333, 4);
    expect(row.closing_quantity).toBe(15);
    expect(row.closing_value).toBeCloseTo(166.666667, 4);
  });

  it("xuất trước khi nhập thì báo lỗi, không âm thầm cho giá 0", () => {
    expect(() => computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "2026-08-05T00:00:00Z", base_quantity: 10, subtotal: 100 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" }],
    )).toThrow(/SPM-X/);
  });

  it("xuất nhiều hơn tồn thì báo lỗi", () => {
    expect(() => computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "2026-08-01T00:00:00Z", base_quantity: 5, subtotal: 50 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 6, source: "STOCKTAKE" }],
    )).toThrow(/SPM-X/);
  });

  it("hai mặt hàng không trộn giá vào nhau", () => {
    const rows = computeIssueCosting(
      [
        { purchased_item_id: "SPM-A", at: "2026-08-01T00:00:00Z", base_quantity: 10, subtotal: 100 },
        { purchased_item_id: "SPM-B", at: "2026-08-01T00:00:00Z", base_quantity: 10, subtotal: 500 },
      ],
      [
        { purchased_item_id: "SPM-A", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" },
        { purchased_item_id: "SPM-B", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" },
      ],
    );
    expect(rows.find(r => r.purchased_item_id === "SPM-A")!.issued_value).toBeCloseTo(10, 6);
    expect(rows.find(r => r.purchased_item_id === "SPM-B")!.issued_value).toBeCloseTo(50, 6);
  });

  it("không làm tròn giữa chừng", () => {
    const [row] = computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "2026-08-01T00:00:00Z", base_quantity: 3, subtotal: 10 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" }],
    );
    expect(row.issued_value).toBeCloseTo(3.333333, 6);
  });
});

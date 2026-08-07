import { describe, it, expect } from "vitest";
import { computeIssueCosting, computePeriodIssuedValue, type Purchase, type Issue } from "@/lib/issue-costing";

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

  it("mốc thời gian không dùng được thì báo lỗi, không sắp xếp mù", () => {
    expect(() => computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "", base_quantity: 10, subtotal: 100 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" }],
    )).toThrow(/SPM-X/);
  });

  it("nhập tiền mà không có số lượng thì báo lỗi, không thổi bình quân", () => {
    expect(() => computeIssueCosting(
      [
        { purchased_item_id: "SPM-X", at: "2026-08-01T00:00:00Z", base_quantity: 0, subtotal: 100000 },
        { purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 10, subtotal: 120000 },
      ],
      [],
    )).toThrow(/SPM-X/);
  });

  it("dòng nhập cả số lượng lẫn tiền đều 0 thì cho qua, không báo lỗi", () => {
    const [row] = computeIssueCosting(
      [
        { purchased_item_id: "SPM-X", at: "2026-08-01T00:00:00Z", base_quantity: 0, subtotal: 0 },
        { purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 10, subtotal: 100 },
      ],
      [],
    );
    expect(row.closing_quantity).toBe(10);
    expect(row.closing_value).toBe(100);
  });
});

describe("computePeriodIssuedValue", () => {
  // Plan C Task 2: computeIssueCosting returns a cumulative total, not a
  // per-period one. A month's figure is the difference of two full replays
  // (through-end minus before-start), both fed the SAME complete purchase
  // set -- passing a narrower purchase set to either run would silently
  // invalidate the subtraction while still returning a plausible number.
  const purchases: Purchase[] = [
    { purchased_item_id: "SPM-X", at: "2026-06-01T00:00:00Z", base_quantity: 10, subtotal: 100 },
    { purchased_item_id: "SPM-X", at: "2026-07-10T00:00:00Z", base_quantity: 10, subtotal: 140 },
  ];

  it("returns only the period's own contribution, not the running total", () => {
    const issues: Issue[] = [
      { purchased_item_id: "SPM-X", at: "2026-06-15T00:00:00Z", base_quantity: 2, source: "STOCKTAKE" },
      { purchased_item_id: "SPM-X", at: "2026-07-20T00:00:00Z", base_quantity: 3, source: "STOCKTAKE" },
    ];

    // June alone: 2 units at 10.00/unit (only the first purchase exists yet) = 20.
    const june = computePeriodIssuedValue(
      purchases,
      issues,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-30T23:59:59.999Z"),
    );
    expect(june).toBeCloseTo(20, 6);

    // July alone: stock going in is 8 (=80) + 10 (=140) = 18 units / 220 ->
    // avg 12.2222..., issuing 3 = 36.6666... This is NOT the cumulative
    // total through July (20 + 36.6666... = 56.6666...) -- proving the
    // subtraction isolates July rather than accumulating June into it.
    const july = computePeriodIssuedValue(
      purchases,
      issues,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-07-31T23:59:59.999Z"),
    );
    expect(july).toBeCloseTo(36.666667, 4);
  });

  it("months sum to exactly one whole-period run -- only meaningful with real non-zero issues", () => {
    // Before the first stocktake, every period is 0đ and 0 === 0 proves
    // nothing about the subtraction being correct. This fixture uses three
    // months of real, distinct, non-zero issues so the invariant actually
    // gets exercised.
    const issues: Issue[] = [
      { purchased_item_id: "SPM-X", at: "2026-06-10T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" },
      { purchased_item_id: "SPM-X", at: "2026-07-15T00:00:00Z", base_quantity: 4, source: "STOCKTAKE" },
      { purchased_item_id: "SPM-X", at: "2026-08-05T00:00:00Z", base_quantity: 2, source: "STOCKTAKE" },
    ];
    expect(issues.every(i => i.base_quantity > 0)).toBe(true);

    const june = computePeriodIssuedValue(purchases, issues, new Date("2026-06-01T00:00:00Z"), new Date("2026-06-30T23:59:59.999Z"));
    const july = computePeriodIssuedValue(purchases, issues, new Date("2026-07-01T00:00:00Z"), new Date("2026-07-31T23:59:59.999Z"));
    const august = computePeriodIssuedValue(purchases, issues, new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T23:59:59.999Z"));
    const wholePeriod = computePeriodIssuedValue(purchases, issues, null, new Date("2026-08-31T23:59:59.999Z"));

    expect(june + july + august).toBeCloseTo(wholePeriod, 9);
    // Guard against the false-green shape: if this were 0, the assertion
    // above would pass trivially without proving anything.
    expect(wholePeriod).toBeGreaterThan(0);
  });

  it("returns 0 when no issues exist yet, and says so honestly rather than throwing", () => {
    const result = computePeriodIssuedValue(purchases, [], new Date("2026-06-01T00:00:00Z"), new Date("2026-06-30T23:59:59.999Z"));
    expect(result).toBe(0);
  });
});

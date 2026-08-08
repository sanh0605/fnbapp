import { describe, it, expect } from "vitest";
import { allocatePurchaseOrderCost } from "@/lib/purchase-order-cost-allocation";

describe("allocatePurchaseOrderCost", () => {
  // BR-COGS-006's own worked example, PO-031 (2026-06-12): a single line so
  // the arithmetic is visible with nothing else to attribute it to.
  it("PO-031: 3.140.000đ line, +57.200 ship -722.200 voucher -57.200 discount = 2.417.800đ paid", () => {
    const result = allocatePurchaseOrderCost(
      [{ lineId: "POL-1", subtotal: 3_140_000 }],
      57_200, // additions: shipping + tax (tax was 0 on this order)
      722_200 + 57_200, // subtractions: voucher + discount
    );
    expect(result.get("POL-1")).toBe(2_417_800);
    // 2.417.800 / 10.000 g = 241,78 đ/g -- the rate BR-COGS-006 names directly.
    expect(result.get("POL-1")! / 10_000).toBeCloseTo(241.78, 6);
  });

  // PO-059 (2026-07-28), real 3-line order: the case that actually matters
  // -- the owner asked for it spelled out because the single-line PO-031
  // hides the only hard part (multiple lines sharing one adjustment).
  it("PO-059: 3 real lines, +64.400 ship -610.800 voucher, reconciles to 2.868.600đ exactly with 0 residue", () => {
    const result = allocatePurchaseOrderCost(
      [
        { lineId: "Robusta", subtotal: 3_140_000 },
        { lineId: "PhaPhin", subtotal: 183_000 },
        { lineId: "PhinDam", subtotal: 92_000 },
      ],
      64_400,
      610_800,
    );
    expect(result.get("Robusta")).toBe(2_637_600);
    expect(result.get("PhaPhin")).toBe(153_720);
    expect(result.get("PhinDam")).toBe(77_280);
    // Rates: 263,76 / 307,44 / 154,56 đ/g against 314 / 366 / 184 today -- all 16% high.
    expect(result.get("Robusta")! / 10_000).toBeCloseTo(263.76, 6);
    expect(result.get("PhaPhin")! / 500).toBeCloseTo(307.44, 6);
    expect(result.get("PhinDam")! / 500).toBeCloseTo(154.56, 6);
    const total = (result.get("Robusta") ?? 0) + (result.get("PhaPhin") ?? 0) + (result.get("PhinDam") ?? 0);
    expect(total).toBe(2_868_600);
  });

  // PO-056 (2026-08-?), the one real order (of 20 carrying a header charge)
  // where the adjustment is POSITIVE: shipping with no voucher or discount.
  // Every other real order is negative -- this is the case that proves the
  // method works for either sign, not assumed from the discount-shaped cases.
  it("PO-056: +40.000đ shipping only (no voucher) -- cost INCREASES, not decreases", () => {
    const lines = [
      { lineId: "ThachDua", subtotal: 15_000 },
      { lineId: "QuytNgam", subtotal: 37_000 },
      { lineId: "SiroMama", subtotal: 57_000 },
      { lineId: "SiroGolden", subtotal: 62_000 },
    ];
    const result = allocatePurchaseOrderCost(lines, 40_000, 0);

    for (const line of lines) {
      expect(result.get(line.lineId)!).toBeGreaterThan(line.subtotal);
    }
    const total = lines.reduce((s, l) => s + (result.get(l.lineId) ?? 0), 0);
    expect(total).toBe(171_000 + 40_000);
  });

  it("reconciles exactly (BR-COGS-003) even when independent rounding would not sum to the target: adj=100 split across 3 equal lines, residue goes to the largest (first-tied) line", () => {
    const lines = [
      { lineId: "A", subtotal: 100 },
      { lineId: "B", subtotal: 100 },
      { lineId: "C", subtotal: 100 },
    ];
    // Each line's independent share is round(100 * 100/300) = round(33.33) = 33,
    // summing to 99 -- one short of the 100 target. The guard must place the
    // missing 1 somewhere, and does so on the first of the tied-largest lines.
    const result = allocatePurchaseOrderCost(lines, 100, 0);
    expect(result.get("A")).toBe(134); // 100 + 33 + 1 (residue)
    expect(result.get("B")).toBe(133);
    expect(result.get("C")).toBe(133);
    const total = lines.reduce((s, l) => s + (result.get(l.lineId) ?? 0), 0);
    expect(total).toBe(300 + 100);
  });

  it("an order with no shipping, voucher, discount, or tax leaves every line's subtotal unchanged", () => {
    const lines = [
      { lineId: "POL-1", subtotal: 500_000 },
      { lineId: "POL-2", subtotal: 250_000 },
    ];
    const result = allocatePurchaseOrderCost(lines, 0, 0);
    expect(result.get("POL-1")).toBe(500_000);
    expect(result.get("POL-2")).toBe(250_000);
  });
});

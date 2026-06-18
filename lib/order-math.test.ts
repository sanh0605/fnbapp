import { describe, it, expect } from "vitest";
import { allocateOrderDiscount, allocateLineRevenue } from "@/lib/order-math";
import type { AllocatableLine } from "@/lib/order-types";
import { makeUCK000094Order } from "@/lib/__tests__/fixtures";

describe("allocateOrderDiscount", () => {
  it("returns zero allocations when order discount is 0", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 30000 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 0);
    expect(result.get("L1")).toBe(0);
    expect(result.get("L2")).toBe(0);
  });

  it("returns zero allocations when total capacity is 0", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 0 },
      { line_id: "L2", capacity: 0 },
    ];
    const result = allocateOrderDiscount(lines, 5000);
    expect(result.get("L1")).toBe(0);
    expect(result.get("L2")).toBe(0);
  });

  it("allocates proportionally when discount fits within capacity", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 30000 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 10000);
    // L1 share: 10000 * 30/50 = 6000
    // L2 share: 10000 * 20/50 = 4000
    expect(result.get("L1")).toBe(6000);
    expect(result.get("L2")).toBe(4000);
  });

  it("sum of allocations equals order discount exactly (no rounding loss)", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 100 },
      { line_id: "L2", capacity: 100 },
      { line_id: "L3", capacity: 100 },
    ];
    const result = allocateOrderDiscount(lines, 100);
    const sum = (result.get("L1") || 0) + (result.get("L2") || 0) + (result.get("L3") || 0);
    expect(sum).toBe(100);
  });

  it("caps each allocation at line capacity when discount exceeds total capacity", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 5000 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 50000);
    expect(result.get("L1")).toBe(5000);
    expect(result.get("L2")).toBe(20000);
    const sum = (result.get("L1") || 0) + (result.get("L2") || 0);
    expect(sum).toBe(25000);
  });

  it("skips lines with zero capacity", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 0 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 5000);
    expect(result.get("L1")).toBe(0);
    expect(result.get("L2")).toBe(5000);
  });

  it("handles empty lines array", () => {
    const result = allocateOrderDiscount([], 5000);
    expect(result.size).toBe(0);
  });

  it("allocates correctly for UCK000094 fixture", () => {
    const { order, lines } = makeUCK000094Order();
    
    // Map fixture lines to AllocatableLine using capacity = gross - promo - manual_item
    const allocatableLines: AllocatableLine[] = lines.map(l => ({
      line_id: l.id,
      capacity: l.gross_line_total - l.promo_discount - l.manual_item_discount
    }));

    // Sữa Dâu: capacity = 35000 - 10000 = 25000
    // Hồng Trà: capacity = 30000 - 0 = 30000
    // Total capacity = 55000
    // Order discount = 5000
    // Sữa Dâu share: round(5000 * 25000 / 55000) = 2273
    // Hồng Trà share: 5000 - 2273 = 2727

    const result = allocateOrderDiscount(allocatableLines, order.manual_order_discount);

    // Using the exact IDs from the fixture
    expect(result.get("ol-uck000094-1")).toBe(2273); // Sữa Dâu
    expect(result.get("ol-uck000094-2")).toBe(2727); // Hồng Trà
    
    // Verify sum equals order discount
    const sum = (result.get("ol-uck000094-1") || 0) + (result.get("ol-uck000094-2") || 0);
    expect(sum).toBe(5000);
  });
});

describe("allocateLineRevenue", () => {
  it("returns gross when no discounts applied", () => {
    const line: LineForAllocation = {
      unit_price: 30000,
      qty: 2,
      modifiers: [],
      gross_line_total: 60000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(60000);
    expect(result.modifierRevenue).toEqual({});
    expect(result.lineRevenue).toBe(60000);
  });

  it("applies a single ratio across variant and modifiers", () => {
    // gross = 80000 (variant 60k + modifiers 20k), discount 20000 → ratio 0.75
    const line: LineForAllocation = {
      unit_price: 30000,
      qty: 2,
      modifiers: [
        { id: "MOD-ICE", name: "Đá", price: 0, qty: 1 },
        { id: "MOD-SUGAR", name: "Đường", price: 2000, qty: 1 },
        { id: "MOD-CHEESE", name: "Phô mai", price: 8000, qty: 1 },
      ],
      gross_line_total: 80000,
      promo_discount: 20000,
      manual_item_discount: 0,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(45000); // 60000 * 0.75
    expect(result.modifierRevenue["MOD-ICE"]).toBe(0); // 0 * 0.75
    expect(result.modifierRevenue["MOD-SUGAR"]).toBe(3000); // 4000 * 0.75
    expect(result.modifierRevenue["MOD-CHEESE"]).toBe(12000); // 16000 * 0.75
    expect(result.lineRevenue).toBe(60000); // 80000 - 20000
  });

  it("lineRevenue equals stored net (gross - all discounts)", () => {
    const line: LineForAllocation = {
      unit_price: 35000,
      qty: 1,
      modifiers: [],
      gross_line_total: 35000,
      promo_discount: 10000,
      manual_item_discount: 5000,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.lineRevenue).toBe(20000); // 35000 - 10000 - 5000
    expect(result.variantRevenue).toBe(20000); // ratio = 20000/35000 ≈ 0.571; 35000 * ratio rounded
  });

  it("floors revenue at 0 when discounts exceed gross", () => {
    // Defensive: shouldn't happen post-invariants, but allocator must not return negative
    const line: LineForAllocation = {
      unit_price: 10000,
      qty: 1,
      modifiers: [],
      gross_line_total: 10000,
      promo_discount: 15000, // exceeds gross
      manual_item_discount: 0,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(0);
    expect(result.lineRevenue).toBe(0); // floor
  });

  it("UCK000094 Sữa Dâu line: variantRevenue = 25000 (promo price)", () => {
    const { lines } = makeUCK000094Order();
    const fixtureLine = lines[0]; // Sữa Dâu
    const line: LineForAllocation = {
      unit_price: fixtureLine.unit_price,
      qty: fixtureLine.qty,
      modifiers: [],
      gross_line_total: fixtureLine.gross_line_total,
      promo_discount: fixtureLine.promo_discount,
      manual_item_discount: fixtureLine.manual_item_discount,
      order_discount_allocation: fixtureLine.order_discount_allocation,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(25000); // headline number from audit
    expect(result.lineRevenue).toBe(25000);
  });

  it("UCK000094 Hồng Trà line: variantRevenue = 25000 (after 5k order discount)", () => {
    const { lines } = makeUCK000094Order();
    const fixtureLine = lines[1]; // Hồng Trà
    const line: LineForAllocation = {
      unit_price: fixtureLine.unit_price,
      qty: fixtureLine.qty,
      modifiers: [],
      gross_line_total: fixtureLine.gross_line_total,
      promo_discount: fixtureLine.promo_discount,
      manual_item_discount: fixtureLine.manual_item_discount,
      order_discount_allocation: fixtureLine.order_discount_allocation,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(25000); // 30000 - 5000
    expect(result.lineRevenue).toBe(25000);
  });
});

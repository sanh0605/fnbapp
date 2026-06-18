import { describe, it, expect } from "vitest";
import { allocateOrderDiscount } from "@/lib/order-math";
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

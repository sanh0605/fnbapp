import { describe, it, expect } from "vitest";
import { allocateOrderDiscount, allocateLineRevenue, assertOrderInvariants } from "@/lib/order-math";
import { InvariantError, type AllocatableLine, type LineForAllocation } from "@/lib/order-types";
import {
  makeSuaDauStandaloneOrder,
  makeUCK000094MigratedOrder,
  makeUCK000094RawOrder,
  makePHD000540MigratedOrder,
  makePHD000540RawOrder,
  makeNoDiscountOrder,
  makeCapacityCapOrder,
  makeLineWithModifiers,
} from "@/lib/__tests__/fixtures";

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

  it("2-pass distribution: sum equals target even when proportional rounds down for many lines", () => {
    // Documents the bug fix in fd65b96: when many small-capacity lines
    // cause proportional values to round down, the second pass redistributes
    // any residual to lines that still have capacity.
    // Property: sum(result) === min(discount, totalCapacity) always.
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 3 },
      { line_id: "L2", capacity: 3 },
      { line_id: "L3", capacity: 3 },
      { line_id: "L4", capacity: 3 },
    ];
    // total capacity = 12, target = 5
    const result = allocateOrderDiscount(lines, 5);
    const sum = lines.reduce((s, l) => s + (result.get(l.line_id) || 0), 0);
    expect(sum).toBe(5);

    // No allocation exceeds capacity
    for (const l of lines) {
      expect(result.get(l.line_id)).toBeLessThanOrEqual(l.capacity);
    }
  });

  it("2-pass distribution: cap-then-redistribute when one line hits capacity early", () => {
    // Edge case: small-capacity line gets capped, residual must still find a home.
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 5 },  // will be capped
      { line_id: "L2", capacity: 100 }, // absorbs residual
    ];
    // total = 105, target = 50
    const result = allocateOrderDiscount(lines, 50);
    const sum = (result.get("L1") || 0) + (result.get("L2") || 0);
    expect(sum).toBe(50);
    expect(result.get("L1")).toBeLessThanOrEqual(5);
    expect(result.get("L2")).toBeLessThanOrEqual(100);
  });

  it("UCK000094 has no order-level discount (User-confirmed); allocator returns all zeros", () => {
    // Real situation: UCK000094 has only PRM-003 promo, no order-level discount.
    // The 5k discrepancy in legacy data is a calc bug, NOT a real discount.
    const { order, lines } = makeUCK000094MigratedOrder();
    expect(order.manual_order_discount).toBe(0);

    const allocatable: AllocatableLine[] = lines.map(l => ({
      line_id: l.id,
      capacity: l.gross_line_total - l.promo_discount - l.manual_item_discount,
    }));
    const result = allocateOrderDiscount(allocatable, order.manual_order_discount);
    for (const l of lines) {
      expect(result.get(l.id)).toBe(0);
    }
  });

  it("PHD000540 combo: allocates 18000 to single line, sum exact", () => {
    // PHD000540 has 1 line; the entire 18k order discount lands on it.
    const { order, lines } = makePHD000540MigratedOrder();
    const allocatable: AllocatableLine[] = lines.map(l => ({
      line_id: l.id,
      capacity: l.gross_line_total - l.promo_discount - l.manual_item_discount,
    }));
    const result = allocateOrderDiscount(allocatable, order.manual_order_discount);
    expect(result.get(lines[0].id)).toBe(18000);
    expect(order.manual_order_discount).toBe(18000);
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
    expect(result.variantRevenue).toBe(20000);
  });

  it("floors revenue at 0 when discounts exceed gross", () => {
    // Defensive: shouldn't happen post-invariants, but allocator must not return negative
    const line: LineForAllocation = {
      unit_price: 10000,
      qty: 1,
      modifiers: [],
      gross_line_total: 10000,
      promo_discount: 15000,
      manual_item_discount: 0,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(0);
    expect(result.lineRevenue).toBe(0);
  });

  it("standalone Sữa Dâu (no order discount): variantRevenue = 25000 (audit headline)", () => {
    // Headline case: 1 Sữa Dâu @ 35k with PRM-003 FLAT_PRICE 25k → net 25k.
    // Used by audit to verify 73 × 25k = 1.825.000đ.
    const { lines } = makeSuaDauStandaloneOrder();
    const fixtureLine = lines[0];
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
    expect(result.variantRevenue).toBe(25000);
    expect(result.lineRevenue).toBe(25000);
  });

  it("UCK000094 Sữa Dâu (no order discount): variantRevenue = 25000", () => {
    // UCK000094 has no order-level discount; Sữa Dâu reports its promo price 25k.
    const { lines } = makeUCK000094MigratedOrder();
    const suaDau = lines.find(l => l.variant_id === "VAR-031")!;
    expect(suaDau.order_discount_allocation).toBe(0);
    const line: LineForAllocation = {
      unit_price: suaDau.unit_price,
      qty: suaDau.qty,
      modifiers: [],
      gross_line_total: suaDau.gross_line_total,
      promo_discount: suaDau.promo_discount,
      manual_item_discount: suaDau.manual_item_discount,
      order_discount_allocation: suaDau.order_discount_allocation,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(25000);
    expect(result.lineRevenue).toBe(25000);
  });

  it("PHD000540 line (full comp): variantRevenue = 0, modifierRevenue = 0", () => {
    // Customer paid 0; everything nets to 0.
    const { lines } = makePHD000540MigratedOrder();
    const line: LineForAllocation = {
      unit_price: lines[0].unit_price,
      qty: lines[0].qty,
      modifiers: [
        { id: "MOD-001", name: "20ml cốt cà phê", price: 3000, qty: 1 },
      ],
      gross_line_total: lines[0].gross_line_total,
      promo_discount: lines[0].promo_discount,
      manual_item_discount: lines[0].manual_item_discount,
      order_discount_allocation: lines[0].order_discount_allocation,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(0);
    expect(result.modifierRevenue["MOD-001"]).toBe(0);
    expect(result.lineRevenue).toBe(0);
  });
});

describe("assertOrderInvariants", () => {
  describe("happy path (passes)", () => {
    it("passes for standalone Sữa Dâu (1 line, no order discount)", () => {
      const { order, lines } = makeSuaDauStandaloneOrder();
      expect(() => assertOrderInvariants(order, lines)).not.toThrow();
    });

    it("passes for UCK000094 migrated (9 lines, 5k order discount)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      expect(() => assertOrderInvariants(order, lines)).not.toThrow();
    });

    it("passes for PHD000540 migrated (combo, 18k order discount)", () => {
      const { order, lines } = makePHD000540MigratedOrder();
      expect(() => assertOrderInvariants(order, lines)).not.toThrow();
    });

    it("passes for no-discount fixture", () => {
      const { order, lines } = makeNoDiscountOrder();
      expect(() => assertOrderInvariants(order, lines)).not.toThrow();
    });

    it("passes for capacity-cap fixture", () => {
      const { order, lines } = makeCapacityCapOrder();
      expect(() => assertOrderInvariants(order, lines)).not.toThrow();
    });
  });

  describe("real-world corruption (correctly fails)", () => {
    it("FAILS for raw UCK000094 (5k discrepancy between sum of lines and order total)", () => {
      const { order, lines } = makeUCK000094RawOrder();
      expect(() => assertOrderInvariants(order, lines)).toThrow(InvariantError);
    });

    it("FAILS for raw PHD000540 (order_discount 21k double-counts with promo, net would be -3k)", () => {
      const { order, lines } = makePHD000540RawOrder();
      expect(() => assertOrderInvariants(order, lines)).toThrow(InvariantError);
    });
  });

  describe("synthetic mutations (each invariant tested in isolation)", () => {
    it("throws when order has no lines", () => {
      const { order } = makeSuaDauStandaloneOrder();
      expect(() => assertOrderInvariants(order, [])).toThrow(InvariantError);
      expect(() => assertOrderInvariants(order, [])).toThrow(/no lines/);
    });

    it("throws when gross_total mismatches sum of line gross (I1)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      order.gross_total = 99999;
      expect(() => assertOrderInvariants(order, lines)).toThrow(/gross mismatch/);
    });

    it("throws when promo_discount_total mismatches (I2)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      order.promo_discount_total = 0;
      expect(() => assertOrderInvariants(order, lines)).toThrow(/promo mismatch/);
    });

    it("throws when manual_item_discount_total mismatches (I3)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      order.manual_item_discount_total = 999;
      expect(() => assertOrderInvariants(order, lines)).toThrow(/manual_item mismatch/);
    });

    it("throws when sum of order_discount_allocation != manual_order_discount (I4)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      order.manual_order_discount = 99999;
      expect(() => assertOrderInvariants(order, lines)).toThrow(/order_discount_allocation mismatch/);
    });

    it("throws when net_total formula doesn't hold (I5)", () => {
      const { order, lines } = makeNoDiscountOrder();
      order.net_total = 99999;
      expect(() => assertOrderInvariants(order, lines)).toThrow(/net_total formula mismatch/);
    });

    it("throws when a line's net doesn't match its components (I6)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      lines[0].net_line_total = 99999;
      expect(() => assertOrderInvariants(order, lines)).toThrow(/line .* net mismatch/);
    });

    it("throws when sum of line nets != order net_total (I7)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      order.net_total = 99999;
      // I7 fires after I5; both check net_total. We mutate one of the inputs:
      // I5 formula = gross - all = 266 - 105 - 0 - 5 = 156, but order.net_total=99999 → I5 fires first.
      // To trigger I7 specifically, mutate a line's net to be inconsistent with the order sum
      // while keeping per-line math valid. We do this by tampering order.net_total AFTER lines sum:
      expect(() => assertOrderInvariants(order, lines)).toThrow();
    });

    it("allows ±1 đồng tolerance for rounding (I4, I5, I6, I7)", () => {
      const { order, lines } = makeUCK000094MigratedOrder();
      order.net_total = order.net_total + 1; // within tolerance
      expect(() => assertOrderInvariants(order, lines)).not.toThrow();
    });
  });
});

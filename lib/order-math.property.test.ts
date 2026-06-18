import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { assertOrderInvariants, allocateLineRevenue, allocateOrderDiscount } from "@/lib/order-math";
import type { OrderV2, OrderLineV2, AllocatableLine, LineForAllocation } from "@/lib/order-types";

describe("Property tests", () => {
  it("Invariants always hold for random valid orders", () => {
    fc.assert(
      fc.property(
        fc.record({
          lineCount: fc.integer({ min: 1, max: 10 }),
          unitPrice: fc.integer({ min: 1000, max: 100000 }),
          qty: fc.integer({ min: 1, max: 5 }),
          promoPerLine: fc.integer({ min: 0, max: 20000 }),
          manualItemPerLine: fc.integer({ min: 0, max: 10000 }),
          manualOrder: fc.integer({ min: 0, max: 50000 }),
        }),
        (params) => {
          const orderId = `ord-prop-${Math.random().toString(36).slice(2)}`;
          const lines: OrderLineV2[] = [];

          for (let i = 0; i < params.lineCount; i++) {
            const gross = params.unitPrice * params.qty;
            const promo = Math.min(params.promoPerLine, gross);
            const manualItem = Math.min(params.manualItemPerLine, gross - promo);
            lines.push({
              id: `ol-${i}`,
              order_id: orderId,
              line_no: i + 1,
              product_id: `prod-${i}`,
              product_snapshot_json: "{}",
              variant_id: `var-${i}`,
              variant_snapshot_json: "{}",
              qty: params.qty,
              unit_price: params.unitPrice,
              modifiers_snapshot_json: "[]",
              gross_line_total: gross,
              promo_discount: promo,
              manual_item_discount: manualItem,
              order_discount_allocation: 0,
              net_line_total: 0,
              cost_at_sale: 0,
              recipe_snapshot_json: "{}",
              promo_discount_reason: "",
              manual_discount_reason: "",
            });
          }

          const allocatable: AllocatableLine[] = lines.map(l => ({
            line_id: l.id,
            capacity: l.gross_line_total - l.promo_discount - l.manual_item_discount,
          }));
          const allocations = allocateOrderDiscount(allocatable, params.manualOrder);
          for (const l of lines) {
            l.order_discount_allocation = allocations.get(l.id) || 0;
            l.net_line_total = l.gross_line_total - l.promo_discount - l.manual_item_discount - l.order_discount_allocation;
          }

          const order: OrderV2 = {
            id: orderId,
            order_no: "PROP-001",
            brand_id: "B",
            status: "COMPLETED",
            version: 1,
            parent_order_id: "",
            superseded_by: "",
            created_at: "2026-06-01T00:00:00.000Z",
            created_by_id: "U",
            created_by_name: "Test",
            completed_at: "2026-06-01T00:00:00.000Z",
            voided_at: "",
            voided_by_id: "",
            void_reason: "",
            currency: "VND",
            gross_total: lines.reduce((s, l) => s + l.gross_line_total, 0),
            promo_discount_total: lines.reduce((s, l) => s + l.promo_discount, 0),
            manual_item_discount_total: lines.reduce((s, l) => s + l.manual_item_discount, 0),
            manual_order_discount: Math.min(
              params.manualOrder,
              lines.reduce((s, l) => s + (l.gross_line_total - l.promo_discount - l.manual_item_discount), 0),
            ),
            net_total: lines.reduce((s, l) => s + l.net_line_total, 0),
            applied_promotion_id: "",
            applied_promotion_snapshot_json: "",
            pos_snapshot_json: "{}",
            payment_method: "CASH",
            payment_ref: "",
          };

          expect(() => assertOrderInvariants(order, lines)).not.toThrow();
        }
      ),
      { numRuns: 500 }
    );
  });

  it("allocateLineRevenue never returns negative revenue", () => {
    fc.assert(
      fc.property(
        fc.record({
          unitPrice: fc.integer({ min: 1000, max: 100000 }),
          qty: fc.integer({ min: 1, max: 10 }),
          promoDiscount: fc.integer({ min: 0, max: 200000 }), // can exceed gross
          manualItemDiscount: fc.integer({ min: 0, max: 200000 }),
          orderAlloc: fc.integer({ min: 0, max: 200000 }),
          modifiers: fc.array(
            fc.record({
              price: fc.integer({ min: 0, max: 20000 }),
              qty: fc.integer({ min: 1, max: 5 }),
            }),
            { maxLength: 3 }
          ),
        }),
        (params) => {
          const mods = params.modifiers.map((m, i) => ({
            id: `MOD-${i}`,
            name: `Mod ${i}`,
            price: m.price,
            qty: m.qty,
          }));
          const grossVariant = params.unitPrice * params.qty;
          const grossMods = mods.reduce((sum, m) => sum + m.price * m.qty * params.qty, 0);
          const grossLine = grossVariant + grossMods;

          const line: LineForAllocation = {
            unit_price: params.unitPrice,
            qty: params.qty,
            modifiers: mods,
            gross_line_total: grossLine,
            promo_discount: params.promoDiscount,
            manual_item_discount: params.manualItemDiscount,
            order_discount_allocation: params.orderAlloc,
          };

          const result = allocateLineRevenue(line);

          expect(result.variantRevenue).toBeGreaterThanOrEqual(0);
          expect(result.lineRevenue).toBeGreaterThanOrEqual(0);
          for (const mId in result.modifierRevenue) {
            expect(result.modifierRevenue[mId]).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it("allocateOrderDiscount sum always equals min(discount, totalCapacity)", () => {
    fc.assert(
      fc.property(
        fc.record({
          capacities: fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 20 }),
          discount: fc.integer({ min: 0, max: 500000 }),
        }),
        (params) => {
          const lines: AllocatableLine[] = params.capacities.map((cap, i) => ({
            line_id: `L-${i}`,
            capacity: cap,
          }));
          const result = allocateOrderDiscount(lines, params.discount);

          const sumAlloc = Array.from(result.values()).reduce((s, v) => s + v, 0);
          const totalCap = params.capacities.reduce((s, c) => s + c, 0);

          expect(sumAlloc).toBe(Math.min(params.discount, totalCap));
        }
      ),
      { numRuns: 500 }
    );
  });
});

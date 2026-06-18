/**
 * Orders V2 — pure math functions.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 6)
 *
 * No I/O. No side effects. Deterministic.
 */

import type {
  AllocatableLine,
  AllocatedRevenue,
  LineForAllocation,
  OrderV2,
  OrderLineV2,
} from "@/lib/order-types";
import { InvariantError } from "@/lib/order-types";

/**
 * Distributes `orderDiscount` across lines proportional to their capacity.
 *
 * Rules:
 *   1. Each allocation is capped at the line's capacity.
 *   2. If `orderDiscount > totalCapacity`, sum of allocations equals totalCapacity.
 *   3. Otherwise, sum of allocations equals `orderDiscount` exactly (rounding
 *      residual absorbed by the last eligible line).
 *   4. Lines with capacity 0 are skipped.
 *
 * Returns Map<line_id, allocation>. Every input line is present in the map.
 */
export function allocateOrderDiscount(
  lines: AllocatableLine[],
  orderDiscount: number,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const l of lines) result.set(l.line_id, 0);

  if (orderDiscount <= 0) return result;

  const eligible = lines.filter(l => l.capacity > 0);
  if (eligible.length === 0) return result;

  const totalCapacity = eligible.reduce((s, l) => s + l.capacity, 0);
  const target = Math.min(orderDiscount, totalCapacity);

  let allocated = 0;
  for (let i = 0; i < eligible.length; i++) {
    const l = eligible[i];
    if (i === eligible.length - 1) {
      // Last line absorbs rounding residual.
      const residual = target - allocated;
      result.set(l.line_id, Math.min(residual, l.capacity));
    } else {
      const proportional = Math.round((target * l.capacity) / totalCapacity);
      const capped = Math.min(proportional, l.capacity);
      result.set(l.line_id, capped);
      allocated += capped;
    }
  }

  return result;
}

// ============================================================================
// Functions below are stubs — implemented in Tasks 5 and 6.
// ============================================================================

/**
 * Allocates a line's net revenue back to its variant and modifiers
 * for per-product reporting.
 *
 * Strategy: apply a single ratio across all components of the line.
 *   ratio = (gross - totalDiscount) / gross   (floored at 0)
 *
 * The `lineRevenue` returned equals the stored net (gross - all discounts).
 * `variantRevenue + sum(modifierRevenue)` may differ by ±1đ due to
 * rounding per component; consumers that need the exact line total must
 * use `lineRevenue`, not sum the components.
 */
export function allocateLineRevenue(line: LineForAllocation): AllocatedRevenue {
  const grossVariant = line.unit_price * line.qty;
  const grossModifiers = line.modifiers.reduce(
    (sum, m) => sum + m.price * m.qty * line.qty,
    0,
  );
  const grossLine = grossVariant + grossModifiers;

  const totalDiscount =
    line.promo_discount + line.manual_item_discount + line.order_discount_allocation;

  const lineRevenue = Math.max(0, grossLine - totalDiscount);
  const ratio = grossLine > 0 ? lineRevenue / grossLine : 0;

  const variantRevenue = Math.round(grossVariant * ratio);
  const modifierRevenue: Record<string, number> = {};
  for (const m of line.modifiers) {
    modifierRevenue[m.id] = Math.round(m.price * m.qty * line.qty * ratio);
  }

  return { variantRevenue, modifierRevenue, lineRevenue };
}

export function assertOrderInvariants(_order: OrderV2, _lines: OrderLineV2[]): void {
  throw new Error("Not implemented");
}

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

  let remainingTarget = target;
  let remainingCapacity = totalCapacity;

  for (const l of eligible) {
    if (remainingCapacity <= 0) break;
    let alloc = Math.round((remainingTarget * l.capacity) / remainingCapacity);
    alloc = Math.min(alloc, l.capacity);
    result.set(l.line_id, alloc);
    remainingTarget -= alloc;
    remainingCapacity -= l.capacity;
  }

  // If there's still target left (due to rounding down and capping),
  // distribute it to any line that still has capacity.
  if (remainingTarget > 0) {
    for (const l of eligible) {
      if (remainingTarget <= 0) break;
      const current = result.get(l.line_id)!;
      if (current < l.capacity) {
        const space = l.capacity - current;
        const add = Math.min(space, remainingTarget);
        result.set(l.line_id, current + add);
        remainingTarget -= add;
      }
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
 * Strategy (WS-8 fix): 2-stage allocation.
 *
 * Stage 1: Variant absorbs promo + manual_item discounts first.
 *   - Promos (PRODUCT_DISCOUNT) target the variant specifically.
 *   - Manual item discounts are typically cashier reductions on the main item.
 *   - variantNet = max(0, grossVariant - promo - manual_item)
 *
 * Stage 2: Order_discount_allocation distributed proportionally across
 * (variantNet + modifiers). This is the only discount that conceptually
 * applies to the whole line.
 *   - ratio = max(0, 1 - order_alloc / (variantNet + grossModifiers))
 *   - variantRevenue = round(variantNet * ratio)
 *   - modifierRevenue[id] = round(grossMod * ratio)
 *
 * The `lineRevenue` returned equals the stored net (gross - all discounts).
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 6.1)
 */
export function allocateLineRevenue(line: LineForAllocation): AllocatedRevenue {
  const grossVariant = line.unit_price * line.qty;
  const grossModifiers = line.modifiers.reduce(
    (sum, m) => sum + m.price * m.qty * line.qty,
    0,
  );
  const grossLine = grossVariant + grossModifiers;

  // Stage 1: variant absorbs promo + manual_item first (capped at 0)
  const variantNet = Math.max(0, grossVariant - line.promo_discount - line.manual_item_discount);

  // Stage 2: order_discount_allocation proportional across remaining
  const totalAvailable = variantNet + grossModifiers;
  const orderAllocEffective = Math.min(line.order_discount_allocation, totalAvailable);
  const ratio = totalAvailable > 0 ? Math.max(0, 1 - orderAllocEffective / totalAvailable) : 0;

  const variantRevenue = Math.round(variantNet * ratio);
  const modifierRevenue: Record<string, number> = {};
  for (const m of line.modifiers) {
    modifierRevenue[m.id] = Math.round(m.price * m.qty * line.qty * ratio);
  }

  // lineRevenue = stored net (gross - all discounts). Independent of allocation.
  const lineRevenue = Math.max(0, grossLine - line.promo_discount - line.manual_item_discount - line.order_discount_allocation);

  return { variantRevenue, modifierRevenue, lineRevenue };
}

/**
 * Asserts all financial invariants for an order + its lines.
 *
 * Invariants (see spec section 6.2):
 *   I1. gross_total = sum(line.gross_line_total)
 *   I2. promo_discount_total = sum(line.promo_discount)
 *   I3. manual_item_discount_total = sum(line.manual_item_discount)
 *   I4. sum(line.order_discount_allocation) = manual_order_discount (±1đ)
 *   I5. net_total = gross - promo - manual_item - manual_order (±1đ)
 *   I6. per-line: net_line_total = gross - promo - manual_item - order_alloc (±1đ)
 *   I7. net_total = sum(line.net_line_total) (±1đ)
 *
 * Throws InvariantError on the first violation.
 */
export function assertOrderInvariants(order: OrderV2, lines: OrderLineV2[]): void {
  if (lines.length === 0) {
    throw new InvariantError("order has no lines");
  }

  for (const l of lines) {
    const expectedLineNet =
      l.gross_line_total - l.promo_discount - l.manual_item_discount - l.order_discount_allocation;
    if (Math.abs(expectedLineNet - l.net_line_total) > 1) {
      throw new InvariantError(`line ${l.id} net mismatch: expected ${expectedLineNet}, got ${l.net_line_total}`);
    }
  }

  const sumGross = lines.reduce((s, l) => s + l.gross_line_total, 0);
  const sumPromo = lines.reduce((s, l) => s + l.promo_discount, 0);
  const sumManualItem = lines.reduce((s, l) => s + l.manual_item_discount, 0);
  const sumOrderAlloc = lines.reduce((s, l) => s + l.order_discount_allocation, 0);
  const sumNet = lines.reduce((s, l) => s + l.net_line_total, 0);

  if (sumGross !== order.gross_total) {
    throw new InvariantError(`gross mismatch: lines sum to ${sumGross}, order.gross_total=${order.gross_total}`);
  }
  if (sumPromo !== order.promo_discount_total) {
    throw new InvariantError(`promo mismatch: lines sum to ${sumPromo}, order.promo_discount_total=${order.promo_discount_total}`);
  }
  if (sumManualItem !== order.manual_item_discount_total) {
    throw new InvariantError(`manual_item mismatch: lines sum to ${sumManualItem}, order.manual_item_discount_total=${order.manual_item_discount_total}`);
  }
  if (Math.abs(sumOrderAlloc - order.manual_order_discount) > 1) {
    throw new InvariantError(`order_discount_allocation mismatch: lines sum to ${sumOrderAlloc}, order.manual_order_discount=${order.manual_order_discount}`);
  }

  const expectedNet =
    order.gross_total -
    order.promo_discount_total -
    order.manual_item_discount_total -
    order.manual_order_discount;
  if (Math.abs(expectedNet - order.net_total) > 1) {
    throw new InvariantError(`net_total formula mismatch: expected ${expectedNet}, got ${order.net_total}`);
  }

  if (Math.abs(sumNet - order.net_total) > 1) {
    throw new InvariantError(`net_total mismatch: lines sum to ${sumNet}, order.net_total=${order.net_total}`);
  }
}

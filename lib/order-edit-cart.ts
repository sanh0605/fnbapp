/**
 * Edit cart → new OrderV2 version (supersedes original).
 *
 * Pure function. Mirrors buildOrderFromCart but pins:
 *   - created_at = original.created_at (preserves sale time)
 *   - order_no = original.order_no
 *   - version = original.version + 1
 *   - parent_order_id = root (walks chain to v1)
 *
 * Internally calls assertOrderInvariants before returning.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 5.5)
 */

import crypto from "node:crypto";
import { buildOrderFromCart } from "@/lib/order-cart";
import type { CartInput, ReferenceData, BuildOrderResult } from "@/lib/order-cart";
import type { OrderV2, OrderLineV2 } from "@/lib/order-types";

interface OriginalOrder {
  order: OrderV2;
  lines: OrderLineV2[];
}

import { assertOrderInvariants } from "@/lib/order-math";

export function buildEditedOrderFromCart(
  input: CartInput,
  ref: ReferenceData,
  original: OriginalOrder,
): BuildOrderResult {
  // Delegate core math to buildOrderFromCart, then patch identity fields.
  const built = buildOrderFromCart({ ...input, suppress_auto_promotion: true }, ref);

  // Find root: if original has no parent, original IS the root.
  const rootId = original.order.parent_order_id || original.order.id;

  const editedOrder: OrderV2 = {
    ...built.order,
    id: `ord-${crypto.randomUUID()}`, // new ID (supersede = new row)
    order_no: original.order.order_no, // preserve order_no
    version: original.order.version + 1,
    parent_order_id: rootId,
    created_at: original.order.created_at, // preserve sale time
    completed_at: original.order.completed_at,
    // created_by_* reflects the editor (who made this version), not original cashier
  };

  // Re-assert invariants with patched values (they should still hold)
  // Math fields are unchanged from buildOrderFromCart output, so this is just paranoia.
  // But it's cheap and catches bugs.
  assertOrderInvariants(editedOrder, built.lines);

  // Patch line order_id to point to new order id
  const editedLines = built.lines.map(l => ({ ...l, order_id: editedOrder.id }));

  return {
    order: editedOrder,
    lines: editedLines,
    resolvedPromotion: built.resolvedPromotion,
    resolvedRecipes: built.resolvedRecipes,
  };
}

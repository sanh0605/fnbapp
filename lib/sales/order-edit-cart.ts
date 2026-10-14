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
 * (section 5.5)
 */

import crypto from "node:crypto";
import { buildOrderFromCart } from "@/lib/sales/order-cart";
import type {
  BuildOrderResult,
  CartInput,
  CartPaymentInput,
  ReferenceData,
} from "@/lib/sales/order-cart";
import type { OrderV2, OrderLineV2 } from "@/lib/sales/order-types";

interface OriginalOrder {
  order: OrderV2;
  lines: OrderLineV2[];
}

import { assertOrderInvariants } from "@/lib/sales/order-math";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER"];
const vnd = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;

// Parts chosen on Sửa đơn (BR-SALE-013). Untrusted input from the client.
function planRequestedPayments(requested: unknown, newNetTotal: number): CartPaymentInput[] {
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new Error("Chưa có phần thanh toán nào");
  }
  const parts = requested.map((raw): CartPaymentInput => {
    const p = raw as { method?: unknown; amount?: unknown; reference?: unknown } | null;
    if (!p || typeof p.method !== "string" || !PAYMENT_METHODS.includes(p.method)) {
      throw new Error("Hình thức thanh toán không hợp lệ");
    }
    return {
      method: p.method as CartPaymentInput["method"],
      amount: Number(p.amount),
      reference: typeof p.reference === "string" ? p.reference : "",
    };
  });
  // One part: its own amount may be stale, it takes the server's total.
  if (parts.length === 1) return [{ ...parts[0], amount: newNetTotal }];

  if (new Set(parts.map((p) => p.method)).size !== parts.length) {
    throw new Error("Mỗi hình thức thanh toán chỉ được có một phần");
  }
  if (parts.some((p) => !Number.isInteger(p.amount) || p.amount <= 0)) {
    throw new Error("Số tiền mỗi phần thanh toán phải là số nguyên lớn hơn 0");
  }
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  if (sum !== newNetTotal) {
    throw new Error(`Tổng các phần thanh toán (${vnd(sum)}) phải bằng tiền đơn (${vnd(newNetTotal)}).`);
  }
  return parts;
}

export function planEditedOrderPayments(
  existingPayments: CartPaymentInput[],
  oldNetTotal: number,
  newNetTotal: number,
  selectedPaymentMethod: CartPaymentInput["method"],
  requested?: unknown,
): CartPaymentInput[] {
  if (requested !== undefined) return planRequestedPayments(requested, newNetTotal);
  if (existingPayments.length > 1) {
    const existingTotal = existingPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    if (existingTotal !== oldNetTotal) {
      throw new Error(
        "Chi ti\u1ebft thanh to\u00e1n k\u1ebft h\u1ee3p kh\u00f4ng kh\u1edbp v\u1edbi t\u1ed5ng ti\u1ec1n c\u1ee7a \u0111\u01a1n g\u1ed1c",
      );
    }
    if (newNetTotal !== oldNetTotal) {
      throw new Error(
        "\u0110\u01a1n thanh to\u00e1n k\u1ebft h\u1ee3p hi\u1ec7n kh\u00f4ng th\u1ec3 \u0111\u1ed5i t\u1ed5ng ti\u1ec1n khi s\u1eeda. Vui l\u00f2ng h\u1ee7y v\u00e0 t\u1ea1o l\u1ea1i \u0111\u01a1n.",
      );
    }
    return existingPayments.map((payment) => ({
      method: payment.method,
      amount: Number(payment.amount),
      reference: payment.reference || "",
    }));
  }

  return [{
    method: selectedPaymentMethod,
    amount: newNetTotal,
    reference: "",
  }];
}

export function buildEditedOrderFromCart(
  input: CartInput,
  ref: ReferenceData,
  original: OriginalOrder,
): BuildOrderResult {
  // Delegate core math to buildOrderFromCart, then patch identity fields.
  const built = buildOrderFromCart(
    { ...input, suppress_auto_promotion: true },
    ref,
  );

  // Find root: if original has no parent, original IS the root.
  const rootId = original.order.parent_order_id || original.order.id;

  const editedOrder: OrderV2 = {
    ...built.order,
    id: `ord-${crypto.randomUUID()}`, // new ID (supersede = new row)
    order_no: original.order.order_no, // preserve order_no
    version: original.order.version + 1,
    parent_order_id: rootId,
    created_at: original.order.created_at, // preserve sale time
    // 2026-08-25: preserve outlet_id the same way -- an admin editing an
    // order from /admin/orders has no "current outlet" of their own, so
    // without this it would silently blank out on every edit. Sale-time
    // facts (where and when) do not move on edit.
    outlet_id: original.order.outlet_id,
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
    payments: built.payments,
  };
}

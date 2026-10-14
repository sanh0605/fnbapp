import { PAYMENT_METHOD } from "./order-types";

// The one rule for an order's payment method (2026-10-14 audit, B1): an empty
// method means cash (the same rule the cash book applies), and an order paid
// two ways is read through its order_payments rows, not the single
// orders_v2.payment_method column.

export function normalizePaymentMethod(method: unknown): string {
  const text = String(method ?? "").trim();
  return text || PAYMENT_METHOD.CASH;
}

export function effectivePaymentRows(
  order: { payment_method?: unknown; net_total: number | string },
  payments: Array<{ method?: unknown; amount: number | string }>,
): Array<{ method: string; amount: number }> {
  if (payments.length === 0) {
    return [{ method: normalizePaymentMethod(order.payment_method), amount: Number(order.net_total) || 0 }];
  }
  return payments.map(p => ({ method: normalizePaymentMethod(p.method), amount: Number(p.amount) || 0 }));
}

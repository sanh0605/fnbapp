/**
 * Pure planning for scripts/add-missing-order-payment.ts. Order 260723001017
 * (edited from bank transfer to cash on 2026-07-23) kept no payment row for
 * its COMPLETED version. The row follows the till's shape: id "pay-" + order
 * id, the whole net total, empty reference.
 */
export interface PayableOrder {
  id: string;
  order_no: string;
  status: string;
  payment_method: string;
  net_total: number;
  created_at: string;
}
export interface PaymentRow {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  reference: string;
  created_at: string;
}

export function planPaymentRow(order: PayableOrder, existing: readonly { order_id: string }[]): PaymentRow {
  if (order.status !== "COMPLETED") throw new Error(`${order.order_no}: status is ${order.status}, expected COMPLETED`);
  if (existing.some(p => p.order_id === order.id)) throw new Error(`${order.order_no} already has a payment row`);
  return {
    id: `pay-${order.id}`,
    order_id: order.id,
    method: order.payment_method,
    amount: order.net_total,
    reference: "",
    created_at: order.created_at,
  };
}

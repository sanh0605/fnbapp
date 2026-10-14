/**
 * Payment parts chosen on Đổi cách trả (BR-SALE-013, BR-SALE-014).
 */

import type { CartPaymentInput } from "@/lib/sales/order-cart";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER"];
const vnd = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;

// Untrusted input from the client.
export function planRequestedPayments(requested: unknown, newNetTotal: number): CartPaymentInput[] {
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

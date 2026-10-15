// Pure part of scripts/move-shopee-orders-to-acb.ts (owner answer 2026-10-15,
// BR-CASH-001): the 53 Shopee purchase orders were paid through ACB, not cash.

export interface PurchaseOrderRow {
  id: string;
  status: string;
  source_id: string;
  payment_method: string | null;
  bank_account_id: string | null;
  total_amount: number;
  transaction_date: string | null;
  created_at: string;
}

// Completed orders from the source still marked as cash. Cancelled and draft
// orders are not in the cash book, so they are left alone.
export function planMove(orders: readonly PurchaseOrderRow[], shopeeSourceId: string) {
  const targets = orders
    .filter((o) => o.source_id === shopeeSourceId && o.status === "COMPLETED" && o.payment_method === "CASH")
    .sort((a, b) => a.id.localeCompare(b.id));
  return { targets, total: targets.reduce((sum, o) => sum + Number(o.total_amount), 0) };
}

// The orders as they will read after the write; used to predict the balances.
export function withMove(orders: readonly PurchaseOrderRow[], ids: readonly string[], accountId: string): PurchaseOrderRow[] {
  const moved = new Set(ids);
  return orders.map((o) => (moved.has(o.id) ? { ...o, payment_method: "BANK_TRANSFER", bank_account_id: accountId } : o));
}

// "Read at run time": the one active account named ACB; never guess between two.
export function pickAcbAccount(accounts: readonly { id: string; name: string; status: string }[]): string {
  const acb = accounts.filter((a) => a.status === "ACTIVE" && /\bACB\b/i.test(a.name));
  if (acb.length !== 1) throw new Error(`Cần đúng 1 tài khoản ACB đang dùng, tìm thấy ${acb.length}`);
  return acb[0].id;
}

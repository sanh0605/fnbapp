import type { ParseResult } from "@/lib/finance/cash-entry-rules";

export type PurchasePaymentMethod = "CASH" | "BANK_TRANSFER";

export interface PurchasePaymentFields {
  payment_method: PurchasePaymentMethod | null;
  bank_account_id: string | null;
}

const METHOD_MISSING_ERROR = "Chọn cách trả tiền";
const ACCOUNT_MISSING_ERROR = "Chọn tài khoản nhận chuyển khoản";
const ACCOUNT_GONE_ERROR = "Tài khoản không còn dùng";

// How a purchase order was paid. Mirrors the database checks of migration
// 0107 (completed needs a method; Chuyển khoản needs an account; cash has
// none) so the owner gets a Vietnamese message instead of a constraint error.
export function parsePurchaseOrderPayment(input: {
  status: string;
  method: string;
  bankAccountId: string;
  activeAccountIds: string[];
  // The order's own saved account: allowed on a re-save even if it was stopped
  // since, so an old order is not stuck. Any other stopped account is refused.
  currentAccountId?: string | null;
}): ParseResult<PurchasePaymentFields> {
  const method: PurchasePaymentMethod | null =
    input.method === "CASH" || input.method === "BANK_TRANSFER" ? input.method : null;

  if (method === null) {
    if (input.status === "COMPLETED") return { ok: false, error: METHOD_MISSING_ERROR };
    // A draft may stay undecided; a stale account without a method is dropped.
    return { ok: true, value: { payment_method: null, bank_account_id: null } };
  }

  // Cash never carries an account (a stale value from a half-filled form).
  if (method === "CASH") return { ok: true, value: { payment_method: "CASH", bank_account_id: null } };

  const account = (input.bankAccountId || "").trim();
  if (!account) return { ok: false, error: ACCOUNT_MISSING_ERROR };
  const usable = input.activeAccountIds.includes(account) || account === input.currentAccountId;
  if (!usable) return { ok: false, error: ACCOUNT_GONE_ERROR };
  return { ok: true, value: { payment_method: "BANK_TRANSFER", bank_account_id: account } };
}

import { parseAmountVn, type ParseResult } from "./cash-entry-rules";

// "from" and "to" are "CASH" (the drawer) or a bank account id.
export interface CashTransferInput {
  transfer_date: string;
  amount: string;
  from: string;
  to: string;
  note: string;
}

export interface CashTransferFields {
  transfer_date: string;
  amount: number;
  // null = the cash drawer
  from_account_id: string | null;
  to_account_id: string | null;
  note: string;
}

export const CASH_END = "CASH";

const DATE_ERROR = "Chọn ngày chuyển";
const SAME_END_ERROR = "Nơi chuyển và nơi nhận phải khác nhau";
const ACCOUNT_GONE_ERROR = "Tài khoản không còn dùng";
const FROM_MISSING_ERROR = "Chọn nơi chuyển";
const TO_MISSING_ERROR = "Chọn nơi nhận";

// "YYYY-MM-DD" that names a real calendar day ("2026-02-30" is not one).
function isRealCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

// One end of a transfer: the drawer, or an account that is still in use.
function parseEnd(
  raw: string,
  missing: string,
  activeAccountIds: string[],
): ParseResult<string | null> {
  if (!raw) return { ok: false, error: missing };
  if (raw === CASH_END) return { ok: true, value: null };
  if (!activeAccountIds.includes(raw)) return { ok: false, error: ACCOUNT_GONE_ERROR };
  return { ok: true, value: raw };
}

export function parseCashTransfer(
  input: CashTransferInput,
  activeAccountIds: string[],
): ParseResult<CashTransferFields> {
  const transfer_date = (input.transfer_date || "").trim();
  if (!isRealCalendarDate(transfer_date)) return { ok: false, error: DATE_ERROR };

  const parsedAmount = parseAmountVn((input.amount || "").trim());
  if (parsedAmount.ok === false) return { ok: false, error: parsedAmount.error };

  const from = (input.from || "").trim();
  const to = (input.to || "").trim();
  // Same place on both sides is refused before asking whether it still exists.
  if (from && from === to) return { ok: false, error: SAME_END_ERROR };

  const fromEnd = parseEnd(from, FROM_MISSING_ERROR, activeAccountIds);
  if (fromEnd.ok === false) return { ok: false, error: fromEnd.error };
  const toEnd = parseEnd(to, TO_MISSING_ERROR, activeAccountIds);
  if (toEnd.ok === false) return { ok: false, error: toEnd.error };

  return {
    ok: true,
    value: {
      transfer_date,
      amount: parsedAmount.value,
      from_account_id: fromEnd.value,
      to_account_id: toEnd.value,
      note: (input.note || "").trim(),
    },
  };
}

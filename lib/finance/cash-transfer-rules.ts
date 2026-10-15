import {
  isRealCalendarDate, parseAmountVn, NOTE_MAX_LENGTH, NOTE_TOO_LONG_ERROR, type ParseResult,
} from "./cash-entry-rules";

// "from" and "to" are "CASH" (the drawer) or a bank account id.
export interface CashTransferInput {
  transfer_date: string;
  amount: string;
  from: string;
  to: string;
  note: string;
}

interface CashTransferFields {
  transfer_date: string;
  amount: number;
  // null = the cash drawer
  from_account_id: string | null;
  to_account_id: string | null;
  note: string;
}

const CASH_END = "CASH";

const DATE_ERROR = "Chọn ngày chuyển";
const SAME_END_ERROR = "Nơi chuyển và nơi nhận phải khác nhau";
const ACCOUNT_GONE_ERROR = "Tài khoản không còn dùng";
const FROM_MISSING_ERROR = "Chọn nơi chuyển";
const TO_MISSING_ERROR = "Chọn nơi nhận";

// One end of a transfer: the drawer, or an allowed account (active, or the
// row's own -- R6).
function parseEnd(
  raw: string,
  missing: string,
  allowedIds: string[],
): ParseResult<string | null> {
  if (!raw) return { ok: false, error: missing };
  if (raw === CASH_END) return { ok: true, value: null };
  if (!allowedIds.includes(raw)) return { ok: false, error: ACCOUNT_GONE_ERROR };
  return { ok: true, value: raw };
}

export function parseCashTransfer(
  input: CashTransferInput,
  allowedAccountIds: string[],
): ParseResult<CashTransferFields> {
  const transfer_date = (input.transfer_date || "").trim();
  if (!isRealCalendarDate(transfer_date)) return { ok: false, error: DATE_ERROR };

  const parsedAmount = parseAmountVn((input.amount || "").trim());
  if (parsedAmount.ok === false) return { ok: false, error: parsedAmount.error };

  const from = (input.from || "").trim();
  const to = (input.to || "").trim();
  // Same place on both sides is refused before asking whether it still exists.
  if (from && from === to) return { ok: false, error: SAME_END_ERROR };

  const fromEnd = parseEnd(from, FROM_MISSING_ERROR, allowedAccountIds);
  if (fromEnd.ok === false) return { ok: false, error: fromEnd.error };
  const toEnd = parseEnd(to, TO_MISSING_ERROR, allowedAccountIds);
  if (toEnd.ok === false) return { ok: false, error: toEnd.error };

  const note = (input.note || "").trim();
  if (note.length > NOTE_MAX_LENGTH) return { ok: false, error: NOTE_TOO_LONG_ERROR };

  return {
    ok: true,
    value: {
      transfer_date,
      amount: parsedAmount.value,
      from_account_id: fromEnd.value,
      to_account_id: toEnd.value,
      note,
    },
  };
}

import { saigonToday } from "@/lib/shared/datetime";
import type { DBCashCategory } from "@/types/db";

export interface CashEntryInput {
  entry_date: string;
  category_id: string;
  amount: string;
  payment_method: string;
  bank_account_id: string;
  note: string;
}

interface CashEntryFields {
  entry_date: string;
  category_id: string;
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  bank_account_id: string | null;
  note: string | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

// BR-CASH-007: balances count from zero on this day, so no row may be older.
export const CASH_BOOK_START = "2026-03-26";
export const NOTE_MAX_LENGTH = 500;
export const NOTE_TOO_LONG_ERROR = `Ghi chú tối đa ${NOTE_MAX_LENGTH} ký tự`;

// "YYYY-MM-DD" that names a real calendar day ("2026-02-30" is not one).
export function isRealCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

const AMOUNT_FORMAT_ERROR =
  "Số tiền chỉ gồm chữ số; dấu phẩy chỉ dùng để chia hàng nghìn (ví dụ 150,000)";
const AMOUNT_NOT_POSITIVE_ERROR = "Số tiền phải lớn hơn 0";
const AMOUNT_TOO_LARGE_ERROR = "Số tiền quá lớn";

// Built with an explicit char code rather than a literal character sitting
// in this source file -- an invisible NBSP here would be exactly the hazard
// lib/shared/duplicate-name-guard.ts avoids the same way.
const NBSP = String.fromCharCode(160);

// Two shapes are legal: digits only, or comma-separated groups of exactly
// three digits (BR-UI-008, owner 2026-10-07: a comma separates thousands, a
// dot marks decimals). Money is whole đồng (BR-CASH-005), so a dot is a
// format error -- "150.000" is refused, never read as 150 or 150000. The
// money box posts plain digits; this is the server backstop. Scientific
// or hex notation and malformed groupings like "1,50,000" are refused too.
export function parseAmountVn(raw: string): ParseResult<number> {
  if (!raw) return { ok: false, error: AMOUNT_NOT_POSITIVE_ERROR };

  const noSpaces = raw.split(" ").join("").split(NBSP).join("");
  let digits: string;
  if (/^\d+$/.test(noSpaces)) {
    digits = noSpaces;
  } else if (/^\d{1,3}(,\d{3})+$/.test(noSpaces)) {
    digits = noSpaces.replace(/,/g, "");
  } else {
    return { ok: false, error: AMOUNT_FORMAT_ERROR };
  }

  const amount = Number(digits);
  if (amount <= 0) return { ok: false, error: AMOUNT_NOT_POSITIVE_ERROR };
  if (!Number.isSafeInteger(amount)) return { ok: false, error: AMOUNT_TOO_LARGE_ERROR };
  return { ok: true, value: amount };
}

// today is the Saigon day; tests pass it, callers take the default.
export function parseCashEntry(
  input: CashEntryInput,
  today: string = saigonToday(),
): ParseResult<CashEntryFields> {
  const entry_date = (input.entry_date || "").trim();
  if (!entry_date) return { ok: false, error: "Chọn ngày ghi sổ" };
  if (!isRealCalendarDate(entry_date)) return { ok: false, error: "Ngày ghi sổ không hợp lệ" };
  if (entry_date > today) return { ok: false, error: "Ngày ghi sổ không được sau hôm nay" };
  if (entry_date < CASH_BOOK_START) {
    return { ok: false, error: "Sổ bắt đầu từ ngày 26/03/2026, không ghi ngày trước đó" };
  }

  const category_id = (input.category_id || "").trim();
  if (!category_id) return { ok: false, error: "Chọn nhóm thu chi" };

  const raw = (input.amount || "").trim();
  const parsedAmount = parseAmountVn(raw);
  if (parsedAmount.ok === false) return { ok: false, error: parsedAmount.error };
  const amount = parsedAmount.value;

  const payment_method = input.payment_method;
  if (payment_method !== "CASH" && payment_method !== "BANK_TRANSFER") {
    return { ok: false, error: "Chọn tiền mặt hoặc chuyển khoản" };
  }
  const chosen = (input.bank_account_id || "").trim();
  // Cash never carries an account. The form hides the field, but a stale value
  // can still arrive from a half-filled form; drop it here so the database
  // check constraint never has to reject the whole write.
  const bank_account_id = payment_method === "BANK_TRANSFER" ? chosen : null;
  if (payment_method === "BANK_TRANSFER" && !bank_account_id) {
    return { ok: false, error: "Chuyển khoản phải chọn tài khoản" };
  }

  const note = (input.note || "").trim() || null;
  if (note && note.length > NOTE_MAX_LENGTH) return { ok: false, error: NOTE_TOO_LONG_ERROR };

  return {
    ok: true,
    value: { entry_date, category_id, amount, payment_method, bank_account_id, note },
  };
}

export const SALES_REVENUE_FLAG_ERROR =
  "Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.";

// BR-CASH-006: only an income category that counts in profit and loss can
// be sales revenue. The form hides the box otherwise; this is the server's
// own check, and migration 0102's check constraint is the third.
export function parseSalesRevenueFlag(
  kind: DBCashCategory["kind"],
  affectsPnl: boolean,
  requested: boolean,
): ParseResult<boolean> {
  if (!requested) return { ok: true, value: false };
  if (kind !== "INCOME" || !affectsPnl) return { ok: false, error: SALES_REVENUE_FLAG_ERROR };
  return { ok: true, value: true };
}

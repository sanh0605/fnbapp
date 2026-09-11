import type { DBCashCategory, DBCashEntry } from "@/types/db";

export interface CashEntryInput {
  entry_date: string;
  category_id: string;
  amount: string;
  payment_method: string;
  bank_account_id: string;
  note: string;
}

export interface CashEntryFields {
  entry_date: string;
  category_id: string;
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  bank_account_id: string | null;
  note: string | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const AMOUNT_FORMAT_ERROR =
  "Số tiền chỉ gồm chữ số; dấu chấm chỉ dùng để chia hàng nghìn (ví dụ 150.000)";
const AMOUNT_NOT_POSITIVE_ERROR = "Số tiền phải lớn hơn 0";
const AMOUNT_TOO_LARGE_ERROR = "Số tiền quá lớn";

// Built with an explicit char code rather than a literal character sitting
// in this source file -- an invisible NBSP here would be exactly the hazard
// lib/shared/duplicate-name-guard.ts avoids the same way.
const NBSP = String.fromCharCode(160);

// I1 (final-review.md): Vietnamese users write thousands with a dot --
// "150.000" means one hundred fifty thousand, not one hundred fifty point
// zero. Plain Number(raw) read "150.000" as 150, a 1000x understatement
// with no warning, and also silently accepted "1e6" and "0x10" as valid
// amounts. Only two shapes are legal now: digits only, or dot-separated
// groups of exactly three digits (the dots are then stripped before
// parsing). Anything else -- a decimal point, a comma, scientific or hex
// notation, a malformed grouping like "1.50.000" -- is a format error, not
// a "too small" one.
function parseAmountVn(raw: string): ParseResult<number> {
  if (!raw) return { ok: false, error: AMOUNT_NOT_POSITIVE_ERROR };

  const noSpaces = raw.split(" ").join("").split(NBSP).join("");
  let digits: string;
  if (/^\d+$/.test(noSpaces)) {
    digits = noSpaces;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(noSpaces)) {
    digits = noSpaces.replace(/\./g, "");
  } else {
    return { ok: false, error: AMOUNT_FORMAT_ERROR };
  }

  const amount = Number(digits);
  if (amount <= 0) return { ok: false, error: AMOUNT_NOT_POSITIVE_ERROR };
  if (!Number.isSafeInteger(amount)) return { ok: false, error: AMOUNT_TOO_LARGE_ERROR };
  return { ok: true, value: amount };
}

export function parseCashEntry(input: CashEntryInput): ParseResult<CashEntryFields> {
  const entry_date = (input.entry_date || "").trim();
  if (!entry_date) return { ok: false, error: "Chọn ngày ghi sổ" };

  const category_id = (input.category_id || "").trim();
  if (!category_id) return { ok: false, error: "Chọn nhóm thu chi" };

  const raw = (input.amount || "").trim();
  const parsedAmount = parseAmountVn(raw);
  if (parsedAmount.ok === false) return { ok: false, error: parsedAmount.error };
  const amount = parsedAmount.value;

  const payment_method = input.payment_method === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH";
  const chosen = (input.bank_account_id || "").trim();
  // Cash never carries an account. The form hides the field, but a stale value
  // can still arrive from a half-filled form; drop it here so the database
  // check constraint never has to reject the whole write.
  const bank_account_id = payment_method === "BANK_TRANSFER" ? chosen : null;
  if (payment_method === "BANK_TRANSFER" && !bank_account_id) {
    return { ok: false, error: "Chuyển khoản phải chọn tài khoản" };
  }

  const note = (input.note || "").trim() || null;

  return {
    ok: true,
    value: { entry_date, category_id, amount, payment_method, bank_account_id, note },
  };
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  kind: "EXPENSE" | "INCOME";
  total: number;
}

export interface CashSummary {
  totalExpense: number;
  totalIncome: number;
  // Income the shop did not earn -- capital contributions today, more later.
  incomeOutsidePnl: number;
  byCategory: CategoryTotal[];
  unknownCategoryIds: string[];
}

export function summariseEntries(
  entries: DBCashEntry[],
  categories: DBCashCategory[],
): CashSummary {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, CategoryTotal>();
  const unknown = new Set<string>();
  let totalExpense = 0;
  let totalIncome = 0;
  let incomeOutsidePnl = 0;

  for (const e of entries) {
    if (e.status !== "ACTIVE") continue;
    const cat = byId.get(e.category_id);
    if (!cat) {
      unknown.add(e.category_id);
      continue;
    }
    if (cat.kind === "EXPENSE") {
      totalExpense += e.amount;
    } else {
      totalIncome += e.amount;
      if (!cat.affects_pnl) incomeOutsidePnl += e.amount;
    }
    const row = totals.get(cat.id);
    if (row) row.total += e.amount;
    else totals.set(cat.id, { categoryId: cat.id, name: cat.name, kind: cat.kind, total: e.amount });
  }

  return {
    totalExpense,
    totalIncome,
    incomeOutsidePnl,
    byCategory: [...totals.values()].sort((a, b) => b.total - a.total),
    unknownCategoryIds: [...unknown],
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

// orphan-allow: pure logic layer for the cash book (so-thu-chi plan, task 2 of 9);
// server actions in a later task import parseCashEntry/summariseEntries.
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

export function parseCashEntry(input: CashEntryInput): ParseResult<CashEntryFields> {
  const entry_date = (input.entry_date || "").trim();
  if (!entry_date) return { ok: false, error: "Chọn ngày ghi sổ" };

  const category_id = (input.category_id || "").trim();
  if (!category_id) return { ok: false, error: "Chọn nhóm thu chi" };

  // Dong has no minor unit, so "1500.5" is not a rounding problem -- it is a
  // number this ledger cannot represent. Reject rather than round.
  const raw = (input.amount || "").trim();
  const amount = Number(raw);
  if (!raw || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Số tiền phải lớn hơn 0" };
  }

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

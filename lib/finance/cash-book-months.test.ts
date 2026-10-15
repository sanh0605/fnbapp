import { describe, expect, it } from "vitest";
import type { DBCashBookDailyRow, DBCashCategory, DBCashEntry, DBCashTransfer } from "@/types/db";
import { summariseCashBookMonths } from "./cash-book-months";

const cat = (id: string, name: string, kind: "INCOME" | "EXPENSE"): DBCashCategory => ({
  id, name, kind, affects_pnl: true, is_sales_revenue: false, status: "ACTIVE",
  created_at: "", created_by_id: null, created_by_name: null,
  updated_at: "", updated_by_id: null, updated_by_name: null,
});
const categories = [cat("C-OP", "Vận hành", "EXPENSE"), cat("C-CAP", "Vốn góp", "INCOME"), cat("C-OTH", "Thu khác", "INCOME")];

const day = (source: "SALE" | "PURCHASE", d: string, method: "CASH" | "BANK_TRANSFER", amount: number): DBCashBookDailyRow =>
  ({ source, day: d, method, bank_account_id: null, doc_count: 1, amount });

const entry = (id: string, d: string, category_id: string, amount: number, bank: boolean): DBCashEntry => ({
  id, entry_date: d, category_id, amount,
  payment_method: bank ? "BANK_TRANSFER" : "CASH", bank_account_id: bank ? "BA-001" : null,
  monthly_item_id: null, note: null, status: "ACTIVE",
  created_at: "", created_by_id: null, created_by_name: null,
  updated_at: "", updated_by_id: null, updated_by_name: null,
});

const transfer: DBCashTransfer = {
  id: "T-1", transfer_date: "2026-08-20", amount: 200, from_account_id: null, to_account_id: "BA-001",
  note: "", status: "ACTIVE", created_at: "", created_by_id: null, created_by_name: null,
  updated_at: "", updated_by_id: null, updated_by_name: null,
};

const input = {
  dayRows: [
    day("SALE", "2026-08-10", "CASH", 1000),
    day("SALE", "2026-08-11", "BANK_TRANSFER", 2000),
    day("PURCHASE", "2026-08-12", "CASH", 300),
    day("SALE", "2026-09-02", "BANK_TRANSFER", 400),
    day("PURCHASE", "2026-09-03", "BANK_TRANSFER", 100),
  ],
  entries: [
    entry("E-1", "2026-08-15", "C-OTH", 500, false),
    entry("E-2", "2026-09-04", "C-OP", 50, false),
    entry("E-3", "2026-09-05", "C-CAP", 700, true),
  ],
  transfers: [transfer],
  categories,
  months: ["2026-08", "2026-09"],
};

describe("summariseCashBookMonths", () => {
  const [aug, sep] = summariseCashBookMonths(input);

  it("returns one entry per requested month, in order", () => {
    expect([aug.month, sep.month]).toEqual(["2026-08", "2026-09"]);
  });

  it("splits a month's flows by side; a transfer moves only Cuối kỳ", () => {
    expect(aug.cash).toEqual({
      opening: 0, salesIncome: 1000, handIncome: [{ key: "C-OTH", name: "Thu khác", total: 500 }],
      purchaseExpense: 300, handExpense: [], closing: 1000,
    });
    expect(aug.bank).toEqual({
      opening: 0, salesIncome: 2000, handIncome: [], purchaseExpense: 0, handExpense: [], closing: 2200,
    });
  });

  it("opens each month on the previous closing, per side", () => {
    expect(sep.cash.opening).toBe(1000);
    expect(sep.bank.opening).toBe(2200);
    expect(sep.cash).toMatchObject({ handExpense: [{ key: "C-OP", name: "Vận hành", total: 50 }], closing: 950 });
    expect(sep.bank).toMatchObject({
      salesIncome: 400, purchaseExpense: 100, handIncome: [{ key: "C-CAP", name: "Vốn góp", total: 700 }], closing: 3200,
    });
  });
});

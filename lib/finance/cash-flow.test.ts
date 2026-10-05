import { describe, expect, it } from "vitest";
import type {
  DBCashBookDailyRow,
  DBCashCategory,
  DBCashEntry,
  DBCashTransfer,
} from "@/types/db";
import { summariseCashBook } from "./cash-flow";

const CAT_EXPENSE: DBCashCategory = {
  id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, is_sales_revenue: false,
  status: "ACTIVE", created_at: "", created_by_id: null, created_by_name: null,
  updated_at: "", updated_by_id: null, updated_by_name: null,
};
const CAT_CAPITAL: DBCashCategory = { ...CAT_EXPENSE, id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false };
const CAT_OTHER_INCOME: DBCashCategory = { ...CAT_EXPENSE, id: "CFC-004", name: "Thu khác", kind: "INCOME", affects_pnl: true };
const CATEGORIES = [CAT_EXPENSE, CAT_CAPITAL, CAT_OTHER_INCOME];

function day(
  source: "SALE" | "PURCHASE", d: string, method: "CASH" | "BANK_TRANSFER", amount: number, docCount = 1,
): DBCashBookDailyRow {
  return { source, day: d, method, bank_account_id: null, doc_count: docCount, amount };
}

function entry(over: Partial<DBCashEntry> & Pick<DBCashEntry, "id" | "entry_date" | "category_id" | "amount">): DBCashEntry {
  return {
    payment_method: "CASH", bank_account_id: null, payer: null, note: null, status: "ACTIVE",
    created_at: "", created_by_id: null, created_by_name: null,
    updated_at: "", updated_by_id: null, updated_by_name: null,
    ...over,
  };
}

function transfer(over: Partial<DBCashTransfer> & Pick<DBCashTransfer, "id" | "transfer_date" | "amount">): DBCashTransfer {
  return {
    from_account_id: null, to_account_id: "BA-001", note: "", status: "ACTIVE",
    created_at: "", created_by_id: null, created_by_name: null,
    updated_at: "", updated_by_id: null, updated_by_name: null,
    ...over,
  };
}

const base = { dayRows: [], entries: [], transfers: [], categories: CATEGORIES, start: "2026-09-01", end: "2026-09-30" };

describe("summariseCashBook movements (spec section 4 table)", () => {
  it("sale in cash adds to the cash side", () => {
    const s = summariseCashBook({ ...base, dayRows: [day("SALE", "2026-09-10", "CASH", 1000)] });
    expect(s.closing).toEqual({ cash: 1000, bank: 0, total: 1000 });
  });

  it("sale by transfer adds to the bank side", () => {
    const s = summariseCashBook({ ...base, dayRows: [day("SALE", "2026-09-10", "BANK_TRANSFER", 2000)] });
    expect(s.closing).toEqual({ cash: 0, bank: 2000, total: 2000 });
  });

  it("purchase in cash takes from the cash side", () => {
    const s = summariseCashBook({ ...base, dayRows: [day("PURCHASE", "2026-09-10", "CASH", 300)] });
    expect(s.closing).toEqual({ cash: -300, bank: 0, total: -300 });
  });

  it("purchase by transfer takes from the bank side", () => {
    const s = summariseCashBook({ ...base, dayRows: [day("PURCHASE", "2026-09-10", "BANK_TRANSFER", 400)] });
    expect(s.closing).toEqual({ cash: 0, bank: -400, total: -400 });
  });

  it("hand income adds to the side of its payment method", () => {
    const s = summariseCashBook({
      ...base,
      entries: [
        entry({ id: "CE-1", entry_date: "2026-09-10", category_id: "CFC-004", amount: 500 }),
        entry({ id: "CE-2", entry_date: "2026-09-10", category_id: "CFC-004", amount: 700, payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }),
      ],
    });
    expect(s.closing).toEqual({ cash: 500, bank: 700, total: 1200 });
  });

  it("hand expense takes from the side of its payment method", () => {
    const s = summariseCashBook({
      ...base,
      entries: [
        entry({ id: "CE-1", entry_date: "2026-09-10", category_id: "CFC-001", amount: 100 }),
        entry({ id: "CE-2", entry_date: "2026-09-10", category_id: "CFC-001", amount: 250, payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }),
      ],
    });
    expect(s.closing).toEqual({ cash: -100, bank: -250, total: -350 });
  });

  it("transfer drawer to bank moves the split, not the total", () => {
    const s = summariseCashBook({
      ...base,
      transfers: [transfer({ id: "CT-1", transfer_date: "2026-09-10", amount: 5_000_000 })],
    });
    expect(s.closing).toEqual({ cash: -5_000_000, bank: 5_000_000, total: 0 });
  });

  it("transfer bank to drawer moves the split the other way", () => {
    const s = summariseCashBook({
      ...base,
      transfers: [transfer({ id: "CT-1", transfer_date: "2026-09-10", amount: 800, from_account_id: "BA-001", to_account_id: null })],
    });
    expect(s.closing).toEqual({ cash: 800, bank: -800, total: 0 });
  });
});

describe("summariseCashBook range rules", () => {
  it("opening counts days before start; closing counts days up to and including end", () => {
    const s = summariseCashBook({
      ...base,
      dayRows: [
        day("SALE", "2026-08-31", "CASH", 100), // opening
        day("SALE", "2026-09-01", "CASH", 10), // first day: in range, not opening
        day("SALE", "2026-09-30", "CASH", 1), // last day: counts
        day("SALE", "2026-10-01", "CASH", 9999), // after end: ignored
      ],
    });
    expect(s.opening.cash).toBe(100);
    expect(s.closing.cash).toBe(111);
    expect(s.totals.salesIncome).toBe(11);
  });

  it("cancelled hand rows and cancelled transfers count nowhere, before or inside the range", () => {
    const s = summariseCashBook({
      ...base,
      entries: [
        entry({ id: "CE-1", entry_date: "2026-08-15", category_id: "CFC-004", amount: 1000, status: "CANCELLED" }),
        entry({ id: "CE-2", entry_date: "2026-09-15", category_id: "CFC-004", amount: 2000, status: "CANCELLED" }),
      ],
      transfers: [
        transfer({ id: "CT-1", transfer_date: "2026-08-20", amount: 3000, status: "CANCELLED" }),
        transfer({ id: "CT-2", transfer_date: "2026-09-20", amount: 4000, status: "CANCELLED" }),
      ],
    });
    expect(s.opening).toEqual({ cash: 0, bank: 0, total: 0 });
    expect(s.closing).toEqual({ cash: 0, bank: 0, total: 0 });
    expect(s.totals.totalIncome).toBe(0);
  });

  it("a 5.000.000 transfer cash to BA-001 leaves total, Tong thu and Tong chi unchanged", () => {
    const common = { ...base, dayRows: [day("SALE", "2026-09-05", "CASH", 9_000_000)] };
    const without = summariseCashBook(common);
    const withTransfer = summariseCashBook({
      ...common,
      transfers: [transfer({ id: "CT-1", transfer_date: "2026-09-10", amount: 5_000_000 })],
    });
    expect(withTransfer.closing.cash).toBe(without.closing.cash - 5_000_000);
    expect(withTransfer.closing.bank).toBe(without.closing.bank + 5_000_000);
    expect(withTransfer.closing.total).toBe(without.closing.total);
    expect(withTransfer.totals.totalIncome).toBe(without.totals.totalIncome);
    expect(withTransfer.totals.totalExpense).toBe(without.totals.totalExpense);
  });

  it("a range before any data has zero opening and zero closing", () => {
    const s = summariseCashBook({
      ...base,
      start: "2026-01-01",
      end: "2026-02-28",
      dayRows: [day("SALE", "2026-09-10", "CASH", 500)],
      entries: [entry({ id: "CE-1", entry_date: "2026-09-10", category_id: "CFC-004", amount: 5 })],
    });
    expect(s.opening).toEqual({ cash: 0, bank: 0, total: 0 });
    expect(s.closing).toEqual({ cash: 0, bank: 0, total: 0 });
  });

  it("a range ending in the future counts only what exists", () => {
    const s = summariseCashBook({
      ...base,
      start: "2026-09-01",
      end: "2099-12-31",
      dayRows: [day("SALE", "2026-09-10", "CASH", 500)],
    });
    expect(s.closing.cash).toBe(500);
  });

  it("closing total equals opening total plus Tong thu minus Tong chi on a mixed fixture", () => {
    const s = summariseCashBook({
      ...base,
      dayRows: [
        day("SALE", "2026-08-10", "CASH", 7000),
        day("PURCHASE", "2026-08-11", "BANK_TRANSFER", 1200),
        day("SALE", "2026-09-02", "CASH", 3000),
        day("SALE", "2026-09-03", "BANK_TRANSFER", 2500),
        day("PURCHASE", "2026-09-04", "CASH", 900),
        day("PURCHASE", "2026-09-05", "BANK_TRANSFER", 450),
      ],
      entries: [
        entry({ id: "CE-1", entry_date: "2026-09-06", category_id: "CFC-005", amount: 4000 }),
        entry({ id: "CE-2", entry_date: "2026-09-07", category_id: "CFC-001", amount: 600, payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }),
        entry({ id: "CE-3", entry_date: "2026-08-20", category_id: "CFC-001", amount: 50 }),
      ],
      transfers: [transfer({ id: "CT-1", transfer_date: "2026-09-08", amount: 1500 })],
    });
    expect(s.closing.total).toBe(s.opening.total + s.totals.totalIncome - s.totals.totalExpense);
    expect(s.closing.cash + s.closing.bank).toBe(s.closing.total);
  });

  it("a hand row with an unknown category counts in neither balance nor totals and is listed", () => {
    const s = summariseCashBook({
      ...base,
      dayRows: [day("SALE", "2026-09-02", "CASH", 1000)],
      entries: [
        entry({ id: "CE-1", entry_date: "2026-08-02", category_id: "CFC-999", amount: 77 }),
        entry({ id: "CE-2", entry_date: "2026-09-02", category_id: "CFC-999", amount: 88 }),
      ],
    });
    expect(s.unknownCategoryIds).toEqual(["CFC-999"]);
    expect(s.opening.total).toBe(0);
    expect(s.closing.total).toBe(1000);
    expect(s.totals.handIncome + s.totals.handExpense).toBe(0);
    expect(s.closing.total).toBe(s.opening.total + s.totals.totalIncome - s.totals.totalExpense);
  });

  it("lists SALE and PURCHASE beside the categories in byGroup, from in-range rows only", () => {
    const s = summariseCashBook({
      ...base,
      dayRows: [
        day("SALE", "2026-08-30", "CASH", 999), // before range: not in byGroup
        day("SALE", "2026-09-02", "CASH", 1000),
        day("SALE", "2026-09-03", "BANK_TRANSFER", 500),
        day("PURCHASE", "2026-09-04", "CASH", 300),
      ],
      entries: [entry({ id: "CE-1", entry_date: "2026-09-06", category_id: "CFC-001", amount: 40 })],
    });
    expect(s.byGroup).toEqual([
      { key: "SALE", name: "Bán hàng", side: "INCOME", total: 1500 },
      { key: "PURCHASE", name: "Nhập hàng", side: "EXPENSE", total: 300 },
      { key: "CFC-001", name: "Vận hành", side: "EXPENSE", total: 40 },
    ]);
  });
});

describe("summariseCashBook, September 2026 fixture (measured 2026-10-04)", () => {
  const s = summariseCashBook({
    start: "2026-09-01",
    end: "2026-09-30",
    categories: CATEGORIES,
    dayRows: [
      // Before the range: sums to cash -10.341.000 and bank 23.756.578.
      day("SALE", "2026-08-31", "CASH", 5_000_000),
      day("PURCHASE", "2026-08-31", "CASH", 15_341_000),
      day("SALE", "2026-08-31", "BANK_TRANSFER", 30_000_000),
      day("PURCHASE", "2026-08-31", "BANK_TRANSFER", 6_243_422),
      // In the range.
      day("SALE", "2026-09-15", "CASH", 11_226_000, 465),
      day("SALE", "2026-09-16", "BANK_TRANSFER", 4_216_000, 159),
      day("PURCHASE", "2026-09-15", "CASH", 9_043_287, 25),
    ],
    entries: [
      entry({ id: "CE-040", entry_date: "2026-09-02", category_id: "CFC-005", amount: 2_443_400 }),
      entry({ id: "CE-041", entry_date: "2026-09-03", category_id: "CFC-001", amount: 1_637_000 }),
    ],
    transfers: [],
  });

  it("opening balances", () => {
    expect(s.opening).toEqual({ cash: -10_341_000, bank: 23_756_578, total: 13_415_578 });
  });

  it("closing balances", () => {
    expect(s.closing).toEqual({ cash: -7_351_887, bank: 27_972_578, total: 20_620_691 });
  });

  it("totals", () => {
    expect(s.totals.salesIncome).toBe(15_442_000);
    expect(s.totals.purchaseExpense).toBe(9_043_287);
    expect(s.totals.handIncome).toBe(2_443_400);
    expect(s.totals.handExpense).toBe(1_637_000);
    expect(s.totals.totalIncome).toBe(17_885_400);
    expect(s.totals.totalExpense).toBe(10_680_287);
    expect(s.totals.incomeOutsidePnl).toBe(2_443_400);
  });

  it("identity: 13.415.578 + 17.885.400 - 10.680.287 = 20.620.691", () => {
    expect(s.opening.total + s.totals.totalIncome - s.totals.totalExpense).toBe(s.closing.total);
  });
});

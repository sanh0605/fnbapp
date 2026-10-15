import type { DBCashBookDailyRow, DBCashCategory, DBCashEntry, DBCashTransfer } from "@/types/db";
import { summariseCashBook } from "./cash-flow";

interface GroupTotal {
  key: string;
  name: string;
  total: number;
}

// One side (cash drawer or bank) of one month. Hand rows are by group.
export interface MonthSide {
  opening: number;
  salesIncome: number;
  handIncome: GroupTotal[];
  purchaseExpense: number;
  handExpense: GroupTotal[];
  closing: number;
}

export interface CashBookMonth {
  month: string; // "YYYY-MM"
  cash: MonthSide;
  bank: MonthSide;
}

// A month's Đầu kỳ / Cuối kỳ come from the whole book; the flows come from the
// same rows filtered to one payment method, with transfers left out (they are in
// no flow, BR-CASH-008).
export function summariseCashBookMonths(input: {
  dayRows: DBCashBookDailyRow[];
  entries: DBCashEntry[];
  transfers: DBCashTransfer[];
  categories: DBCashCategory[];
  months: string[];
}): CashBookMonth[] {
  return input.months.map((month) => {
    const lastDay = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
    const range = { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}`, categories: input.categories };
    const book = summariseCashBook({ ...range, dayRows: input.dayRows, entries: input.entries, transfers: input.transfers });

    const side = (method: "CASH" | "BANK_TRANSFER", balance: "cash" | "bank"): MonthSide => {
      const s = summariseCashBook({
        ...range,
        dayRows: input.dayRows.filter((r) => r.method === method),
        entries: input.entries.filter((e) => e.payment_method === method),
        transfers: [],
      });
      const groups = (kind: "INCOME" | "EXPENSE") =>
        s.byGroup.filter((g) => g.side === kind && g.key !== "SALE" && g.key !== "PURCHASE").map(({ key, name, total }) => ({ key, name, total }));
      return {
        opening: book.opening[balance],
        salesIncome: s.totals.salesIncome,
        handIncome: groups("INCOME"),
        purchaseExpense: s.totals.purchaseExpense,
        handExpense: groups("EXPENSE"),
        closing: book.closing[balance],
      };
    };
    return { month, cash: side("CASH", "cash"), bank: side("BANK_TRANSFER", "bank") };
  });
}

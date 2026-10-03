import type {
  DBCashBookDailyRow,
  DBCashCategory,
  DBCashEntry,
  DBCashTransfer,
} from "@/types/db";

export interface Balance {
  cash: number;
  bank: number;
  total: number;
}

export interface CashBookTotals {
  // Transfers between drawer and bank are in neither total (BR-CASH-008).
  totalIncome: number;
  totalExpense: number;
  salesIncome: number;
  purchaseExpense: number;
  handIncome: number;
  handExpense: number;
  incomeOutsidePnl: number;
}

export interface CashBookSummary {
  opening: Balance;
  closing: Balance;
  totals: CashBookTotals;
  // "SALE" / "PURCHASE" keys, then category ids.
  byGroup: { key: string; name: string; side: "INCOME" | "EXPENSE"; total: number }[];
  unknownCategoryIds: string[];
}

type Side = "CASH" | "BANK";

// One money movement: a day ("YYYY-MM-DD"), the side it touches and a signed
// whole-dong amount. Everything in the book is reduced to this shape first.
interface Movement {
  day: string;
  side: Side;
  amount: number;
}

// Only an explicit cash method is cash; anything else reads as the bank side.
function sideOf(method: string | null | undefined): Side {
  return method === "CASH" ? "CASH" : "BANK";
}

function emptyBalance(): Balance {
  return { cash: 0, bank: 0, total: 0 };
}

function addTo(balance: Balance, m: Movement): void {
  if (m.side === "CASH") balance.cash += m.amount;
  else balance.bank += m.amount;
  balance.total += m.amount;
}

export function summariseCashBook(input: {
  dayRows: DBCashBookDailyRow[];
  entries: DBCashEntry[];
  transfers: DBCashTransfer[];
  categories: DBCashCategory[];
  start: string;
  end: string;
}): CashBookSummary {
  const { start, end } = input;
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));

  const opening = emptyBalance();
  const closing = emptyBalance();
  const totals: CashBookTotals = {
    totalIncome: 0,
    totalExpense: 0,
    salesIncome: 0,
    purchaseExpense: 0,
    handIncome: 0,
    handExpense: 0,
    incomeOutsidePnl: 0,
  };
  const unknown = new Set<string>();
  const categoryTotals = new Map<string, { name: string; side: "INCOME" | "EXPENSE"; total: number }>();

  // Rows after the range's last day count nowhere; rows before its first day
  // feed the opening balance; the rest also feed the totals.
  function book(m: Movement): boolean {
    if (m.day > end) return false;
    addTo(closing, m);
    if (m.day < start) addTo(opening, m);
    return m.day >= start;
  }

  for (const row of input.dayRows) {
    const sign = row.source === "SALE" ? 1 : -1;
    const inRange = book({ day: row.day, side: sideOf(row.method), amount: sign * row.amount });
    if (!inRange) continue;
    if (row.source === "SALE") totals.salesIncome += row.amount;
    else totals.purchaseExpense += row.amount;
  }

  for (const e of input.entries) {
    if (e.status !== "ACTIVE") continue;
    const category = categoryById.get(e.category_id);
    if (!category) {
      unknown.add(e.category_id);
      continue;
    }
    const income = category.kind === "INCOME";
    const inRange = book({
      day: e.entry_date,
      side: sideOf(e.payment_method),
      amount: income ? e.amount : -e.amount,
    });
    if (!inRange) continue;
    if (income) {
      totals.handIncome += e.amount;
      if (!category.affects_pnl) totals.incomeOutsidePnl += e.amount;
    } else {
      totals.handExpense += e.amount;
    }
    const group = categoryTotals.get(category.id);
    if (group) group.total += e.amount;
    else categoryTotals.set(category.id, { name: category.name, side: category.kind, total: e.amount });
  }

  for (const t of input.transfers) {
    if (t.status !== "ACTIVE") continue;
    // null is the cash drawer; any account id is the bank side.
    book({ day: t.transfer_date, side: t.from_account_id === null ? "CASH" : "BANK", amount: -t.amount });
    book({ day: t.transfer_date, side: t.to_account_id === null ? "CASH" : "BANK", amount: t.amount });
  }

  totals.totalIncome = totals.salesIncome + totals.handIncome;
  totals.totalExpense = totals.purchaseExpense + totals.handExpense;

  const byGroup: CashBookSummary["byGroup"] = [];
  if (totals.salesIncome > 0) {
    byGroup.push({ key: "SALE", name: "Bán hàng", side: "INCOME", total: totals.salesIncome });
  }
  if (totals.purchaseExpense > 0) {
    byGroup.push({ key: "PURCHASE", name: "Nhập hàng", side: "EXPENSE", total: totals.purchaseExpense });
  }
  const categoryGroups = [...categoryTotals.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.total - a.total);
  byGroup.push(...categoryGroups);

  return { opening, closing, totals, byGroup, unknownCategoryIds: [...unknown] };
}

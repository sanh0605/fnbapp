import { toSaigonIsoString } from "@/lib/shared/datetime";

// Pure comparison logic of scripts/verify-cash-book.ts. The independent side
// below deliberately shares nothing with the app's own path: it does not use
// the cash_book_daily view, lib/finance/cash-flow.ts, or any day grouping. It
// walks every raw record and adds its signed amount to a month-end figure.

export interface Figures {
  cash: number;
  bank: number;
  total: number;
}

export interface RawCashBook {
  orders: { id: string; status: string; created_at: string; net_total: number; payment_method: string | null }[];
  payments: { order_id: string; method: string; amount: number }[];
  purchaseOrders: {
    id: string; status: string; transaction_date: string | null; created_at: string;
    total_amount: number; payment_method: string | null;
  }[];
  entries: { entry_date: string; category_id: string; amount: number; payment_method: string; status: string }[];
  transfers: {
    transfer_date: string; amount: number; from_account_id: string | null; to_account_id: string | null; status: string;
  }[];
  categories: { id: string; kind: string }[];
}

export interface Difference {
  monthEnd: string;
  figure: "cash" | "bank" | "total";
  app: number;
  independent: number;
}

export interface Comparison {
  months: number;
  differences: Difference[];
}

function saigonDay(timestamp: string): string {
  return toSaigonIsoString(new Date(timestamp)).slice(0, 10);
}

// Last day of each month from firstMonth ("YYYY-MM") through the month that
// contains throughDay.
export function monthEnds(firstMonth: string, throughDay: string): string[] {
  const ends: string[] = [];
  let [year, month] = firstMonth.split("-").map(Number);
  const lastMonth = throughDay.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > lastMonth) break;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    ends.push(`${key}-${String(lastDay).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return ends;
}

interface Move {
  day: string;
  side: "cash" | "bank";
  amount: number;
}

// A missing method reads as cash, as the order list does.
function sideOf(method: string | null): "cash" | "bank" {
  return method === "BANK_TRANSFER" ? "bank" : "cash";
}

function collectMoves(raw: RawCashBook): Move[] {
  const moves: Move[] = [];
  const paymentsByOrder = new Map<string, RawCashBook["payments"]>();
  for (const p of raw.payments) {
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push(p);
    paymentsByOrder.set(p.order_id, list);
  }

  for (const o of raw.orders) {
    if (o.status !== "COMPLETED") continue;
    const day = saigonDay(o.created_at);
    const payments = paymentsByOrder.get(o.id);
    if (payments && payments.length > 0) {
      for (const p of payments) moves.push({ day, side: sideOf(p.method), amount: Number(p.amount) });
    } else {
      moves.push({ day, side: sideOf(o.payment_method), amount: Number(o.net_total) });
    }
  }

  for (const po of raw.purchaseOrders) {
    if (po.status !== "COMPLETED") continue;
    moves.push({
      day: saigonDay(po.transaction_date ?? po.created_at),
      side: sideOf(po.payment_method),
      amount: -Number(po.total_amount),
    });
  }

  const kindOf = new Map(raw.categories.map((c) => [c.id, c.kind]));
  for (const e of raw.entries) {
    if (e.status !== "ACTIVE") continue;
    const kind = kindOf.get(e.category_id);
    if (!kind) continue; // unknown category counts nowhere, as in the app
    moves.push({ day: e.entry_date, side: sideOf(e.payment_method), amount: kind === "INCOME" ? e.amount : -e.amount });
  }

  for (const t of raw.transfers) {
    if (t.status !== "ACTIVE") continue;
    moves.push({ day: t.transfer_date, side: t.from_account_id === null ? "cash" : "bank", amount: -t.amount });
    moves.push({ day: t.transfer_date, side: t.to_account_id === null ? "cash" : "bank", amount: t.amount });
  }
  return moves;
}

// Closing figures at the end of each given day: every record on or before it.
export function independentClosings(raw: RawCashBook, ends: string[]): Map<string, Figures> {
  const moves = collectMoves(raw);
  const result = new Map<string, Figures>();
  for (const end of ends) {
    const f: Figures = { cash: 0, bank: 0, total: 0 };
    for (const m of moves) {
      if (m.day > end) continue;
      f[m.side] += m.amount;
      f.total += m.amount;
    }
    result.set(end, f);
  }
  return result;
}

export function compareClosings(app: Map<string, Figures>, independent: Map<string, Figures>): Comparison {
  const monthEndsSeen = new Set([...app.keys(), ...independent.keys()]);
  const differences: Difference[] = [];
  for (const monthEnd of [...monthEndsSeen].sort()) {
    const a = app.get(monthEnd);
    const b = independent.get(monthEnd);
    for (const figure of ["cash", "bank", "total"] as const) {
      // A month only one side has is a difference, not a skipped month.
      const appValue = a ? a[figure] : Number.NaN;
      const indValue = b ? b[figure] : Number.NaN;
      if (appValue !== indValue) differences.push({ monthEnd, figure, app: appValue, independent: indValue });
    }
  }
  return { months: monthEndsSeen.size, differences };
}

export function describeResult(c: Comparison): string {
  const head = `${c.differences.length} lệch trên ${c.months} tháng × 3 số`;
  if (c.differences.length === 0) return head;
  const lines = c.differences.map((d) => `  ${d.monthEnd} ${d.figure}: sổ ${d.app} / tính độc lập ${d.independent}`);
  return [head, ...lines].join("\n");
}

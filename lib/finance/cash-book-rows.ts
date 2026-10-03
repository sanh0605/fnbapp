import type {
  DBBankAccount,
  DBCashBookDailyRow,
  DBCashCategory,
  DBCashEntry,
  DBCashTransfer,
} from "@/types/db";

export type CashBookRowKind = "SALE" | "PURCHASE" | "HAND" | "TRANSFER";

export interface CashBookRow {
  key: string; // unique: "SALE:2026-09-15:CASH", "CE-040", "CT-001"
  kind: CashBookRowKind;
  id: string | null; // null for day rows
  date: string; // "YYYY-MM-DD"
  groupLabel: string; // "Bán hàng" | "Nhập hàng" | category name | "Chuyển tiền"
  sideLabel: "Thu" | "Chi" | "Chuyển";
  amount: number;
  methodLabel: string; // "Tiền mặt" | "Chuyển khoản" | "Két → ACB - Phin Di"
  accountLabel: string; // "—" when none
  note: string; // "23 đơn", "2 đơn nhập", hand note, transfer note
  creator: string; // "—" for day rows
  status: "ACTIVE" | "CANCELLED";
  href: string; // no returnTo; the client appends it for HAND and TRANSFER
}

const NONE = "—";
const DRAWER = "Két";

function methodText(method: string): string {
  return method === "CASH" ? "Tiền mặt" : "Chuyển khoản";
}

// An account that is no longer in the list still shows its id, never a blank.
function accountText(id: string | null, names: Map<string, string>): string {
  if (!id) return NONE;
  return names.get(id) ?? id;
}

function endText(id: string | null, names: Map<string, string>): string {
  return id === null ? DRAWER : (names.get(id) ?? id);
}

// The two order lists read their own filter words: the order list takes
// "Tien mat" / "Chuyen khoan" (app/admin/orders/actions.ts), the purchase
// order list takes the stored method.
function dayRowHref(row: DBCashBookDailyRow): string {
  const range = `from=${row.day}&to=${row.day}`;
  if (row.source === "SALE") {
    const payment = row.method === "CASH" ? "Tien%20mat" : "Chuyen%20khoan";
    return `/admin/orders?${range}&payment=${payment}`;
  }
  return `/admin/inventory/purchase-orders?${range}&pay=${row.method === "CASH" ? "CASH" : "BANK_TRANSFER"}`;
}

export function buildCashBookRows(input: {
  dayRows: DBCashBookDailyRow[];
  entries: DBCashEntry[];
  transfers: DBCashTransfer[];
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
}): CashBookRow[] {
  const accountNames = new Map(input.accounts.map((a) => [a.id, a.name]));
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const rows: CashBookRow[] = [];

  for (const d of input.dayRows) {
    const isSale = d.source === "SALE";
    rows.push({
      // Purchases are split per account, so the account is part of the key.
      key: isSale
        ? `SALE:${d.day}:${d.method}`
        : `PURCHASE:${d.day}:${d.method}:${d.bank_account_id ?? "-"}`,
      kind: isSale ? "SALE" : "PURCHASE",
      id: null,
      date: d.day,
      groupLabel: isSale ? "Bán hàng" : "Nhập hàng",
      sideLabel: isSale ? "Thu" : "Chi",
      amount: d.amount,
      methodLabel: methodText(d.method),
      accountLabel: accountText(d.bank_account_id, accountNames),
      note: isSale ? `${d.doc_count} đơn` : `${d.doc_count} đơn nhập`,
      creator: NONE,
      status: "ACTIVE",
      href: dayRowHref(d),
    });
  }

  for (const e of input.entries) {
    const category = categoryById.get(e.category_id);
    rows.push({
      key: e.id,
      kind: "HAND",
      id: e.id,
      date: e.entry_date,
      groupLabel: category?.name ?? NONE,
      sideLabel: category?.kind === "INCOME" ? "Thu" : "Chi",
      amount: e.amount,
      methodLabel: methodText(e.payment_method),
      accountLabel: accountText(e.bank_account_id, accountNames),
      note: e.note ?? "",
      creator: e.created_by_name ?? NONE,
      status: e.status,
      href: `/admin/finance/${e.id}`,
    });
  }

  for (const t of input.transfers) {
    rows.push({
      key: t.id,
      kind: "TRANSFER",
      id: t.id,
      date: t.transfer_date,
      groupLabel: "Chuyển tiền",
      sideLabel: "Chuyển",
      amount: t.amount,
      methodLabel: `${endText(t.from_account_id, accountNames)} → ${endText(t.to_account_id, accountNames)}`,
      accountLabel: NONE,
      note: t.note,
      creator: t.created_by_name ?? NONE,
      status: t.status,
      href: `/admin/finance/transfers/${t.id}`,
    });
  }

  // Newest day first; Array.prototype.sort is stable, so a day keeps the given
  // order (day rows, then hand rows, then transfers).
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

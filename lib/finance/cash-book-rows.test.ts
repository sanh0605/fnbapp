import { describe, expect, it } from "vitest";
import type {
  DBBankAccount,
  DBCashBookDailyRow,
  DBCashCategory,
  DBCashEntry,
  DBCashTransfer,
} from "@/types/db";
import { buildCashBookRows } from "./cash-book-rows";

const ACCOUNTS: DBBankAccount[] = [
  {
    id: "BA-001", name: "ACB - Phin Di", bank_name: null, account_number: null, status: "ACTIVE",
    created_at: "", created_by_id: null, created_by_name: null,
    updated_at: "", updated_by_id: null, updated_by_name: null,
  },
];
const CATEGORIES: DBCashCategory[] = [
  {
    id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, is_sales_revenue: false, status: "ACTIVE",
    created_at: "", created_by_id: null, created_by_name: null,
    updated_at: "", updated_by_id: null, updated_by_name: null,
  },
  {
    id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, is_sales_revenue: false, status: "ACTIVE",
    created_at: "", created_by_id: null, created_by_name: null,
    updated_at: "", updated_by_id: null, updated_by_name: null,
  },
];

// The three day rows of 15/09/2026 exactly as measured on 2026-10-04.
const DAY_ROWS: DBCashBookDailyRow[] = [
  { source: "SALE", day: "2026-09-15", method: "CASH", bank_account_id: null, doc_count: 23, amount: 522000 },
  { source: "SALE", day: "2026-09-15", method: "BANK_TRANSFER", bank_account_id: null, doc_count: 11, amount: 482000 },
  { source: "PURCHASE", day: "2026-09-15", method: "CASH", bank_account_id: null, doc_count: 2, amount: 536023 },
];

const ENTRY: DBCashEntry = {
  id: "CE-040", entry_date: "2026-09-02", category_id: "CFC-005", amount: 2443400,
  payment_method: "CASH", bank_account_id: null, payer: null, note: "Vốn góp thêm", status: "ACTIVE",
  created_at: "", created_by_id: "u1", created_by_name: "Chủ quán",
  updated_at: "", updated_by_id: null, updated_by_name: null,
};

const TRANSFER: DBCashTransfer = {
  id: "CT-001", transfer_date: "2026-09-10", amount: 5000000,
  from_account_id: null, to_account_id: "BA-001", note: "Gửi két vào ngân hàng", status: "ACTIVE",
  created_at: "", created_by_id: "u1", created_by_name: "Chủ quán",
  updated_at: "", updated_by_id: null, updated_by_name: null,
};

function build(over: Partial<Parameters<typeof buildCashBookRows>[0]> = {}) {
  return buildCashBookRows({
    dayRows: DAY_ROWS, entries: [ENTRY], transfers: [TRANSFER], categories: CATEGORIES, accounts: ACCOUNTS, ...over,
  });
}

describe("buildCashBookRows", () => {
  it("builds the three day rows of 15/09/2026 with exact labels and hrefs", () => {
    const rows = build({ entries: [], transfers: [] });
    expect(rows).toEqual([
      {
        key: "SALE:2026-09-15:CASH", kind: "SALE", id: null, date: "2026-09-15",
        groupLabel: "Bán hàng", sideLabel: "Thu", amount: 522000, methodLabel: "Tiền mặt",
        accountLabel: "—", note: "23 đơn", creator: "—", status: "ACTIVE",
        href: "/admin/orders?from=2026-09-15&to=2026-09-15&payment=Tien%20mat",
      },
      {
        key: "SALE:2026-09-15:BANK_TRANSFER", kind: "SALE", id: null, date: "2026-09-15",
        groupLabel: "Bán hàng", sideLabel: "Thu", amount: 482000, methodLabel: "Chuyển khoản",
        accountLabel: "—", note: "11 đơn", creator: "—", status: "ACTIVE",
        href: "/admin/orders?from=2026-09-15&to=2026-09-15&payment=Chuyen%20khoan",
      },
      {
        key: "PURCHASE:2026-09-15:CASH:-", kind: "PURCHASE", id: null, date: "2026-09-15",
        groupLabel: "Nhập hàng", sideLabel: "Chi", amount: 536023, methodLabel: "Tiền mặt",
        accountLabel: "—", note: "2 đơn nhập", creator: "—", status: "ACTIVE",
        href: "/admin/inventory/purchase-orders?from=2026-09-15&to=2026-09-15&pay=CASH",
      },
    ]);
  });

  it("names the account on a purchase paid by transfer and keeps two accounts as two rows", () => {
    const dayRows: DBCashBookDailyRow[] = [
      { source: "PURCHASE", day: "2026-09-16", method: "BANK_TRANSFER", bank_account_id: "BA-001", doc_count: 1, amount: 100 },
      { source: "PURCHASE", day: "2026-09-16", method: "BANK_TRANSFER", bank_account_id: "BA-009", doc_count: 1, amount: 200 },
    ];
    const rows = build({ dayRows, entries: [], transfers: [] });
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    const known = rows.find((r) => r.key.endsWith("BA-001"))!;
    expect(known.accountLabel).toBe("ACB - Phin Di");
    expect(known.methodLabel).toBe("Chuyển khoản");
    expect(known.href).toBe("/admin/inventory/purchase-orders?from=2026-09-16&to=2026-09-16&pay=BANK_TRANSFER");
    // An account no longer in the list still shows its id rather than a blank.
    expect(rows.find((r) => r.key.endsWith("BA-009"))!.accountLabel).toBe("BA-009");
  });

  it("builds a hand row with its category, side, creator and detail link", () => {
    const row = build({ dayRows: [], transfers: [] })[0];
    expect(row).toEqual({
      key: "CE-040", kind: "HAND", id: "CE-040", date: "2026-09-02",
      groupLabel: "Vốn góp", sideLabel: "Thu", amount: 2443400, methodLabel: "Tiền mặt",
      accountLabel: "—", note: "Vốn góp thêm", creator: "Chủ quán", status: "ACTIVE",
      href: "/admin/finance/CE-040",
    });
  });

  it("builds a hand expense and a hand row paid by transfer with the account name", () => {
    const expense: DBCashEntry = {
      ...ENTRY, id: "CE-041", category_id: "CFC-001", payment_method: "BANK_TRANSFER", bank_account_id: "BA-001", note: null,
    };
    const row = build({ dayRows: [], transfers: [], entries: [expense] })[0];
    expect(row.sideLabel).toBe("Chi");
    expect(row.methodLabel).toBe("Chuyển khoản");
    expect(row.accountLabel).toBe("ACB - Phin Di");
    expect(row.note).toBe("");
  });

  it("builds a transfer from the cash drawer to BA-001 as 'Két → ACB - Phin Di'", () => {
    const row = build({ dayRows: [], entries: [] })[0];
    expect(row).toEqual({
      key: "CT-001", kind: "TRANSFER", id: "CT-001", date: "2026-09-10",
      groupLabel: "Chuyển tiền", sideLabel: "Chuyển", amount: 5000000, methodLabel: "Két → ACB - Phin Di",
      accountLabel: "—", note: "Gửi két vào ngân hàng", creator: "Chủ quán", status: "ACTIVE",
      href: "/admin/finance/transfers/CT-001",
    });
  });

  it("reads a transfer from the bank back to the drawer, and keeps CANCELLED status", () => {
    const back: DBCashTransfer = { ...TRANSFER, from_account_id: "BA-001", to_account_id: null, status: "CANCELLED" };
    const row = build({ dayRows: [], entries: [], transfers: [back] })[0];
    expect(row.methodLabel).toBe("ACB - Phin Di → Két");
    expect(row.status).toBe("CANCELLED");
  });

  it("sorts newest date first and keeps the given order within a day", () => {
    const rows = build();
    expect(rows.map((r) => r.date)).toEqual(["2026-09-15", "2026-09-15", "2026-09-15", "2026-09-10", "2026-09-02"]);
  });

  it("never gives a day row a delete id", () => {
    for (const r of build().filter((x) => x.kind === "SALE" || x.kind === "PURCHASE")) expect(r.id).toBeNull();
  });
});

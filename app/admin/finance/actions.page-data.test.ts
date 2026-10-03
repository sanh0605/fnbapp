import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAllWhere: vi.fn(),
  getCashCategories: vi.fn(),
  getBankAccounts: vi.fn(),
  getCashTransfers: vi.fn(),
  readCashBookDaily: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAllWhere: mocks.findAllWhere,
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./categories/actions", () => ({ getCashCategories: mocks.getCashCategories }));
vi.mock("./bank-accounts/actions", () => ({ getBankAccounts: mocks.getBankAccounts }));
vi.mock("./transfers/actions", () => ({ getCashTransfers: mocks.getCashTransfers }));
vi.mock("@/lib/finance/cash-book-daily", () => ({ readCashBookDaily: mocks.readCashBookDaily }));

import { getFinancePageData } from "./actions";

const CATEGORIES = [
  { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
  { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, status: "ACTIVE" },
];

function entry(id: string, entry_date: string, category_id: string, amount: number) {
  return {
    id, entry_date, category_id, amount, payment_method: "CASH", bank_account_id: null,
    payer: null, note: null, status: "ACTIVE", created_by_name: "Chủ quán",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "u1", name: "Chủ quán", role: "ADMIN" } });
  mocks.getCashCategories.mockResolvedValue(CATEGORIES);
  mocks.getBankAccounts.mockResolvedValue([]);
  mocks.getCashTransfers.mockResolvedValue([]);
  mocks.readCashBookDaily.mockResolvedValue([]);
  mocks.findAllWhere.mockResolvedValue([]);
});

describe("getFinancePageData", () => {
  it("asks for hand rows through the end day with no lower bound", async () => {
    await getFinancePageData("2026-09-01", "2026-09-30");
    expect(mocks.findAllWhere).toHaveBeenCalledWith("Cash_Entries", { lte: { entry_date: "2026-09-30" } });
  });

  it("asks for transfers and day rows through the end day", async () => {
    await getFinancePageData("2026-09-01", "2026-09-30");
    expect(mocks.getCashTransfers).toHaveBeenCalledWith("2026-09-30");
    expect(mocks.readCashBookDaily).toHaveBeenCalledWith("2026-09-30");
  });

  it("returns only the rows inside the range but balances that include what came before", async () => {
    mocks.readCashBookDaily.mockResolvedValue([
      { source: "SALE", day: "2026-08-31", method: "CASH", bank_account_id: null, doc_count: 3, amount: 1000 },
      { source: "SALE", day: "2026-09-15", method: "CASH", bank_account_id: null, doc_count: 2, amount: 500 },
    ]);
    mocks.findAllWhere.mockResolvedValue([
      entry("CE-001", "2026-08-20", "CFC-001", 100),
      entry("CE-002", "2026-09-02", "CFC-005", 700),
    ]);
    mocks.getCashTransfers.mockResolvedValue([
      { id: "CT-001", transfer_date: "2026-08-25", amount: 400, from_account_id: null, to_account_id: "BA-001", note: "", status: "ACTIVE", created_by_name: null },
      { id: "CT-002", transfer_date: "2026-09-10", amount: 300, from_account_id: null, to_account_id: "BA-001", note: "", status: "ACTIVE", created_by_name: null },
    ]);

    const data = await getFinancePageData("2026-09-01", "2026-09-30");

    expect(data.rows.map((r) => r.key).sort()).toEqual(["CE-002", "CT-002", "SALE:2026-09-15:CASH"]);
    // opening: sale 1000 - hand expense 100 - transfer 400 out of the drawer
    expect(data.summary.opening).toEqual({ cash: 500, bank: 400, total: 900 });
    // closing adds sale 500, capital 700, transfer 300 out of the drawer
    expect(data.summary.closing).toEqual({ cash: 1400, bank: 700, total: 2100 });
    expect(data.summary.totals.totalIncome).toBe(1200);
    expect(data.categories).toEqual(CATEGORIES);
    // The transitional hand-rows field is gone; the screen reads rows.
    expect(Object.keys(data).sort()).toEqual(["accounts", "categories", "rows", "summary"]);
  });

  it("keeps cancelled hand rows and transfers in the rows (the screen filters them) but out of the balances", async () => {
    mocks.findAllWhere.mockResolvedValue([{ ...entry("CE-009", "2026-09-05", "CFC-005", 999), status: "CANCELLED" }]);
    const data = await getFinancePageData("2026-09-01", "2026-09-30");
    expect(data.rows.map((r) => r.key)).toEqual(["CE-009"]);
    expect(data.summary.closing.total).toBe(0);
  });

  it("refuses when not signed in as admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chưa đăng nhập" });
    await expect(getFinancePageData("2026-09-01", "2026-09-30")).rejects.toThrow("Chưa đăng nhập");
    expect(mocks.readCashBookDaily).not.toHaveBeenCalled();
  });
});

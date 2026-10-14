import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: vi.fn() }));
vi.mock("@/lib/db/tables", () => ({
  findAllWhere: vi.fn(),
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  remove: vi.fn(),
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./categories/actions", () => ({ getCashCategories: vi.fn() }));
vi.mock("./bank-accounts/actions", () => ({ getBankAccounts: vi.fn() }));
vi.mock("./transfers/actions", () => ({ getCashTransfers: vi.fn() }));
vi.mock("@/lib/finance/cash-book-daily", () => ({ readCashBookDaily: vi.fn() }));

import { addCashEntry, updateCashEntry } from "./actions";

const actor = { id: "u1", name: "Chủ quán", role: "ADMIN" };

const ITEMS: Record<string, unknown> = {
  "KCT-001": { id: "KCT-001", name: "Tiền điện", cash_category_id: "CFC-001", status: "ACTIVE" },
  "KCT-003": { id: "KCT-003", name: "Internet", cash_category_id: "CFC-001", status: "INACTIVE" },
};

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = {
    entry_date: "2026-10-14", category_id: "CFC-001", amount: "500000", payment_method: "CASH", ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor });
  mocks.generateNewId.mockResolvedValue("CE-9");
  mocks.findById.mockImplementation(async (sheet: string, id: string) =>
    sheet === "Monthly_Expense_Items"
      ? ITEMS[id] ?? null
      : { id, status: "ACTIVE", category_id: "CFC-001" },
  );
});

describe("addCashEntry with a monthly item", () => {
  it("stores null when the field is empty or absent", async () => {
    expect((await addCashEntry(form({ monthly_item_id: "" }))).success).toBe(true);
    expect(mocks.insert).toHaveBeenLastCalledWith("Cash_Entries", expect.objectContaining({ monthly_item_id: null }));
    expect((await addCashEntry(form())).success).toBe(true);
    expect(mocks.insert).toHaveBeenLastCalledWith("Cash_Entries", expect.objectContaining({ monthly_item_id: null }));
  });

  it("stores the item when it is active and in the same category", async () => {
    expect((await addCashEntry(form({ monthly_item_id: "KCT-001" }))).success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith("Cash_Entries", expect.objectContaining({ monthly_item_id: "KCT-001" }));
  });

  it("refuses an INACTIVE or unknown item", async () => {
    expect(await addCashEntry(form({ monthly_item_id: "KCT-003" }))).toEqual({ error: "Khoản chi hằng tháng không còn dùng" });
    expect(await addCashEntry(form({ monthly_item_id: "KCT-404" }))).toEqual({ error: "Khoản chi hằng tháng không còn dùng" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses an item that belongs to another category", async () => {
    expect(await addCashEntry(form({ monthly_item_id: "KCT-001", category_id: "CFC-002" }))).toEqual({
      error: "Khoản chi hằng tháng thuộc nhóm khác",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("updateCashEntry with a monthly item", () => {
  it("applies the same checks and can clear the link", async () => {
    expect(await updateCashEntry(form({ id: "CE-1", monthly_item_id: "KCT-003" }))).toEqual({
      error: "Khoản chi hằng tháng không còn dùng",
    });
    expect(await updateCashEntry(form({ id: "CE-1", monthly_item_id: "KCT-001", category_id: "CFC-002" }))).toEqual({
      error: "Khoản chi hằng tháng thuộc nhóm khác",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect((await updateCashEntry(form({ id: "CE-1", monthly_item_id: "" }))).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Cash_Entries", "CE-1", expect.objectContaining({ monthly_item_id: null }));
  });

  it("lets an old row keep a link to an item retired since", async () => {
    mocks.findById.mockImplementation(async (sheet: string, id: string) =>
      sheet === "Monthly_Expense_Items"
        ? ITEMS[id] ?? null
        : { id, status: "ACTIVE", category_id: "CFC-001", monthly_item_id: "KCT-003" },
    );
    expect((await updateCashEntry(form({ id: "CE-1", monthly_item_id: "KCT-003" }))).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Cash_Entries", "CE-1", expect.objectContaining({ monthly_item_id: "KCT-003" }));
  });
});

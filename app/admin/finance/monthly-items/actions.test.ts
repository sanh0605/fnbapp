import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createMonthlyItem,
  deleteMonthlyItem,
  getMonthlyItem,
  getMonthlyItems,
  setMonthlyItemStatus,
  updateMonthlyItem,
} from "./actions";

const actor = { id: "a-1", name: "Admin", role: "ADMIN" };
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const ITEMS = [
  { id: "KCT-002", name: "Tiền nhà", cash_category_id: "CFC-001", status: "ACTIVE" },
  { id: "KCT-001", name: "Tiền điện", cash_category_id: "CFC-001", status: "ACTIVE" },
  { id: "KCT-003", name: "Internet", cash_category_id: "CFC-001", status: "INACTIVE" },
];
const CATEGORIES = [
  { id: "CFC-001", name: "Chi phí cố định", kind: "EXPENSE", status: "ACTIVE" },
  { id: "CFC-002", name: "Bán hàng", kind: "INCOME", status: "ACTIVE" },
  { id: "CFC-003", name: "Cũ", kind: "EXPENSE", status: "INACTIVE" },
];
const ENTRIES = [
  { id: "CE-1", monthly_item_id: "KCT-001", status: "ACTIVE" },
  { id: "CE-2", monthly_item_id: "KCT-001", status: "ACTIVE" },
  { id: "CE-3", monthly_item_id: "KCT-001", status: "CANCELLED" },
  { id: "CE-4", monthly_item_id: null, status: "ACTIVE" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor });
  mocks.requireOwner.mockResolvedValue({ ok: true, actor });
  mocks.generateNewId.mockResolvedValue("KCT-004");
  mocks.findAll.mockImplementation(async (sheet: string) =>
    sheet === "Monthly_Expense_Items" ? ITEMS : sheet === "Cash_Categories" ? CATEGORIES : [],
  );
  mocks.findAllWhere.mockImplementation(async (_sheet: string, f: any) =>
    ENTRIES.filter((e) => e.monthly_item_id === f.eq.monthly_item_id),
  );
  mocks.findById.mockImplementation(async (_s: string, id: string) => ITEMS.find((i) => i.id === id) ?? null);
});

describe("getMonthlyItems", () => {
  it("sorts by name and counts only non-cancelled linked entries", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Monthly_Expense_Items" ? ITEMS : sheet === "Cash_Entries" ? ENTRIES : CATEGORIES,
    );
    const rows = await getMonthlyItems();
    expect(rows.map((r) => r.item.name)).toEqual(["Internet", "Tiền điện", "Tiền nhà"]);
    expect(rows.find((r) => r.item.id === "KCT-001")!.entryCount).toBe(2);
    expect(rows.find((r) => r.item.id === "KCT-002")!.entryCount).toBe(0);
  });

  it("getMonthlyItem returns one row or null", async () => {
    expect((await getMonthlyItem("KCT-001"))?.name).toBe("Tiền điện");
    expect(await getMonthlyItem("KCT-999")).toBeNull();
  });
});

describe("createMonthlyItem", () => {
  it("requires a name", async () => {
    expect(await createMonthlyItem(form({ name: " ", cash_category_id: "CFC-001" }))).toEqual({ error: "Nhập tên khoản chi" });
  });

  it("requires an ACTIVE expense category", async () => {
    for (const id of ["", "CFC-002", "CFC-003", "CFC-404"]) {
      const res = await createMonthlyItem(form({ name: "Gas", cash_category_id: id }));
      expect(res).toEqual({ error: "Chọn nhóm chi đang dùng" });
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses a name an ACTIVE item already has, but not a retired one's", async () => {
    expect(await createMonthlyItem(form({ name: " tiền ĐIỆN", cash_category_id: "CFC-001" }))).toEqual({
      error: "Tên khoản chi đã có",
    });
    expect((await createMonthlyItem(form({ name: "Internet", cash_category_id: "CFC-001" }))).success).toBe(true);
  });

  it("inserts with a KCT id, ACTIVE status and the audit columns", async () => {
    const res = await createMonthlyItem(form({ name: "Gas", cash_category_id: "CFC-001" }));
    expect(res).toEqual({ success: true });
    expect(mocks.generateNewId).toHaveBeenCalledWith("Monthly_Expense_Items", "KCT");
    expect(mocks.insert).toHaveBeenCalledWith("Monthly_Expense_Items", {
      id: "KCT-004", name: "Gas", cash_category_id: "CFC-001", status: "ACTIVE",
      created_by_id: "a-1", created_by_name: "Admin", updated_by_id: "a-1", updated_by_name: "Admin",
    });
  });
});

describe("updateMonthlyItem", () => {
  it("lets an item keep its own name and validates the category", async () => {
    expect((await updateMonthlyItem(form({ id: "KCT-001", name: "Tiền điện", cash_category_id: "CFC-001" }))).success).toBe(true);
    expect(await updateMonthlyItem(form({ id: "KCT-001", name: "Tiền điện", cash_category_id: "CFC-002" }))).toEqual({
      error: "Chọn nhóm chi đang dùng",
    });
    expect(await updateMonthlyItem(form({ id: "KCT-001", name: "Tiền nhà", cash_category_id: "CFC-001" }))).toEqual({
      error: "Tên khoản chi đã có",
    });
  });
});

describe("setMonthlyItemStatus", () => {
  it("retires and reactivates", async () => {
    expect((await setMonthlyItemStatus(form({ id: "KCT-001", status: "INACTIVE" }))).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Monthly_Expense_Items", "KCT-001", {
      status: "INACTIVE", updated_by_id: "a-1", updated_by_name: "Admin",
    });
  });

  it("refuses to reactivate a name an ACTIVE item took meanwhile", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Monthly_Expense_Items"
        ? [...ITEMS, { id: "KCT-009", name: "internet", cash_category_id: "CFC-001", status: "ACTIVE" }]
        : CATEGORIES,
    );
    expect(await setMonthlyItemStatus(form({ id: "KCT-003", status: "ACTIVE" }))).toEqual({ error: "Tên khoản chi đã có" });
  });
});

describe("deleteMonthlyItem", () => {
  it("is owner only", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ Chủ quán" });
    expect(await deleteMonthlyItem(form({ id: "KCT-002" }))).toEqual({ error: "Chỉ Chủ quán" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("refuses when any entry is linked, cancelled ones included", async () => {
    mocks.findAllWhere.mockResolvedValue([{ id: "CE-3", status: "CANCELLED" }]);
    expect(await deleteMonthlyItem(form({ id: "KCT-001" }))).toEqual({
      error: "Khoản này đã có dòng trong sổ thu chi, chỉ ngừng dùng được.",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes an item with no linked entry", async () => {
    mocks.findAllWhere.mockResolvedValue([]);
    expect(await deleteMonthlyItem(form({ id: "KCT-002" }))).toEqual({ success: true });
    expect(mocks.remove).toHaveBeenCalledWith("Monthly_Expense_Items", "KCT-002");
  });
});

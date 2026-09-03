import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sheets_db")>("@/lib/sheets_db");
  return {
    findAll: mocks.findAll,
    findAllWhere: mocks.findAllWhere,
    findAllNoCache: mocks.findAllNoCache,
    insert: mocks.insert,
    update: mocks.update,
    remove: mocks.remove,
    generateNewId: mocks.generateNewId,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("@/lib/stock-adjustment-transaction", () => ({
  submitStockAdjustmentAtomic: vi.fn(),
  approveStockAdjustmentAtomic: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { deleteUnit } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// section A3/A7: the FK block itself is correct and stays -- this proves
// two independent things, per section 3's own instruction to keep them
// separate: (1) a used unit is still refused (never deleted), (2) the
// refusal now names the real unit and the real item, not silence and not a
// code.
describe("deleteUnit -- names what is blocking it, and still blocks it", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("A7's exact case: refuses, naming the unit and the item, via a conversion row", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string, filters: any) => {
      if (sheet === "Units") return Promise.resolve([{ id: "UNT-010", name: "Combo 2" }]);
      if (sheet === "UOM_Conversions" && filters.eq.purchased_unit === "UNT-010") {
        return Promise.resolve([{ purchased_item_id: "SPM-020" }]);
      }
      if (sheet === "Purchased_Items" && filters.eq.id === "SPM-020") {
        return Promise.resolve([{ name: "Bột cà phê MR.PHIN Robusta Đắk Mil" }]);
      }
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "UNT-010" }));

    expect(res.error).toBe(
      "Không xoá được đơn vị Combo 2 vì đang được dùng trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy đổi đó trước.",
    );
    // Still blocks it -- the delete itself must never be attempted, let
    // alone succeed.
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("still refuses when the block is via uom_conversions.base_unit instead of purchased_unit", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string, filters: any) => {
      if (sheet === "Units") return Promise.resolve([{ id: "UNT-004", name: "Can" }]);
      if (sheet === "UOM_Conversions" && filters.eq.purchased_unit === "UNT-004") return Promise.resolve([]);
      if (sheet === "UOM_Conversions" && filters.eq.base_unit === "UNT-004") {
        return Promise.resolve([{ purchased_item_id: "SPM-027" }]);
      }
      if (sheet === "Purchased_Items" && filters.eq.id === "SPM-027") {
        return Promise.resolve([{ name: "Nước đường Glofood" }]);
      }
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "UNT-004" }));

    expect(res.error).toContain("Nước đường Glofood");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("refuses via purchased_items.default_unit_id, naming the item", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string, filters: any) => {
      if (sheet === "Units") return Promise.resolve([{ id: "U-013", name: "Cuộn" }]);
      if (sheet === "UOM_Conversions") return Promise.resolve([]);
      if (sheet === "Purchased_Items" && filters.eq.default_unit_id === "U-013") {
        return Promise.resolve([{ name: "Túi đựng rác" }]);
      }
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "U-013" }));

    expect(res.error).toBe(
      "Không xoá được đơn vị Cuộn vì đang được dùng trong mặt hàng mua Túi đựng rác. Đổi đơn vị mặc định của mặt hàng đó trước.",
    );
  });

  it("refuses via base_ingredients.base_unit, naming the ingredient group", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string, filters: any) => {
      if (sheet === "Units") return Promise.resolve([{ id: "U-009", name: "trái" }]);
      if (sheet === "UOM_Conversions") return Promise.resolve([]);
      if (sheet === "Purchased_Items") return Promise.resolve([]);
      if (sheet === "Base_Ingredients" && filters.eq.base_unit === "U-009") {
        return Promise.resolve([{ name: "Trứng gà" }]);
      }
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "U-009" }));

    expect(res.error).toContain("nhóm nguyên liệu Trứng gà");
  });

  it("refuses via semi_products.base_unit, naming the semi-product", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string, filters: any) => {
      if (sheet === "Units") return Promise.resolve([{ id: "U-010", name: "Ca" }]);
      if (sheet === "UOM_Conversions") return Promise.resolve([]);
      if (sheet === "Purchased_Items") return Promise.resolve([]);
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products" && filters.eq.base_unit === "U-010") {
        return Promise.resolve([{ name: "Thạch dừa Thanh Bình" }]);
      }
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "U-010" }));

    expect(res.error).toContain("bán thành phẩm Thạch dừa Thanh Bình");
  });

  it("refuses via purchase_order_lines with the frozen-history hint, not an actionable one", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string, filters: any) => {
      if (sheet === "Units") return Promise.resolve([{ id: "UNT-099", name: "Thùng" }]);
      if (sheet === "UOM_Conversions") return Promise.resolve([]);
      if (sheet === "Purchased_Items" && filters.eq.default_unit_id) return Promise.resolve([]);
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchase_Order_Lines" && filters.eq.base_unit === "UNT-099") {
        return Promise.resolve([{ purchased_item_id: "SPM-050" }, { purchased_item_id: "SPM-050" }]);
      }
      if (sheet === "Purchased_Items" && filters.eq.id === "SPM-050") {
        return Promise.resolve([{ name: "Đường cát trắng" }]);
      }
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "UNT-099" }));

    expect(res.error).toBe(
      "Không xoá được đơn vị Thùng vì đang được dùng trong 2 dòng đơn nhập lịch sử của Đường cát trắng. Đây là lịch sử đơn nhập đã ghi nhận, đơn vị này không thể xoá được nữa.",
    );
  });

  it("a unit no source references at all is deleted for real -- must not refuse a free unit", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "Units") return Promise.resolve([{ id: "UNT-002", name: "Bộ" }]);
      return Promise.resolve([]);
    });

    const res = await deleteUnit(formData({ id: "UNT-002" }));

    expect(res.error).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith("Units", "UNT-002");
    expect(mocks.revalidateTag).toHaveBeenCalled();
  });
});

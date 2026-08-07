import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  revalidatePath: vi.fn(),
  openStocktakeSessionAtomic: vi.fn(),
  saveStocktakeLineAtomic: vi.fn(),
  cancelStocktakeSessionAtomic: vi.fn(),
  applyStocktakeSessionAtomic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/stocktake-transaction", () => ({
  openStocktakeSessionAtomic: mocks.openStocktakeSessionAtomic,
  saveStocktakeLineAtomic: mocks.saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic: mocks.cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic: mocks.applyStocktakeSessionAtomic,
}));

import * as stocktakeActions from "./actions";

describe("stocktake confirmation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  it("exposes separate admin actions for preview and explicit confirmation", () => {
    expect(stocktakeActions).toHaveProperty("getStocktakeConfirmPreview");
    expect(stocktakeActions).toHaveProperty("confirmStocktakeSession");
  });

  it("rejects a preview response that is not a dry run", async () => {
    mocks.applyStocktakeSessionAtomic.mockResolvedValue({
      sessionId: "STK-001",
      status: "CONFIRMED",
      dryRun: false,
      ledgerCount: 0,
      rows: [],
      ledgerIds: [],
    });

    await expect(stocktakeActions.getStocktakeConfirmPreview("STK-001")).resolves.toEqual({
      error: "Stocktake preview did not return a dry run",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses confirmation without a preview hash before calling the RPC", async () => {
    await expect(stocktakeActions.confirmStocktakeSession("STK-001", "")).resolves.toEqual({
      error: "Stocktake preview is required before confirmation",
    });
    expect(mocks.applyStocktakeSessionAtomic).not.toHaveBeenCalled();
  });
});

describe("startStocktakeSession item list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  // Plan C Task 3, BR-INV-006 (docs/BUSINESS-RULES.md): semi-products carry
  // no stock and no value, so the count list must not offer them, even
  // though SEMI_PRODUCT stays a legal item_type at the database level
  // (Plan B migration 0052) -- checked by count here, not by eye.
  //
  // Plan D Gap 1 (2026-08-07): BASE_INGREDIENT lines are gone from new
  // sessions entirely -- counting by generic ingredient and counting by
  // purchased item fed different systems (stock_ledger vs stock_issues)
  // with nothing on screen telling them apart. Only PURCHASED_ITEM lines
  // remain.
  it("never includes SEMI_PRODUCT or BASE_INGREDIENT, only PURCHASED_ITEM", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") {
        return Promise.resolve([
          { id: "NNL-001", name: "Sữa tươi", base_unit: "U-ML", is_non_inventory: false },
        ]);
      }
      if (sheet === "Semi_Products") {
        return Promise.resolve([
          { id: "BTP-001", name: "Cốt cà phê", base_unit: "U-ML" },
        ]);
      }
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-001", name: "Sữa tươi TH", base_ingredient_id: "NNL-001", default_unit_id: "U-ML", status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-001",
      status: "OPEN",
      created_by_id: "admin-1",
      created_by_name: "Admin",
      created_at: "2026-08-05T00:00:00Z",
      notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    expect(mocks.openStocktakeSessionAtomic).toHaveBeenCalledTimes(1);
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    const itemTypes = items.map((item: { itemType: string }) => item.itemType);

    expect(itemTypes).not.toContain("SEMI_PRODUCT");
    expect(itemTypes).not.toContain("BASE_INGREDIENT");
    expect(itemTypes).toEqual(["PURCHASED_ITEM"]);
    expect(items).toHaveLength(1);
    // ACTIVE items never trigger the C17 purchase/issue lookup.
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });

  // C17: an inactive purchased item is not simply dropped -- if it still
  // has stock physically on the shelf, its ingredient's quantity could
  // never be corrected again (S1 needs every purchased item counted).
  it("C17: an inactive purchased item stays offered while its on-hand is still positive", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-OLD", name: "Sữa đặc La rosee (ngừng bán)", base_ingredient_id: "ING-003", default_unit_id: "U-ML", status: "INACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ purchased_item_id: "SPM-OLD", purchase_order_id: "PO-1", base_quantity: 100 }]);
      }
      if (sheet === "Purchase_Orders") {
        return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      }
      if (sheet === "Stock_Issues") {
        return Promise.resolve([{ purchased_item_id: "SPM-OLD", base_quantity: 40 }]); // 60 left on hand
      }
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-002", status: "OPEN", created_by_id: "admin-1", created_by_name: "Admin",
      created_at: "2026-08-07T00:00:00Z", notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    expect(items).toEqual([{ itemReference: "SPM-OLD", itemType: "PURCHASED_ITEM" }]);
  });

  it("C17: an inactive purchased item is dropped once its on-hand reaches zero", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-GONE", name: "Nguyên liệu đã hết", base_ingredient_id: "ING-999", default_unit_id: "U-ML", status: "INACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ purchased_item_id: "SPM-GONE", purchase_order_id: "PO-1", base_quantity: 100 }]);
      }
      if (sheet === "Purchase_Orders") {
        return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      }
      if (sheet === "Stock_Issues") {
        return Promise.resolve([{ purchased_item_id: "SPM-GONE", base_quantity: 100 }]); // fully issued
      }
      return Promise.resolve([]);
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ error: "Không có mặt hàng nào để kiểm kê" });
    expect(mocks.openStocktakeSessionAtomic).not.toHaveBeenCalled();
  });
});

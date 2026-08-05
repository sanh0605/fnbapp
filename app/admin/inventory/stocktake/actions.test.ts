import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
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
  it("never includes SEMI_PRODUCT, even when semi-products exist", async () => {
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
          { id: "SPM-001", name: "Sữa tươi TH", base_ingredient_id: "NNL-001", default_unit_id: "U-ML" },
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
    expect(itemTypes).toContain("BASE_INGREDIENT");
    expect(itemTypes).toContain("PURCHASED_ITEM");
    expect(items).toHaveLength(2);
  });
});

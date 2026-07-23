import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getPosInventoryState: vi.fn(),
  savePosOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  unstableCache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/auth", () => ({
  resolveActor: mocks.resolveActor,
  authOptions: {},
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
}));
vi.mock("@/lib/pos-inventory-state", () => ({
  getPosInventoryState: mocks.getPosInventoryState,
}));
vi.mock("@/lib/pos-order-transaction", () => ({
  savePosOrderAtomic: mocks.savePosOrderAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: mocks.unstableCache,
}));

import * as posActions from "./actions";

const {
  deletePOSDraft,
  getPOSDrafts,
  savePOSDraft,
  submitOrderV2,
} = posActions;

const unauthenticated = { ok: false as const, error: "Yêu cầu đăng nhập" };

describe("POS action authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue(unauthenticated);
  });

  it("rejects unauthenticated checkout before any read or write", async () => {
    const result = await submitOrderV2({
      brand_id: "BR-001",
      items: [{ product_id: "PROD-001", quantity: 1 }],
    } as never);

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.getPosInventoryState).not.toHaveBeenCalled();
    expect(mocks.savePosOrderAtomic).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft reads before reading storage", async () => {
    await expect(getPOSDrafts("BR-001")).rejects.toThrow("Yêu cầu đăng nhập");

    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft saves before any read or write", async () => {
    const result = await savePOSDraft({
      name: "Ca sáng",
      cart_json: "[]",
      brand_id: "BR-001",
    });

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft deletion before storage mutation", async () => {
    const result = await deletePOSDraft("DRF-001");

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("preserves the trusted CLI SYSTEM actor when saving a draft", async () => {
    mocks.resolveActor.mockResolvedValue({
      ok: true,
      actor: { id: "system", name: "Hệ thống", role: "SYSTEM" },
    });
    mocks.insert.mockResolvedValue(undefined);

    const result = await savePOSDraft({
      name: "Nhập bằng script",
      cart_json: "[]",
      brand_id: "BR-001",
    });

    expect(result.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(
      "POS_Drafts",
      expect.objectContaining({
        created_by_id: "system",
        created_by_name: "Hệ thống",
      }),
    );
  });

  it("rejects unauthenticated POS summary reads before storage access", async () => {
    const getBestSellers = (posActions as any).getPOSBestSellerProductIds;
    const getStockStatus = (posActions as any).getPOSStockStatus;

    expect(getBestSellers).toBeTypeOf("function");
    expect(getStockStatus).toBeTypeOf("function");
    await expect(getBestSellers({ limit: 8 })).rejects.toThrow("Yêu cầu đăng nhập");
    await expect(getStockStatus()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(mocks.findAllWhere).not.toHaveBeenCalled();
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it("returns only ranked product IDs for the authenticated POS caller", async () => {
    const getBestSellers = (posActions as any).getPOSBestSellerProductIds;
    expect(getBestSellers).toBeTypeOf("function");
    mocks.resolveActor.mockResolvedValue({
      ok: true,
      actor: { id: "staff-1", name: "Thu ngân", role: "STAFF" },
    });
    mocks.findAllWhere.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") {
        return [
          { id: "ORD-1", status: "COMPLETED", superseded_by: "", created_at: "2026-07-10T01:00:00.000Z", brand_id: "BR-1", net_total: 100000 },
        ];
      }
      if (sheet === "Order_Lines_V2") {
        return [
          makeOrderLine("LINE-1", "PROD-1", 3),
          makeOrderLine("LINE-2", "PROD-2", 1),
          makeOrderLine("LINE-3", "TOPPING-1", 20),
        ];
      }
      return [];
    });
    mocks.findAll.mockResolvedValue([
      { id: "TOPPING-1", category_id: "CAT-007", migration_notes: "topping-standalone::mod_id=MOD-001" },
    ]);

    const result = await getBestSellers({
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-14T23:59:59.999Z",
      brandId: "BR-1",
      limit: 8,
    });

    expect(result).toEqual(["PROD-1", "PROD-2"]);
    expect(result.every((value: unknown) => typeof value === "string")).toBe(true);
  });

  it("returns only item ID and current stock for the authenticated POS caller", async () => {
    const getStockStatus = (posActions as any).getPOSStockStatus;
    expect(getStockStatus).toBeTypeOf("function");
    mocks.resolveActor.mockResolvedValue({
      ok: true,
      actor: { id: "staff-1", name: "Thu ngân", role: "STAFF" },
    });
    mocks.findAllNoCache.mockResolvedValue([
      { item_reference: "BI-1", quantity_change: 10 },
      { item_reference: "BI-1", quantity_change: -3 },
      { item_reference: "BTP-1", quantity_change: 4 },
    ]);
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Base_Ingredients") {
        return [
          { id: "BI-1", is_non_inventory: false },
          { id: "BI-NON", is_non_inventory: true },
        ];
      }
      if (sheet === "Semi_Products") return [{ id: "BTP-1" }];
      return [];
    });

    const result = await getStockStatus();

    expect(result).toEqual([
      { id: "BI-1", current_stock: 7 },
      { id: "BTP-1", current_stock: 4 },
    ]);
    expect(result[0]).not.toHaveProperty("name");
    expect(result[0]).not.toHaveProperty("unit_cost");
  });
});

function makeOrderLine(id: string, productId: string, qty: number) {
  return {
    id,
    order_id: "ORD-1",
    product_id: productId,
    product_snapshot_json: JSON.stringify({ id: productId, name: productId, category_id: "CAT-1" }),
    variant_id: `${productId}-VAR`,
    variant_snapshot_json: JSON.stringify({ id: `${productId}-VAR`, size_name: "M" }),
    qty,
    unit_price: 10000,
    modifiers_snapshot_json: "[]",
    gross_line_total: qty * 10000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
    net_line_total: qty * 10000,
    cost_at_sale: 0,
    recipe_snapshot_json: "{}",
  };
}

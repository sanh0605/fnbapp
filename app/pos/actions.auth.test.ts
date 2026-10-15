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

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: mocks.resolveActor,
  authOptions: {},
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
}));
vi.mock("@/lib/sales/pos-order-transaction", () => ({
  savePosOrderAtomic: mocks.savePosOrderAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: mocks.unstableCache,
}));

import * as posActions from "./actions";
import { PRICE_CHANGED } from "@/lib/sales/order-cart";
import { InvariantError } from "@/lib/sales/order-types";

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
      outlet_id: "OUT-001",
      items: [{ product_id: "PROD-001", quantity: 1 }],
    } as never);

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập", retry: false });
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.getPosInventoryState).not.toHaveBeenCalled();
    expect(mocks.savePosOrderAtomic).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft reads before reading storage", async () => {
    await expect(getPOSDrafts("OUT-001")).rejects.toThrow("Yêu cầu đăng nhập");

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
    const result = await deletePOSDraft("DRF-001", "OUT-001");

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

    expect(getBestSellers).toBeTypeOf("function");
    await expect(getBestSellers({ limit: 8 })).rejects.toThrow("Yêu cầu đăng nhập");
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
    // Rewritten 2026-09-08 (Task 5 extended to app/pos/actions.ts, BR-CATALOG-003):
    // the exclusion reads the real join now (modifiers.product_id, migration
    // 0097), not products.migration_notes -- a column that has never existed.
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Modifiers") {
        return [{ id: "MOD-001", status: "ACTIVE", product_id: "TOPPING-1" }];
      }
      return [];
    });

    const result = await getBestSellers({
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-14T23:59:59.999Z",
      brandId: "BR-1",
      limit: 8,
    });

    expect(result).toEqual(["PROD-1", "PROD-2"]);
    expect(result.every((value: unknown) => typeof value === "string")).toBe(true);
  });

  // Phase A:
  // getPOSStockStatus/loadPOSStockStatus deleted outright (owner decision
  // 2026-08-31) -- had no live caller left, only read Inventory_Balances,
  // the known-incomplete copy of stock_ledger (38 of 49 adjustments from
  // the first stocktake). The test that used to prove this function's own
  // shape is gone with it; see the new test below proving nothing on the
  // module still exports it.
  it("no longer exports getPOSStockStatus at all", () => {
    expect((posActions as any).getPOSStockStatus).toBeUndefined();
  });

  describe("submitOrderV2 -- retry flag", () => {
    const cart = {
      outlet_id: "OUT-1",
      items: [{ product_id: "P1", variant_id: "V1", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      shown_total: 1000,
      promotion_ids: [],
    } as never;
    const staff = { ok: true as const, actor: { id: "staff-1", name: "Thu ngân", role: "STAFF" } };

    it("a database hiccup keeps the cart: retry true", async () => {
      mocks.resolveActor.mockResolvedValue(staff);
      mocks.findAll.mockRejectedValue(new Error("fetch failed"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await submitOrderV2(cart, "tok-1")).toEqual({ success: false, error: "Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại", retry: true });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("a Vietnamese refusal reaches the till unchanged", async () => {
      mocks.resolveActor.mockResolvedValue(staff);
      mocks.findAll.mockRejectedValue(new InvariantError(PRICE_CHANGED));
      expect(await submitOrderV2(cart, "tok-1")).toEqual({ success: false, error: PRICE_CHANGED, retry: false });
    });

    it("a closed outlet is a refusal: retry false", async () => {
      mocks.resolveActor.mockResolvedValue(staff);
      mocks.findAll.mockImplementation(async (t: string) => t === "Outlets" ? [{ id: "OUT-1", status: "INACTIVE", brand_id: "B" }] : []);
      expect(await submitOrderV2(cart, "tok-1")).toEqual({ success: false, error: "Điểm bán này đã ngừng hoạt động", retry: false });
    });

    it("a rule thrown while building the order is a refusal: retry false", async () => {
      mocks.resolveActor.mockResolvedValue(staff);
      mocks.findAll.mockImplementation(async (t: string) => t === "Outlets" ? [{ id: "OUT-1", status: "ACTIVE", brand_id: "B" }] : []);
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await submitOrderV2(cart, "tok-1")).toEqual({ success: false, error: "Đơn không hợp lệ — tải lại trang rồi bấm lại.", retry: false });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Unknown brand: B"));
      spy.mockRestore();
    });
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
  };
}

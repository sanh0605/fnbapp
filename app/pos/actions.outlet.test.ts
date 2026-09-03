import { beforeEach, describe, expect, it, vi } from "vitest";

// section 5/6:
// the brand must not be user-suppliable -- these tests prove submitOrderV2
// resolves it server-side from outlet_id and ignores whatever brand_id the
// caller sent, and that an unknown outlet_id is rejected before any write.

const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  findAll: vi.fn(),
  savePosOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  resolveActor: mocks.resolveActor,
}));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/pos-order-transaction", () => ({
  savePosOrderAtomic: mocks.savePosOrderAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

import { submitOrderV2 } from "./actions";

const OUTLET_1 = { id: "OUT-001", code: "001", name: "Điểm bán 1", brand_id: "BR-001" };
const OUTLET_2 = { id: "OUT-002", code: "002", name: "Điểm bán 2", brand_id: "BR-002" };

const REF_TABLES: Record<string, any[]> = {
  Outlets: [OUTLET_1, OUTLET_2],
  Brands: [{ id: "BR-001", code: "PHD" }, { id: "BR-002", code: "UCK" }],
  Products: [{ id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001", status: "ACTIVE" }],
  Product_Variants: [{ id: "VAR-001", product_id: "PROD-001", size_name: "500ml", price: "18000", status: "ACTIVE" }],
  Product_Categories: [{ id: "CAT-001", name: "Đồ uống" }],
  Modifiers: [],
  Promotions: [],
  Recipes: [],
};

const baseCart = {
  brand_id: "BR-002", // deliberately wrong -- must be overridden from the outlet
  outlet_id: OUTLET_1.id,
  items: [{
    product_id: "PROD-001",
    variant_id: "VAR-001",
    qty: 1,
    modifiers: [],
    manual_item_discount: { value: 0, type: "VND" as const },
  }],
  payment_method: "CASH" as const,
};

describe("submitOrderV2 outlet resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue({
      ok: true,
      actor: { id: "staff-1", name: "Thu ngân" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => REF_TABLES[sheet] || []);
    mocks.savePosOrderAtomic.mockImplementation(async (input: any) => ({
      orderId: "ord-1",
      orderNo: "260825001001",
      lineCount: input.lines.length,
      paymentCount: 0,
    }));
  });

  it("rejects checkout with no outlet_id before any read", async () => {
    const result = await submitOrderV2({ ...baseCart, outlet_id: "" } as any);

    expect(result).toEqual({ success: false, error: "Không xác định được điểm bán" });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it("rejects an unknown outlet_id", async () => {
    const result = await submitOrderV2({ ...baseCart, outlet_id: "OUT-DOES-NOT-EXIST" } as any);

    expect(result).toEqual({ success: false, error: "Điểm bán không tồn tại" });
    expect(mocks.savePosOrderAtomic).not.toHaveBeenCalled();
  });

  it("ignores a client-supplied brand_id and derives it from the outlet instead", async () => {
    const result = await submitOrderV2(baseCart as any);

    expect(result.success).toBe(true);
    expect(mocks.savePosOrderAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        outletCode: OUTLET_1.code,
        order: expect.objectContaining({
          brand_id: OUTLET_1.brand_id, // BR-001, not the BR-002 the client sent
          outlet_id: OUTLET_1.id,
        }),
      }),
    );
  });

  it("keys minting on the selected outlet, not a fixed brand", async () => {
    const result = await submitOrderV2({ ...baseCart, outlet_id: OUTLET_2.id, brand_id: OUTLET_1.brand_id } as any);

    expect(result.success).toBe(true);
    expect(mocks.savePosOrderAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        outletCode: OUTLET_2.code,
        order: expect.objectContaining({ brand_id: OUTLET_2.brand_id }),
      }),
    );
  });
});

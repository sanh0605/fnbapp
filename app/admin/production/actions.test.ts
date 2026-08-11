import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  saveProductionOrderAtomic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/historical/production-order-transaction", () => ({
  saveProductionOrderAtomic: mocks.saveProductionOrderAtomic,
}));

import { saveProductionOrder } from "./actions";

// Plan C Task 3, BR-INV-006 (docs/BUSINESS-RULES.md): semi-product stock
// tracking is dropped, so recording a production batch is refused outright
// -- no production_orders row, no production_items, no stock_ledger row.
// The old tests here (rollback/retry, form-to-schema mapping) tested a write
// path that no longer runs; replaced rather than deleted silently.
describe("saveProductionOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
  });

  it("refuses to record a batch, in Vietnamese, and never writes anything", async () => {
    const result = await saveProductionOrder(makeFormData());

    expect(result).toEqual({
      error: "Sổ kho giờ chỉ ghi nhận hàng nhập và kết quả kiểm kê định kỳ — không còn ghi nhận lệnh sản xuất bán thành phẩm.",
    });
    expect(mocks.saveProductionOrderAtomic).not.toHaveBeenCalled();
  });

  it("still requires admin before refusing", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    const result = await saveProductionOrder(makeFormData());

    expect(result).toEqual({ error: "Yêu cầu đăng nhập" });
    expect(mocks.saveProductionOrderAtomic).not.toHaveBeenCalled();
  });
});

function makeFormData(): FormData {
  const formData = new FormData();
  formData.set("semi_product_id", "BTP-001");
  formData.set("target_yield", "100");
  formData.set("consumed_ingredients", JSON.stringify([
    {
      ingredient_id: "ING-001",
      ingredient_type: "BASE_INGREDIENT",
      unit_id: "UNT-G",
      qtyNeeded: 20,
      is_non_inventory: false,
    },
  ]));
  return formData;
}

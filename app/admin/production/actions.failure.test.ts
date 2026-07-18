import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  saveProductionOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({ findAll: mocks.findAll }));
vi.mock("@/lib/production-order-transaction", () => ({
  saveProductionOrderAtomic: mocks.saveProductionOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveProductionOrder } from "./actions";

describe("saveProductionOrder atomic persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.findAll.mockResolvedValue([
      { id: "BTP-001", name: "Cốt cà phê" },
    ]);
  });

  it("leaves no partial mutation after an RPC rollback and permits a clean retry", async () => {
    mocks.saveProductionOrderAtomic
      .mockRejectedValueOnce(new Error("forced rollback"))
      .mockResolvedValueOnce({
        productionOrderId: "PRD-001",
        itemCount: 1,
        ledgerCount: 2,
      });

    await expect(saveProductionOrder(makeFormData())).resolves.toEqual({
      error: "forced rollback",
    });
    expect(mocks.saveProductionOrderAtomic).toHaveBeenCalledTimes(1);

    await expect(saveProductionOrder(makeFormData())).resolves.toEqual({
      success: true,
      order_id: "PRD-001",
    });
    expect(mocks.saveProductionOrderAtomic).toHaveBeenCalledTimes(2);
  });

  it("maps the form payload to the approved canonical production schema", async () => {
    mocks.saveProductionOrderAtomic.mockResolvedValue({
      productionOrderId: "PRD-001",
      itemCount: 1,
      ledgerCount: 2,
    });

    await expect(saveProductionOrder(makeFormData())).resolves.toEqual({
      success: true,
      order_id: "PRD-001",
    });

    expect(mocks.saveProductionOrderAtomic).toHaveBeenCalledTimes(1);
    const input = mocks.saveProductionOrderAtomic.mock.calls[0][0];
    expect(input.order).toMatchObject({
      semi_product_id: "BTP-001",
      batch_yield: 100,
      status: "COMPLETED",
      created_by_id: "admin-1",
      created_by_name: "Quản lý",
    });
    expect(input.order.created_at).toEqual(expect.any(String));
    expect(input.order.completed_at).toBe(input.order.created_at);
    expect(input.items).toEqual([{
      ingredient_id: "ING-001",
      ingredient_type: "BASE_INGREDIENT",
      quantity: 20,
      unit_id: "UNT-G",
    }]);
    expect(input.ledgerRows).toEqual([
      {
        transaction_type: "PRODUCTION_CONSUME",
        item_reference: "ING-001",
        quantity_change: -20,
        unit_cost: 0,
        created_at: input.order.created_at,
      },
      {
        transaction_type: "PRODUCTION_YIELD",
        item_reference: "BTP-001",
        quantity_change: 100,
        unit_cost: 0,
        created_at: input.order.created_at,
      },
    ]);
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
    {
      ingredient_id: "ING-NONINV",
      ingredient_type: "BASE_INGREDIENT",
      unit_id: "UNT-G",
      qtyNeeded: 5,
      is_non_inventory: true,
    },
  ]));
  return formData;
}

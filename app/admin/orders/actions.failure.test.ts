import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
  voidOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  insertMany: mocks.insertMany,
  update: mocks.update,
}));
vi.mock("@/lib/void-order-transaction", () => ({
  voidOrderAtomic: mocks.voidOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { voidOrderV2 } from "./actions";

describe("voidOrderV2 atomic failure handling", () => {
  let orderStatus: string;

  beforeEach(() => {
    vi.clearAllMocks();
    orderStatus = "COMPLETED";
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
    mocks.findAll.mockResolvedValue([]);
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") {
        return [{
          id: "ord-void-1",
          order_no: "UCK-VOID-1",
          status: orderStatus,
          version: 1,
          net_total: 25_000,
        }];
      }
      if (sheet === "Stock_Ledger") {
        return [{
          id: "stk-consume-1",
          transaction_type: "SALES_CONSUME",
          reference_id: "ord-void-1",
          item_reference: "ING-001",
          quantity_change: -10,
          unit_cost: 100,
          cost_at_sale: 1_000,
          source: "VARIANT_RECIPE",
        }];
      }
      return [];
    });
  });

  it("returns the atomic rollback error and permits a clean retry without sequential fallback writes", async () => {
    mocks.voidOrderAtomic
      .mockRejectedValueOnce(new Error("void_order_atomic: forced rollback"))
      .mockResolvedValueOnce({
        orderId: "ord-void-1",
        reversalCount: 1,
        alreadyVoided: false,
      });

    const failed = await voidOrderV2("ord-void-1", "Customer request");
    expect(failed).toEqual({ success: false, error: "void_order_atomic: forced rollback" });

    const retry = await voidOrderV2("ord-void-1", "Customer request");
    expect(retry).toEqual({ success: true });
    expect(mocks.voidOrderAtomic).toHaveBeenCalledTimes(2);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.insertMany).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("delegates an already-voided retry to the RPC idempotency guard", async () => {
    orderStatus = "VOIDED";
    mocks.voidOrderAtomic.mockResolvedValue({
      orderId: "ord-void-1",
      reversalCount: 1,
      alreadyVoided: true,
    });

    const result = await voidOrderV2("ord-void-1", "Customer request");

    expect(result).toEqual({ success: true });
    expect(mocks.voidOrderAtomic).toHaveBeenCalledOnce();
  });

  it("rejects a non-voidable state before invoking the RPC", async () => {
    orderStatus = "SUPERSEDED";

    const result = await voidOrderV2("ord-void-1", "Customer request");

    expect(result.success).toBe(false);
    expect(mocks.voidOrderAtomic).not.toHaveBeenCalled();
  });
});

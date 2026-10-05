import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }));

import {
  CancelFunctionMissingError,
  cancelPurchaseOrderAtomic,
  fetchPurchaseOrderCancelCheck,
} from "./purchase-order-cancel-transaction";

describe("fetchPurchaseOrderCancelCheck", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the check with p_id and parses the answer", async () => {
    mocks.rpc.mockResolvedValue({
      data: { blocked: [], assets: [{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, total_cost: 20200 }] },
      error: null,
    });
    const check = await fetchPurchaseOrderCancelCheck("PO-147");
    expect(mocks.rpc).toHaveBeenCalledWith("purchase_order_cancel_check", { p_id: "PO-147" });
    expect(check.assets).toEqual([{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, totalCost: 20200 }]);
  });

  it("throws CancelFunctionMissingError when PostgREST says the function is not there (PGRST202)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function public.purchase_order_cancel_check(p_id)" } });
    await expect(fetchPurchaseOrderCancelCheck("PO-147")).rejects.toBeInstanceOf(CancelFunctionMissingError);
  });

  it("matches the missing-function wording even without the code", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Could not find the function public.x in the schema cache" } });
    await expect(fetchPurchaseOrderCancelCheck("PO-147")).rejects.toBeInstanceOf(CancelFunctionMissingError);
  });

  it("any other error becomes Error with the rpc name", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const error = await fetchPurchaseOrderCancelCheck("PO-147").catch(e => e);
    expect(error).not.toBeInstanceOf(CancelFunctionMissingError);
    expect(error.message).toBe("purchase_order_cancel_check: boom");
  });
});

describe("cancelPurchaseOrderAtomic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the four named arguments and parses the outcome", async () => {
    mocks.rpc.mockResolvedValue({ data: { cancelled: true, retired_asset_ids: ["TS-080"] }, error: null });
    const outcome = await cancelPurchaseOrderAtomic({ id: "PO-147", reason: "Nhập trùng", actorId: "u1", actorName: "Quản lý" });
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_purchase_order_atomic", {
      p_id: "PO-147", p_reason: "Nhập trùng", p_actor_id: "u1", p_actor_name: "Quản lý",
    });
    expect(outcome).toEqual({ cancelled: true, retiredAssetIds: ["TS-080"] });
  });

  it("throws CancelFunctionMissingError for a missing function and a plain Error otherwise", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function public.cancel_purchase_order_atomic" } });
    await expect(cancelPurchaseOrderAtomic({ id: "PO-1", reason: "x", actorId: "u", actorName: "n" }))
      .rejects.toBeInstanceOf(CancelFunctionMissingError);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Lý do huỷ phiếu là bắt buộc" } });
    await expect(cancelPurchaseOrderAtomic({ id: "PO-1", reason: "x", actorId: "u", actorName: "n" }))
      .rejects.toThrow("cancel_purchase_order_atomic: Lý do huỷ phiếu là bắt buộc");
  });
});

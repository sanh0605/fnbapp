import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  findById: vi.fn(),
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
  findAllWhere: mocks.findAllWhere,
  findById: mocks.findById,
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
    mocks.findAllNoCache.mockResolvedValue([]);
    mocks.findById.mockImplementation(async (sheet: string, id: string) => {
      if (sheet !== "Orders_V2" || id !== "ord-void-1") return null;
      return {
        id: "ord-void-1",
        order_no: "UCK-VOID-1",
        status: orderStatus,
        version: 1,
        net_total: 25_000,
      };
    });
    // docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md Phase A:
    // voidOrderV2 no longer reads Stock_Ledger at all -- this mock used to
    // return three fabricated ledger rows to prove they got reversed. Real
    // stock_ledger has carried zero sales-driven rows since the 2026-08-07
    // cutover (proved live for every real voided order in production
    // before the code was deleted), so findAllWhere has nothing left to
    // serve here and no test below should call it.
    mocks.findAllWhere.mockResolvedValue([]);
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

  // docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md Phase A
  // replaces this test's own prior claim -- it used to prove three
  // fabricated ledger rows (a sale plus its implicit-production pair) got
  // reversed. That reversal machinery is gone: proved live first that it
  // was always reversing nothing (0 stock_ledger rows for every real
  // voided order in production), then removed the read. Phase C went
  // further and removed the write itself -- voidOrderAtomic no longer
  // accepts a reversalRows field at all.
  it("sends no reversal rows at all -- voidOrderV2 no longer reads or reverses the ledger", async () => {
    mocks.voidOrderAtomic.mockResolvedValue({
      orderId: "ord-void-1",
      reversalCount: 0,
      alreadyVoided: false,
    });

    const result = await voidOrderV2("ord-void-1", "Customer request");

    expect(result).toEqual({ success: true });
    const callArgs = mocks.voidOrderAtomic.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("reversalRows");
    expect(mocks.findAllWhere).not.toHaveBeenCalledWith("Stock_Ledger", expect.anything());
  });

  it("rejects a non-voidable state before invoking the RPC", async () => {
    orderStatus = "SUPERSEDED";

    const result = await voidOrderV2("ord-void-1", "Customer request");

    expect(result.success).toBe(false);
    expect(mocks.voidOrderAtomic).not.toHaveBeenCalled();
  });
});

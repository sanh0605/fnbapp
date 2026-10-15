import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
  buildPurchaseOrderWritePlan: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAll,
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  generateNewId: mocks.generateNewId,
}));
vi.mock("@/lib/purchasing/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: mocks.buildPurchaseOrderWritePlan,
}));
vi.mock("@/lib/purchasing/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { savePurchaseOrder } from "./actions";

const MANAGER = { ok: true, actor: { id: "mgr-1", name: "Quản lý", role: "MANAGER" } };
const OWNER_REFUSAL = "Chỉ Chủ quán mới có quyền thực hiện thao tác này";

function form(status: string, id: string): FormData {
  const fd = new FormData();
  fd.set("supplier_id", "SUP-1");
  fd.set("source_id", "SRC-1");
  fd.set("transaction_date", "2026-08-20T00:00:00.000Z");
  fd.set("status", status);
  fd.set("payment_method", "CASH");
  fd.set("lines_json", JSON.stringify([{ quantity: 8, subtotal: 100_000 }]));
  fd.set("subtotal_amount", "100000");
  if (id) fd.set("id", id);
  return fd;
}

// Audit A8: requireAdmin lets MANAGER in; replacing a COMPLETED order needs ADMIN on the server.
describe("savePurchaseOrder -- replacing a completed order is owner-only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(MANAGER);
    mocks.requireOwner.mockResolvedValue({ ok: false, error: OWNER_REFUSAL });
    mocks.findAll.mockResolvedValue([]);
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-064", lineCount: 1 });
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-1", purchased_item_id: "SPM-100", subtotal: 100_000, quantity: 8, base_quantity: 8 }],
    });
  });

  it("a MANAGER saving PO-064 (completed) is refused and nothing is written", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-064", status: "COMPLETED", subtotal_amount: 100_000 });

    const res = await savePurchaseOrder(form("COMPLETED", "PO-064"));

    expect(res.error).toBe(OWNER_REFUSAL);
    expect(mocks.requireOwner).toHaveBeenCalledTimes(1);
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("the owner saving the same completed order goes through", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "adm-1", name: "Chủ quán", role: "ADMIN" } });
    mocks.findById.mockResolvedValue({ id: "PO-064", status: "COMPLETED", subtotal_amount: 100_000 });

    const res = await savePurchaseOrder(form("COMPLETED", "PO-064"));

    expect(res.error).toBeUndefined();
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalledTimes(1);
  });

  it("a MANAGER may still save a draft and finish it (draft -> completed)", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-201", status: "DRAFT", subtotal_amount: 100_000 });

    const res = await savePurchaseOrder(form("COMPLETED", "PO-201"));

    expect(res.error).toBeUndefined();
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalledTimes(1);
  });

  it("a MANAGER may still create a new order", async () => {
    const res = await savePurchaseOrder(form("COMPLETED", ""));

    expect(res.error).toBeUndefined();
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findById: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findById: mocks.findById,
  insert: vi.fn(),
  generateNewId: vi.fn(),
  getCacheTag: (t: string) => `sheets-${t}`,
}));
vi.mock("@/lib/purchasing/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: () => ({ order: {}, lines: [] }),
}));
vi.mock("@/lib/purchasing/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { savePurchaseOrder } from "./actions";

const tables: Record<string, unknown[]> = {
  Suppliers: [{ id: "NCC-OFF", name: "Circle K", status: "INACTIVE" }],
  Purchased_Items: [{ id: "SPM-OFF", name: "Trứng gà", status: "INACTIVE" }],
};

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  f.set("supplier_id", "NCC-OFF");
  f.set("source_id", "SRC-1");
  f.set("transaction_date", "2026-10-01");
  f.set("payment_method", "CASH");
  f.set("status", "DRAFT");
  f.set("subtotal_amount", "0");
  f.set("lines_json", JSON.stringify([{ purchased_item_id: "SPM-OFF", unit: "Kg", quantity: 1, subtotal: 0 }]));
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("savePurchaseOrder refuses stopped suppliers and items (BR-CATALOG-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "A" } });
    mocks.findAll.mockImplementation(async (t: string) => tables[t] ?? []);
    mocks.findAllNoCache.mockResolvedValue([]);
    mocks.findById.mockResolvedValue(null);
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-9" });
  });

  it("refuses a stopped supplier on a new order", async () => {
    const res = await savePurchaseOrder(form({ lines_json: "[]" }));
    expect(res.error).toBe("Nhà cung cấp Circle K đã ngừng hợp tác.");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("refuses a stopped item on a new order", async () => {
    mocks.findAll.mockImplementation(async (t: string) => (t === "Suppliers" ? [] : tables[t] ?? []));
    const res = await savePurchaseOrder(form({}));
    expect(res.error).toBe("Trứng gà đã ngừng dùng.");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("lets an existing order keep its own stopped supplier and item", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-9", status: "DRAFT", supplier_id: "NCC-OFF" });
    mocks.findAllNoCache.mockResolvedValue([{ id: "POL-1", purchase_order_id: "PO-9", purchased_item_id: "SPM-OFF" }]);
    const res = await savePurchaseOrder(form({ id: "PO-9" }));
    expect(res.success).toBe(true);
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalled();
  });
});

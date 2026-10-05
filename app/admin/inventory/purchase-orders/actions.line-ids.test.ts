import { beforeEach, describe, expect, it, vi } from "vitest";

// The real write plan runs here (not mocked): the point is the ids that reach
// the atomic save, so an asset made from a line stays linked after an edit.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findById: mocks.findById,
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
}));
vi.mock("@/lib/purchasing/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { savePurchaseOrder } from "./actions";

// Vòi rót rượu: an equipment item, no conversion rows (bought in base units).
const ITEMS = [{ id: "SPM-080", name: "Vòi rót rượu", item_category_id: "NHH-003", base_ingredient_id: "" }];

function form(id: string): FormData {
  const f = new FormData();
  f.set("id", id);
  f.set("supplier_id", "SUP-1");
  f.set("source_id", "SRC-1");
  f.set("transaction_date", "2026-08-13T00:00:00.000Z");
  f.set("status", "COMPLETED");
  f.set("payment_method", "CASH");
  f.set("subtotal_amount", "20200");
  f.set("lines_json", JSON.stringify([{ purchased_item_id: "SPM-080", unit: "Cái", quantity: 2, subtotal: 20200 }]));
  return f;
}

describe("savePurchaseOrder keeps stored line ids on an edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Quản lý" } });
    mocks.generateNewId.mockResolvedValue("POE-001");
    mocks.savePurchaseOrderAtomic.mockImplementation(async (input: { order: { id: string }; lines: unknown[] }) => ({
      purchaseOrderId: input.order.id || "PO-NEW",
      lineCount: input.lines.length,
    }));
    mocks.findById.mockResolvedValue({ id: "PO-147", status: "COMPLETED", subtotal_amount: 20200, payment_method: "CASH" });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return [
          { id: "POL-x", purchase_order_id: "PO-147", purchased_item_id: "SPM-080" },
          { id: "POL-other", purchase_order_id: "PO-999", purchased_item_id: "SPM-080" },
        ];
      }
      if (sheet === "Purchased_Items") return ITEMS;
      return [];
    });
  });

  it("sends the stored line id of Vòi rót rượu again, never another order's id", async () => {
    const res = await savePurchaseOrder(form("PO-147"));

    expect(res.success).toBe(true);
    const sent = mocks.savePurchaseOrderAtomic.mock.calls[0][0];
    expect(sent.lines.map((l: { id: string }) => l.id)).toEqual(["POL-x"]);
  });

  it("mints a fresh id for a new order", async () => {
    mocks.findById.mockResolvedValue(null);
    await savePurchaseOrder(form(""));

    const sent = mocks.savePurchaseOrderAtomic.mock.calls[0][0];
    expect(sent.lines[0].id).toMatch(/^POL-/);
    expect(sent.lines[0].id).not.toBe("POL-x");
  });
});

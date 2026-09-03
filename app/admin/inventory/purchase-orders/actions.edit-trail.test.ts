import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  buildPurchaseOrderWritePlan: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findById: mocks.findById,
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
}));
vi.mock("@/lib/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: mocks.buildPurchaseOrderWritePlan,
}));
vi.mock("@/lib/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

import { savePurchaseOrder } from "./actions";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  formData.set("supplier_id", "SUP-1");
  // section 3: savePurchaseOrder now also requires source_id for a
  // COMPLETED order.
  formData.set("source_id", "SRC-1");
  formData.set("transaction_date", "2026-07-29");
  formData.set("status", "COMPLETED");
  formData.set("subtotal_amount", "102000");
  formData.set(
    "lines_json",
    JSON.stringify([{ purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 }]),
  );
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("savePurchaseOrder edit trail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return [
          { id: "POL-001", po_id: "PO-037", purchased_item_id: "PI-1", subtotal: 51000 },
          { id: "POL-002", po_id: "PO-037", purchased_item_id: "PI-1", subtotal: 51000 },
        ];
      }
      return [];
    });
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-090" }],
      ledgerRows: [],
    });
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-037" });
    mocks.generateNewId.mockResolvedValue("POE-001");
  });

  it("inserts exactly one edit-trail row when editing an existing PO", async () => {
    mocks.findById.mockResolvedValue({
      id: "PO-037",
      status: "COMPLETED",
      subtotal_amount: 3571000,
    });
    const formData = buildFormData({ id: "PO-037" });

    const res = await savePurchaseOrder(formData);

    expect(res.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith(
      "purchase_order_edits",
      expect.objectContaining({
        purchase_order_id: "PO-037",
        previous_status: "COMPLETED",
        previous_subtotal_amount: 3571000,
        previous_line_count: 2,
        new_subtotal_amount: 102000,
        new_line_count: 1,
      }),
    );
  });

  it("inserts no edit-trail row when creating a new PO", async () => {
    const formData = buildFormData({});

    const res = await savePurchaseOrder(formData);

    expect(res.success).toBe(true);
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

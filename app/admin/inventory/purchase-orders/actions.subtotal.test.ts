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
  // docs/superpowers/plans/2026-08-26-errors-the-owner-can-act-on.md
  // section 3: savePurchaseOrder now also requires source_id for a
  // COMPLETED order, mirroring supplier_id -- defaulted here the same way,
  // so every test in this file keeps exercising its own actual subject
  // (the subtotal guard) rather than tripping the new header check first.
  formData.set("source_id", "SRC-1");
  formData.set("transaction_date", "2026-07-29");
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("savePurchaseOrder header/lines subtotal guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý" },
    });
    mocks.findAll.mockResolvedValue([]);
    mocks.findById.mockResolvedValue(null);
    mocks.generateNewId.mockResolvedValue("POE-001");
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [],
      ledgerRows: [],
    });
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-999" });
  });

  it("rejects a COMPLETED purchase order whose header total does not match its lines", async () => {
    const formData = buildFormData({
      status: "COMPLETED",
      subtotal_amount: "3571000",
      lines_json: JSON.stringify([
        { purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 },
      ]),
    });

    const res = await savePurchaseOrder(formData);

    expect(res.error).toContain("không khớp");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("accepts a COMPLETED purchase order whose header total matches its lines", async () => {
    const formData = buildFormData({
      status: "COMPLETED",
      subtotal_amount: "102000",
      lines_json: JSON.stringify([
        { purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 },
      ]),
    });

    const res = await savePurchaseOrder(formData);

    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalled();
  });

  it("still reports success when the edit-trail write fails", async () => {
    mocks.findById.mockResolvedValueOnce({ id: "PO-037", status: "COMPLETED", subtotal_amount: 102000 });
    mocks.insert.mockRejectedValueOnce(
      new Error("findAll(purchase_order_edits): Could not find the table 'public.purchase_order_edits' in the schema cache"),
    );

    const formData = buildFormData({
      id: "PO-037",
      status: "COMPLETED",
      subtotal_amount: "102000",
      lines_json: JSON.stringify([
        { purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 },
      ]),
    });

    const res = await savePurchaseOrder(formData);

    // The atomic save committed; a bookkeeping failure must not mask that.
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("does not apply the check to DRAFT saves", async () => {
    const formData = buildFormData({
      status: "DRAFT",
      subtotal_amount: "3571000",
      lines_json: JSON.stringify([{ purchased_item_id: "PI-1", quantity: 1, subtotal: 0 }]),
    });

    const res = await savePurchaseOrder(formData);

    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });
});

// docs/superpowers/plans/2026-08-26-errors-the-owner-can-act-on.md section 3:
// PurchaseOrderForm.tsx's client-side check is the fix for the form, this
// is its server-side neighbour -- a request that reaches savePurchaseOrder
// without going through that form (or a future caller that forgets to)
// must be refused the same way, not left to fail downstream with no
// relation to what was actually missing.
describe("savePurchaseOrder source_id guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý" },
    });
  });

  it("refuses a COMPLETED order with no source_id, before touching storage", async () => {
    const formData = buildFormData({
      status: "COMPLETED",
      source_id: "",
      subtotal_amount: "102000",
      lines_json: JSON.stringify([{ purchased_item_id: "PI-1", quantity: 1, subtotal: 102000 }]),
    });

    const res = await savePurchaseOrder(formData);

    expect(res.error).toBeTruthy();
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("does not apply the source_id check to DRAFT saves, matching supplier_id and lines", async () => {
    mocks.findAll.mockResolvedValue([]);
    mocks.findById.mockResolvedValue(null);
    mocks.generateNewId.mockResolvedValue("POE-002");
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({ order: {}, lines: [], ledgerRows: [] });
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-998" });

    const formData = buildFormData({
      status: "DRAFT",
      source_id: "",
      lines_json: "[]",
    });

    const res = await savePurchaseOrder(formData);

    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });
});

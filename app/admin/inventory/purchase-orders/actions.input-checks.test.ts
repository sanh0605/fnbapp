import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
  cancelAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findById: mocks.findById,
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
  getCacheTag: (t: string) => `sheets-${t}`,
}));
vi.mock("@/lib/purchasing/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: () => ({ order: {}, lines: [] }),
}));
vi.mock("@/lib/purchasing/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("@/lib/purchasing/purchase-order-cancel-transaction", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/purchasing/purchase-order-cancel-transaction")>()),
  cancelPurchaseOrderAtomic: mocks.cancelAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { addPurchaseSource, cancelPurchaseOrder, savePurchaseOrder } from "./actions";

const LINES = JSON.stringify([
  { purchased_item_id: "PI-1", unit: "Kg", conversion_id: "CV-1", quantity: 10, subtotal: 170000 },
]);

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  f.set("supplier_id", "SUP-1");
  f.set("source_id", "SRC-1");
  f.set("transaction_date", "2026-10-01");
  f.set("payment_method", "CASH");
  f.set("status", "DRAFT");
  f.set("subtotal_amount", "170000");
  f.set("lines_json", LINES);
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("savePurchaseOrder input checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "A" } });
    mocks.findAll.mockResolvedValue([]);
    mocks.findAllNoCache.mockResolvedValue([]);
    mocks.findById.mockResolvedValue(null);
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-9" });
  });

  it.each([
    ["shipping_fee", "-19600", "Phí vận chuyển không được âm."],
    ["tax_amount", "-1", "Thuế không được âm."],
    ["voucher_amount", "-1", "Voucher không được âm."],
    ["discount_amount", "-1", "Chiết khấu không được âm."],
    ["subtotal_amount", "-170000", "Tổng tiền hàng không được âm."],
  ])("refuses a negative %s with a Vietnamese message and writes nothing", async (field, value, message) => {
    const res = await savePurchaseOrder(form({ [field]: value }));
    expect(res.error).toBe(message);
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("refuses a fractional dong", async () => {
    const res = await savePurchaseOrder(form({ shipping_fee: "1500.5" }));
    expect(res.error).toBe("Phí vận chuyển phải là số đồng nguyên.");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("refuses a discount that makes the total negative", async () => {
    const res = await savePurchaseOrder(form({ discount_amount: "200000" }));
    expect(res.error).toBe("Tổng tiền đơn không được âm. Kiểm tra lại chiết khấu và voucher.");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("refuses a negative line quantity, even on a draft", async () => {
    const lines = JSON.stringify([{ purchased_item_id: "PI-1", unit: "Kg", quantity: -2, subtotal: 0 }]);
    const res = await savePurchaseOrder(form({ lines_json: lines, subtotal_amount: "0" }));
    expect(res.error).toBe("Dòng 1: Số lượng không được âm");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("still saves a draft line whose quantity box is empty", async () => {
    const lines = JSON.stringify([{ purchased_item_id: "PI-1", unit: "Kg", quantity: "", subtotal: 0 }]);
    const res = await savePurchaseOrder(form({ lines_json: lines, subtotal_amount: "0" }));
    expect(res.success).toBe(true);
  });

  it("reads the stored order's lines fresh, not through the cache", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-9", status: "DRAFT" });
    mocks.findAllNoCache.mockResolvedValue([{ id: "POL-1", purchase_order_id: "PO-9", purchased_item_id: "PI-1" }]);
    await savePurchaseOrder(form({ id: "PO-9" }));
    expect(mocks.findAllNoCache).toHaveBeenCalledWith("Purchase_Order_Lines");
    expect(mocks.findAll).not.toHaveBeenCalledWith("Purchase_Order_Lines");
  });

  it("turns the English duplicate-order error into Vietnamese", async () => {
    mocks.savePurchaseOrderAtomic.mockRejectedValue(new Error("Purchase order PO-203 already exists"));
    const res = await savePurchaseOrder(form({}));
    expect(res.error).toBe("Mã phiếu nhập này đã có rồi. Tải lại trang rồi lưu lại.");
  });
});

describe("cancelPurchaseOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "A" } });
    mocks.cancelAtomic.mockResolvedValue({ cancelled: true, retiredAssetIds: ["TS-1"] });
  });

  it("also refreshes the asset list's cache tag", async () => {
    const res = await cancelPurchaseOrder({ id: "PO-147", reason: "Nhập trùng" });
    expect(res.success).toBe(true);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-assets");
  });
});

describe("addPurchaseSource length", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "A" } });
    mocks.findAll.mockResolvedValue([]);
    mocks.generateNewId.mockResolvedValue("SRC-9");
  });

  it("refuses a name over 100 characters", async () => {
    const res = await addPurchaseSource("x".repeat(101));
    expect(res.error).toBe("Tên nguồn tối đa 100 ký tự");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("accepts exactly 100", async () => {
    const res = await addPurchaseSource("x".repeat(100));
    expect(res.success).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
  fetchCheck: vi.fn(),
  cancelAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
vi.mock("@/lib/purchasing/purchase-order-cancel-transaction", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/purchasing/purchase-order-cancel-transaction")>()),
  fetchPurchaseOrderCancelCheck: mocks.fetchCheck,
  cancelPurchaseOrderAtomic: mocks.cancelAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { cancelPurchaseOrder, getPurchaseOrderCancelView, savePurchaseOrder } from "./actions";
import { CancelFunctionMissingError } from "@/lib/purchasing/purchase-order-cancel-transaction";

const STAFF_REFUSAL = "Chỉ Admin hoặc Manager mới có quyền thực hiện thao tác này";
const TRUNG_GA = {
  code: "NEGATIVE" as const, itemId: "SPM-1", itemName: "Trứng gà", lowBalance: 21,
  lowAt: "2026-10-03T15:32:00Z", orderQty: 60, baseUnit: "trái",
};

describe("cancelPurchaseOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "mgr-1", name: "Quản lý Lan", role: "MANAGER" } });
  });

  it("refuses STAFF and never calls the database", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: STAFF_REFUSAL });
    const res = await cancelPurchaseOrder({ id: "PO-147", reason: "Nhập trùng" });
    expect(res).toEqual({ error: STAFF_REFUSAL });
    expect(mocks.cancelAtomic).not.toHaveBeenCalled();
  });

  it("refuses a blank reason and a 501-character reason without calling the database", async () => {
    expect(await cancelPurchaseOrder({ id: "PO-147", reason: "   " })).toEqual({ error: "Lý do huỷ phiếu là bắt buộc" });
    expect(await cancelPurchaseOrder({ id: "PO-147", reason: "a".repeat(501) })).toEqual({ error: "Lý do huỷ tối đa 500 ký tự" });
    expect(mocks.cancelAtomic).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and the signed-in name, never a name from the input", async () => {
    mocks.cancelAtomic.mockResolvedValue({ cancelled: true, retiredAssetIds: ["TS-080"] });
    const res = await cancelPurchaseOrder({ id: "PO-147", reason: "  Nhập trùng  ", actorName: "Kẻ giả" } as never);
    expect(mocks.cancelAtomic).toHaveBeenCalledWith({ id: "PO-147", reason: "Nhập trùng", actorId: "mgr-1", actorName: "Quản lý Lan" });
    expect(res).toEqual({ success: true, retiredAssetIds: ["TS-080"] });
  });

  it("revalidates the list, the order, assets, finance and P&L after a cancel", async () => {
    mocks.cancelAtomic.mockResolvedValue({ cancelled: true, retiredAssetIds: [] });
    await cancelPurchaseOrder({ id: "PO-147", reason: "Nhập trùng" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Purchase_Orders");
    const paths = mocks.revalidatePath.mock.calls.map(c => c[0]);
    expect(paths).toEqual(expect.arrayContaining([
      "/admin/inventory/purchase-orders", "/admin/inventory/purchase-orders/PO-147",
      "/admin/inventory/assets", "/admin/finance", "/admin/reports/pnl",
    ]));
  });

  it("turns a refusal into the Vietnamese sentences, one per line", async () => {
    mocks.cancelAtomic.mockResolvedValue({ cancelled: false, blocked: [TRUNG_GA, { code: "DISPOSED", assetId: "TS-080", name: "Vòi rót rượu" }] });
    const res = await cancelPurchaseOrder({ id: "PO-064", reason: "Nhập trùng" });
    expect(res.error).toBe([
      "Huỷ phiếu này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái. Hàng của phiếu đã được dùng, nên phiếu này là thật.",
      "Tài sản TS-080 Vòi rót rượu của phiếu đã thanh lý, nên không huỷ được phiếu.",
    ].join("\n"));
    expect(res.success).toBeUndefined();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says the data is not updated yet when the function does not exist", async () => {
    mocks.cancelAtomic.mockRejectedValue(new CancelFunctionMissingError("missing"));
    expect(await cancelPurchaseOrder({ id: "PO-147", reason: "Nhập trùng" }))
      .toEqual({ error: "Chưa cập nhật dữ liệu, chưa huỷ được phiếu." });
  });
});

describe("getPurchaseOrderCancelView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "mgr-1", name: "Quản lý Lan", role: "MANAGER" } });
    mocks.findById.mockImplementation(async (sheet: string, id: string) => {
      if (sheet === "Purchase_Orders") {
        return id === "PO-147"
          ? { id, supplier_id: "SUP-1", transaction_date: "2026-08-12T17:00:00+00:00", created_at: "2026-08-13T01:00:00+00:00",
              total_amount: "20200", status: "COMPLETED", payment_method: "CASH" }
          : null;
      }
      if (sheet === "Suppliers") return { id: "SUP-1", name: "Bếp Việt" };
      return null;
    });
  });

  it("is refused for STAFF (throws, like the other admin reads)", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: STAFF_REFUSAL });
    await expect(getPurchaseOrderCancelView("PO-147")).rejects.toThrow(STAFF_REFUSAL);
  });

  it("not-found for an unknown order", async () => {
    expect(await getPurchaseOrderCancelView("PO-999")).toEqual({ state: "not-found" });
    expect(mocks.fetchCheck).not.toHaveBeenCalled();
  });

  it("missing-migration when the check function does not exist yet", async () => {
    mocks.fetchCheck.mockRejectedValue(new CancelFunctionMissingError("missing"));
    expect(await getPurchaseOrderCancelView("PO-147")).toEqual({ state: "missing-migration" });
  });

  const BASE_ORDER = {
    id: "PO-147", supplier_id: "SUP-1", transaction_date: "2026-08-12T17:00:00+00:00", created_at: "2026-08-13T01:00:00+00:00",
    total_amount: "20200", status: "COMPLETED", payment_method: "CASH",
  };
  const EXTRA_ZERO = {
    subtotalAmount: 0, shippingFee: 0, taxAmount: 0, discountTotal: 0, invoiceCode: "", sourceName: "—", notes: "",
  };

  function mockTables(tables: Record<string, unknown[]>) {
    mocks.findAll.mockImplementation(async (sheet: string) => tables[sheet] ?? []);
  }

  it("ready: header, no blockers, the asset that will be retired", async () => {
    mocks.fetchCheck.mockResolvedValue({ blocked: [], assets: [{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, totalCost: 20200 }] });
    mockTables({});
    expect(await getPurchaseOrderCancelView("PO-147")).toEqual({
      state: "ready",
      order: { id: "PO-147", dateText: "13/08/2026 00:00:00", supplierName: "Bếp Việt", totalAmount: 20200, paymentLabel: "Tiền mặt", status: "COMPLETED", ...EXTRA_ZERO },
      lines: [],
      blockedMessages: [],
      assets: [{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, totalCost: 20200 }],
    });
  });

  it("real order PO-195: one line and the money breakdown", async () => {
    mocks.fetchCheck.mockResolvedValue({ blocked: [], assets: [] });
    mocks.findById.mockImplementation(async (sheet: string) => {
      if (sheet === "Purchase_Orders") return {
        ...BASE_ORDER, id: "PO-195", subtotal_amount: "3140000", shipping_fee: "59600", tax_amount: "0",
        voucher_amount: "656200", discount_amount: "100000", total_amount: "2443400",
        supplier_invoice_code: "HD-77", source_id: "SRC-1", notes: "Giao buổi sáng",
      };
      if (sheet === "Suppliers") return { id: "SUP-1", name: "Bếp Việt" };
      return null;
    });
    mockTables({
      Purchase_Order_Lines: [
        { id: "POL-24a1a94b-e556-41ec-8786-52bfa0b77915", purchase_order_id: "PO-195", purchased_item_id: "PI-1", unit: "U-008",
          quantity: "20.000000", unit_price: "157000", subtotal: "3140000", created_at: "2026-10-01T01:00:00Z" },
        { id: "POL-other", purchase_order_id: "PO-999", purchased_item_id: "PI-1", unit: "U-008", quantity: "1", unit_price: "1", subtotal: "1", created_at: "2026-10-01T01:00:00Z" },
      ],
      Purchased_Items: [{ id: "PI-1", name: "Bột cà phê MR.PHIN Robusta Dak Mil" }],
      Units: [{ id: "U-008", name: "Túi" }],
      Purchase_Sources: [{ id: "SRC-1", name: "Chợ đầu mối" }],
    });
    const view = await getPurchaseOrderCancelView("PO-195");
    expect(view).toMatchObject({
      state: "ready",
      order: {
        subtotalAmount: 3140000, shippingFee: 59600, taxAmount: 0, discountTotal: 756200, totalAmount: 2443400,
        invoiceCode: "HD-77", sourceName: "Chợ đầu mối", notes: "Giao buổi sáng",
      },
    });
    expect((view as { lines: unknown }).lines).toEqual([
      { id: "POL-24a1a94b-e556-41ec-8786-52bfa0b77915", itemName: "Bột cà phê MR.PHIN Robusta Dak Mil", unitName: "Túi", quantity: 20, unitPrice: 157000, subtotal: 3140000 },
    ]);
  });

  it("sorts lines by created_at then id; unknown item and unit show the raw ids", async () => {
    mocks.fetchCheck.mockResolvedValue({ blocked: [], assets: [] });
    const line = (id: string, created_at: string) => ({
      id, purchase_order_id: "PO-147", purchased_item_id: "PI-X", unit: "U-X", quantity: "1", unit_price: "10", subtotal: "10", created_at,
    });
    mockTables({
      Purchase_Order_Lines: [
        line("POL-c", "2026-10-02T00:00:00Z"), line("POL-b", "2026-10-01T00:00:00Z"), line("POL-a", "2026-10-01T00:00:00Z"),
      ],
    });
    const view = (await getPurchaseOrderCancelView("PO-147")) as { lines: Array<{ id: string; itemName: string; unitName: string }> };
    expect(view.lines.map(l => l.id)).toEqual(["POL-a", "POL-b", "POL-c"]);
    expect(view.lines[0]).toMatchObject({ itemName: "PI-X", unitName: "U-X" });
  });

  it("null source, invoice code and notes give the dash and empty strings", async () => {
    mocks.fetchCheck.mockResolvedValue({ blocked: [], assets: [] });
    mocks.findById.mockImplementation(async (sheet: string) => {
      if (sheet === "Purchase_Orders") return { ...BASE_ORDER, source_id: null, supplier_invoice_code: null, notes: null };
      if (sheet === "Suppliers") return { id: "SUP-1", name: "Bếp Việt" };
      return null;
    });
    mockTables({ Purchase_Sources: [{ id: "SRC-1", name: "Chợ đầu mối" }] });
    expect(await getPurchaseOrderCancelView("PO-147")).toMatchObject({ order: { sourceName: "—", invoiceCode: "", notes: "" } });
  });

  it("not-found and missing-migration never read the lines or lookup tables", async () => {
    await getPurchaseOrderCancelView("PO-999");
    mocks.fetchCheck.mockRejectedValue(new CancelFunctionMissingError("missing"));
    await getPurchaseOrderCancelView("PO-147");
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it("ready with the refusal sentences when blocked", async () => {
    mocks.fetchCheck.mockResolvedValue({ blocked: [TRUNG_GA], assets: [] });
    const view = await getPurchaseOrderCancelView("PO-147");
    expect(view).toMatchObject({ state: "ready", blockedMessages: [expect.stringContaining("Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái")] });
  });

  it("an already-cancelled order shows its own sentence", async () => {
    mocks.fetchCheck.mockResolvedValue({ blocked: [{ code: "ALREADY_CANCELLED" }], assets: [] });
    const view = await getPurchaseOrderCancelView("PO-147");
    expect(view).toMatchObject({ state: "ready", blockedMessages: ["Phiếu đã huỷ rồi."] });
  });
});

describe("savePurchaseOrder over a cancelled order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "mgr-1", name: "Quản lý Lan", role: "MANAGER" } });
    mocks.findAll.mockResolvedValue([]);
    mocks.findById.mockResolvedValue({ id: "PO-147", status: "CANCELLED", subtotal_amount: 20200 });
  });

  it("is refused before any write, asset or edit-trail row", async () => {
    const f = new FormData();
    f.set("id", "PO-147");
    f.set("supplier_id", "SUP-1");
    f.set("source_id", "SRC-1");
    f.set("transaction_date", "2026-08-13T00:00:00.000Z");
    f.set("status", "COMPLETED");
    f.set("payment_method", "CASH");
    f.set("subtotal_amount", "20200");
    f.set("lines_json", JSON.stringify([{ purchased_item_id: "SPM-080", unit: "Cái", quantity: 2, subtotal: 20200 }]));

    expect(await savePurchaseOrder(f)).toEqual({ error: "Phiếu đã huỷ, không sửa được" });
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { getPurchaseOrderCopySeed } from "./actions";

const STAFF_REFUSAL = "Chỉ Admin hoặc Manager mới có quyền thực hiện thao tác này";

describe("getPurchaseOrderCopySeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "mgr-1", name: "Quản lý Lan", role: "MANAGER" } });
    mocks.findById.mockImplementation(async (sheet: string, id: string) =>
      sheet === "Purchase_Orders" && id === "PO-147"
        ? {
            id, status: "COMPLETED", supplier_id: "SUP-9", source_id: "SRC-2", supplier_invoice_code: null,
            transaction_date: "2026-08-12T17:00:00Z", created_at: "2026-08-13T01:00:00Z", notes: null,
            shipping_fee: "0", tax_amount: "0", voucher_amount: "35000.000000", discount_amount: "0",
            payment_method: "BANK_TRANSFER", bank_account_id: "BA-1",
          }
        : null);
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return [
          { id: "POL-1", purchase_order_id: "PO-147", purchased_item_id: "PI-80", unit: "Cái", quantity: "2",
            subtotal: "55200", conversion_id: "CONV-5", created_at: "2026-08-13T01:00:00Z" },
          { id: "POL-2", purchase_order_id: "PO-OTHER", purchased_item_id: "PI-1", unit: "Kg", quantity: "1",
            subtotal: "1", conversion_id: null, created_at: "2026-08-13T01:00:00Z" },
        ];
      }
      if (sheet === "Bank_Accounts") {
        return [{ id: "BA-1", status: "ACTIVE" }, { id: "BA-2", status: "INACTIVE" }];
      }
      return [];
    });
  });

  it("returns the seed for an existing order, with only its own lines", async () => {
    const seed = await getPurchaseOrderCopySeed("PO-147");
    expect(seed).toMatchObject({
      sourceOrderId: "PO-147",
      sourceCancelled: false,
      supplier_id: "SUP-9",
      voucher_amount: 35000,
      payment_method: "BANK_TRANSFER",
      bank_account_id: "BA-1",
      transaction_date: null,
      supplier_invoice_code: "",
    });
    expect(seed?.lines).toEqual([
      { purchased_item_id: "PI-80", unit: "Cái", quantity: 2, subtotal: 55200, conversion_id: "CONV-5" },
    ]);
  });

  it("returns null for an unknown order", async () => {
    expect(await getPurchaseOrderCopySeed("PO-999")).toBeNull();
  });

  it("throws for a non-admin (like the other admin reads)", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: STAFF_REFUSAL });
    await expect(getPurchaseOrderCopySeed("PO-147")).rejects.toThrow(STAFF_REFUSAL);
    expect(mocks.findById).not.toHaveBeenCalled();
  });
});

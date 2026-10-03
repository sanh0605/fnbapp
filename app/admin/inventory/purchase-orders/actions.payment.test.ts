import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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
  update: mocks.update,
  generateNewId: mocks.generateNewId,
}));
// Echo the order so the test sees exactly what the action handed to the plan.
vi.mock("@/lib/purchasing/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: ({ order }: { order: Record<string, unknown> }) => ({
    order,
    lines: [{ id: "POL-1" }],
  }),
}));
vi.mock("@/lib/purchasing/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

import { savePurchaseOrder, setPurchaseOrderPayment } from "./actions";

function saveForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("supplier_id", "SUP-1");
  fd.set("source_id", "SRC-1");
  fd.set("transaction_date", "2026-09-15");
  fd.set("status", "COMPLETED");
  fd.set("subtotal_amount", "102000");
  fd.set("lines_json", JSON.stringify([{ purchased_item_id: "PI-1", unit: "Túi", quantity: 2, subtotal: 102000 }]));
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function payForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function sentOrder(): Record<string, unknown> {
  return mocks.savePurchaseOrderAtomic.mock.calls[0][0].order;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Quản lý" } });
  mocks.findAll.mockImplementation(async (sheet: string) => {
    if (sheet === "Bank_Accounts") {
      return [
        { id: "BA-001", name: "ACB - Phin Di", status: "ACTIVE" },
        { id: "BA-002", name: "Cũ", status: "INACTIVE" },
      ];
    }
    return [];
  });
  mocks.findById.mockResolvedValue(null);
  mocks.generateNewId.mockResolvedValue("POE-001");
  mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-300" });
});

describe("savePurchaseOrder payment fields", () => {
  it("puts payment_method and bank_account_id into the order sent to the atomic save", async () => {
    const res = await savePurchaseOrder(saveForm({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }));
    expect(res.success).toBe(true);
    expect(sentOrder()).toMatchObject({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" });
  });

  it("sends CASH with a null account even if a stale account id arrives", async () => {
    await savePurchaseOrder(saveForm({ payment_method: "CASH", bank_account_id: "BA-001" }));
    expect(sentOrder()).toMatchObject({ payment_method: "CASH", bank_account_id: null });
  });

  it("refuses a completed new order with no method and writes nothing", async () => {
    const res = await savePurchaseOrder(saveForm({}));
    expect(res.error).toBe("Chọn cách trả tiền");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("refuses Chuyển khoản without an account", async () => {
    const res = await savePurchaseOrder(saveForm({ payment_method: "BANK_TRANSFER" }));
    expect(res.error).toBe("Chọn tài khoản nhận chuyển khoản");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("saves a draft with both empty, sending explicit nulls (never leaving the keys out)", async () => {
    const res = await savePurchaseOrder(saveForm({ status: "DRAFT" }));
    expect(res.success).toBe(true);
    expect(sentOrder()).toHaveProperty("payment_method", null);
    expect(sentOrder()).toHaveProperty("bank_account_id", null);
  });

  it("edit of a completed order whose form sends no payment fields carries the saved values", async () => {
    mocks.findById.mockResolvedValue({
      id: "PO-181", status: "COMPLETED", subtotal_amount: 102000,
      payment_method: "BANK_TRANSFER", bank_account_id: "BA-002", // account stopped since
    });
    const res = await savePurchaseOrder(saveForm({ id: "PO-181" }));
    expect(res.success).toBe(true);
    expect(sentOrder()).toMatchObject({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-002" });
  });

  it("edit with a changed choice uses the form, not the saved values", async () => {
    mocks.findById.mockResolvedValue({
      id: "PO-181", status: "COMPLETED", subtotal_amount: 102000,
      payment_method: "BANK_TRANSFER", bank_account_id: "BA-002",
    });
    await savePurchaseOrder(saveForm({ id: "PO-181", payment_method: "CASH" }));
    expect(sentOrder()).toMatchObject({ payment_method: "CASH", bank_account_id: null });
  });

  it("edit that sends an explicitly blank method on a completed order is refused", async () => {
    mocks.findById.mockResolvedValue({
      id: "PO-181", status: "COMPLETED", subtotal_amount: 102000, payment_method: "CASH", bank_account_id: null,
    });
    const res = await savePurchaseOrder(saveForm({ id: "PO-181", payment_method: "" }));
    expect(res.error).toBe("Chọn cách trả tiền");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("a stopped account is refused on a new order, allowed on re-saving the order that already has it", async () => {
    const fresh = await savePurchaseOrder(saveForm({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-002" }));
    expect(fresh.error).toBe("Tài khoản không còn dùng");
    mocks.findById.mockResolvedValue({
      id: "PO-181", status: "COMPLETED", subtotal_amount: 102000,
      payment_method: "BANK_TRANSFER", bank_account_id: "BA-002",
    });
    const resave = await savePurchaseOrder(
      saveForm({ id: "PO-181", payment_method: "BANK_TRANSFER", bank_account_id: "BA-002" }),
    );
    expect(resave.success).toBe(true);
  });
});

describe("setPurchaseOrderPayment", () => {
  it("writes only payment_method and bank_account_id of a completed order", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-181", status: "COMPLETED", payment_method: "CASH", bank_account_id: null });
    const res = await setPurchaseOrderPayment(
      payForm({ id: "PO-181", payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }),
    );
    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Purchase_Orders", "PO-181", {
      payment_method: "BANK_TRANSFER",
      bank_account_id: "BA-001",
    });
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("refuses a draft with a Vietnamese pointer to the form", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-300", status: "DRAFT" });
    const res = await setPurchaseOrderPayment(payForm({ id: "PO-300", payment_method: "CASH" }));
    expect(res.error).toBe("Phiếu nháp: chọn cách trả trong phiếu");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses an unknown id", async () => {
    const res = await setPurchaseOrderPayment(payForm({ id: "PO-999", payment_method: "CASH" }));
    expect(res.error).toBe("Không tìm thấy phiếu nhập");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a blank method and a Chuyển khoản without an account", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-181", status: "COMPLETED" });
    expect((await setPurchaseOrderPayment(payForm({ id: "PO-181", payment_method: "" }))).error).toBe(
      "Chọn cách trả tiền",
    );
    expect(
      (await setPurchaseOrderPayment(payForm({ id: "PO-181", payment_method: "BANK_TRANSFER" }))).error,
    ).toBe("Chọn tài khoản nhận chuyển khoản");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps a stopped account the order already has", async () => {
    mocks.findById.mockResolvedValue({
      id: "PO-181", status: "COMPLETED", payment_method: "BANK_TRANSFER", bank_account_id: "BA-002",
    });
    const res = await setPurchaseOrderPayment(
      payForm({ id: "PO-181", payment_method: "BANK_TRANSFER", bank_account_id: "BA-002" }),
    );
    expect(res.success).toBe(true);
  });

  it("refuses when not signed in as admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chưa đăng nhập" });
    const res = await setPurchaseOrderPayment(payForm({ id: "PO-181", payment_method: "CASH" }));
    expect(res.error).toBe("Chưa đăng nhập");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import type React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderForm, { validatePurchaseOrderLine } from "./PurchaseOrderForm";
import type { DBBankAccount, DBPurchaseOrder, DBPurchasedItem, DBSupplier, DBPurchaseSource, DBUOMConversion, DBUnit, DBPurchaseOrderLine } from "@/types/db";

// Wave K3 Task 5: Phiếu nhập on the shared number boxes (BR-UI-005, BR-UI-008),
// and the owner's 2026-10-08 "a": a completed order is never saved back as a draft.

const { mockSavePurchaseOrder, router } = vi.hoisted(() => ({
  mockSavePurchaseOrder: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("../actions", () => ({
  savePurchaseOrder: mockSavePurchaseOrder,
  addPurchaseSource: vi.fn(),
}));

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/inventory/purchase-orders/new",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn(),
}));

if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  localStorage.clear();
});

const suppliers: DBSupplier[] = [
  { id: "SUP-1", name: "Thế Kỷ Xanh", phone: "", tax_id: "", address: "", links: "", status: "ACTIVE", created_at: "2026-01-01" },
];
const sources: DBPurchaseSource[] = [{ id: "SRC-1", name: "Shopee", status: "ACTIVE", created_at: "2026-01-01" }];
const items: DBPurchasedItem[] = [
  { id: "ITEM-1", name: "Cà phê Robusta", item_category_id: "CAT-1", default_unit_id: "U-1", status: "ACTIVE", created_at: "2026-01-01", is_non_inventory: false },
];
const conversions: DBUOMConversion[] = [
  { id: "CONV-1", purchased_item_id: "ITEM-1", from_unit_id: "U-1", to_unit_id: "U-1", factor: "1", purchased_unit: "kg", base_unit: "kg", conversion_rate: "1", status: "ACTIVE", purchase_only: false, created_at: "2026-01-01" },
];
const units: DBUnit[] = [{ id: "U-1", name: "kg", abbreviation: "kg", status: "ACTIVE", created_at: "2026-01-01" }];
const accounts: DBBankAccount[] = [];

function order(status: "DRAFT" | "COMPLETED"): { po: DBPurchaseOrder; lines: DBPurchaseOrderLine[] } {
  return {
    po: {
      id: "PO-100", supplier_id: "SUP-1", source_id: "SRC-1", status,
      subtotal: "1500000", total_amount: "1500000", shipping_cost: "0", tax_amount: "0", discount_amount: "0",
      transaction_date: "2026-09-20", created_at: "2026-09-20", payment_method: "CASH",
    } as any,
    lines: [
      {
        id: "POL-1", purchase_order_id: "PO-100", item_id: "ITEM-1", quantity: "12", unit_id: "U-1",
        unit_cost: "125000", subtotal: "1500000", created_at: "2026-09-20",
        conversion_id: "CONV-1", purchased_item_id: "ITEM-1", unit: "kg",
      } as any,
    ],
  };
}

function renderForm(extra: Partial<React.ComponentProps<typeof PurchaseOrderForm>> = {}) {
  return render(
    <PurchaseOrderForm suppliers={suppliers} sources={sources} items={items} conversions={conversions} units={units} bankAccounts={accounts} {...extra} />,
  );
}

async function saveDraftAndRead(): Promise<FormData> {
  mockSavePurchaseOrder.mockResolvedValueOnce({ success: true });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  await waitFor(() => expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1));
  return mockSavePurchaseOrder.mock.calls[0][0] as FormData;
}

describe("PurchaseOrderForm number boxes (wave K3)", () => {
  it("Số lượng is a text box with the decimal keypad; typing 12 saves the line's quantity as \"12\"", async () => {
    renderForm();
    fireEvent.click(screen.getByText("+ Thêm Mặt Hàng Đầu Tiên"));
    const qty = screen.getByLabelText("Số lượng") as HTMLInputElement;
    expect(qty.type).toBe("text");
    expect(qty.inputMode).toBe("decimal");
    fireEvent.change(qty, { target: { value: "12" } });
    expect(qty.value).toBe("12");
    const fd = await saveDraftAndRead();
    expect(JSON.parse(fd.get("lines_json") as string)[0].quantity).toBe("12");
  });

  it("Thành tiền shows 1500000 as 1,500,000 and saves the line's subtotal as \"1500000\"", async () => {
    renderForm();
    fireEvent.click(screen.getByText("+ Thêm Mặt Hàng Đầu Tiên"));
    const sub = screen.getByLabelText("Thành tiền (đ)") as HTMLInputElement;
    expect(sub.inputMode).toBe("numeric");
    fireEvent.change(sub, { target: { value: "1500000" } });
    expect(sub.value).toBe("1,500,000");
    const fd = await saveDraftAndRead();
    expect(JSON.parse(fd.get("lines_json") as string)[0].subtotal).toBe("1500000");
    expect(fd.get("subtotal_amount")).toBe("1500000");
  });

  it("the four extra-cost boxes are number boxes; a 35000 voucher shows 35,000 and posts 35000", async () => {
    renderForm();
    for (const label of ["Phí vận chuyển", "Thuế", "Voucher", "Chiết khấu"]) {
      const box = screen.getByLabelText(label) as HTMLInputElement;
      expect(box.type).toBe("text");
      expect(box.inputMode).toBe("numeric");
    }
    const voucher = screen.getByLabelText("Voucher") as HTMLInputElement;
    fireEvent.change(voucher, { target: { value: "35000" } });
    expect(voucher.value).toBe("35,000");
    const fd = await saveDraftAndRead();
    expect(fd.get("voucher_amount")).toBe("35000");
  });

  it("a voucher left empty posts 0, as today (Review Focus 2)", async () => {
    renderForm();
    const fd = await saveDraftAndRead();
    expect(fd.get("voucher_amount")).toBe("0");
    expect(fd.get("shipping_fee")).toBe("0");
  });

  it("editing PO-100 shows its saved numbers grouped: 12 and 1,500,000", () => {
    renderForm({ initialData: order("DRAFT") });
    expect((screen.getByLabelText("Số lượng") as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("Thành tiền (đ)") as HTMLInputElement).value).toBe("1,500,000");
  });

  it("a draft restored from storage shows its numbers (Review Focus 1)", () => {
    mockSearchParams = new URLSearchParams("draft=1");
    localStorage.setItem("fnb:po-draft:new", JSON.stringify({
      savedAt: Date.now(),
      state: {
        supplierId: "SUP-1", sourceId: "SRC-1", supplierInvoiceCode: "", transactionDate: null, notes: "",
        lines: [{ purchased_item_id: "ITEM-1", unit: "kg", quantity: "3", subtotal: "450000", is_new_unit: false, conversion_id: "CONV-1", conversion_rate: "1" }],
        shippingFee: 20000, taxAmount: 0, voucherAmount: 0, discountAmount: 0, paymentMethod: "CASH", bankAccountId: "",
      },
    }));
    renderForm();
    expect((screen.getByLabelText("Số lượng") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Thành tiền (đ)") as HTMLInputElement).value).toBe("450,000");
    expect((screen.getByLabelText("Phí vận chuyển") as HTMLInputElement).value).toBe("20,000");
  });
});

describe("PurchaseOrderForm save buttons (owner 2026-10-08, BR-INV-015)", () => {
  it("editing a completed order has no Lưu nháp; it is saved with Cập nhật & Hoàn thành", () => {
    renderForm({ initialData: order("COMPLETED") });
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cập nhật & Hoàn thành" })).toBeTruthy();
  });

  it("a draft and a new order still have Lưu nháp", () => {
    renderForm({ initialData: order("DRAFT") });
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeTruthy();
    cleanup();
    renderForm();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeTruthy();
  });
});

// BR-UI-009 (owner 2026-10-08 "a"): a new line's Số lượng starts empty with
// only an example; completing with it empty or 0 is stopped on the page.
describe("PurchaseOrderForm empty quantity (BR-UI-009)", () => {
  it("a new line's Số lượng starts empty with \"Ví dụ: 2\"", () => {
    renderForm();
    fireEvent.click(screen.getByText("+ Thêm Mặt Hàng Đầu Tiên"));
    const qty = screen.getByLabelText("Số lượng") as HTMLInputElement;
    expect(qty.value).toBe("");
    expect(qty.placeholder).toBe("Ví dụ: 2");
  });

  it("a line with no quantity, or 0, is refused with \"Vui lòng nhập số lượng\"", () => {
    const line = { purchased_item_id: "ITEM-1", unit: "kg", conversion_id: "CONV-1" };
    expect(validatePurchaseOrderLine({ ...line, quantity: "" }, conversions)).toBe("Vui lòng nhập số lượng");
    expect(validatePurchaseOrderLine({ ...line, quantity: "0" }, conversions)).toBe("Vui lòng nhập số lượng");
    expect(validatePurchaseOrderLine({ ...line, quantity: "12" }, conversions)).toBeNull();
  });

  it("a draft saved with Số lượng left empty reopens empty, not as 1", () => {
    const draft = order("DRAFT");
    draft.lines[0] = { ...draft.lines[0], quantity: "0" } as any;
    renderForm({ initialData: draft });
    expect((screen.getByLabelText("Số lượng") as HTMLInputElement).value).toBe("");
  });

  it("a draft may still be saved with Số lượng empty", async () => {
    renderForm();
    fireEvent.click(screen.getByText("+ Thêm Mặt Hàng Đầu Tiên"));
    const fd = await saveDraftAndRead();
    expect(JSON.parse(fd.get("lines_json") as string)[0].quantity).toBe("");
  });
});

// K3 review finding 3: an asset warning from the server is not swallowed.
describe("PurchaseOrderForm asset warning (BR-COGS-008)", () => {
  it("a save that returns an asset warning opens the order's page with ?assetWarning=1", async () => {
    mockSavePurchaseOrder.mockResolvedValueOnce({ success: true, po_id: "PO-100", assetWarning: "insert failed" });
    renderForm({ initialData: order("COMPLETED") });
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật & Hoàn thành" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/inventory/purchase-orders/PO-100?assetWarning=1"));
  });

  it("a plain save still goes back to the list", async () => {
    mockSavePurchaseOrder.mockResolvedValueOnce({ success: true, po_id: "PO-100" });
    renderForm({ initialData: order("COMPLETED") });
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật & Hoàn thành" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/inventory/purchase-orders"));
  });
});

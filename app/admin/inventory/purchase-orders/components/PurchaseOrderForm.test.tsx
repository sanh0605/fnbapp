// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderForm from "./PurchaseOrderForm";
import type { DBBankAccount, DBPurchaseOrder, DBPurchasedItem, DBSupplier, DBPurchaseSource, DBUOMConversion, DBUnit, DBPurchaseOrderLine } from "@/types/db";
import type { PurchaseOrderCopySeed } from "@/lib/purchasing/purchase-order-copy";

if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

const { mockSavePurchaseOrder, mockAddPurchaseSource, mockAlert, router } = vi.hoisted(() => ({
  mockSavePurchaseOrder: vi.fn(),
  mockAddPurchaseSource: vi.fn(),
  mockAlert: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("../actions", () => ({
  savePurchaseOrder: mockSavePurchaseOrder,
  addPurchaseSource: mockAddPurchaseSource,
}));

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/inventory/purchase-orders/new",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: mockAlert,
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  if (typeof window !== "undefined") {
    localStorage.clear();
  }
});

const sampleSuppliers: DBSupplier[] = [
  {
    id: "SUP-1",
    name: "Nhà cung cấp A",
    phone: "0900000001",
    tax_id: "0100000001",
    address: "Hà Nội",
    links: "",
    status: "ACTIVE",
    created_at: "2026-01-01",
  },
];

const sampleSources: DBPurchaseSource[] = [
  { id: "SRC-1", name: "Shopee", status: "ACTIVE", created_at: "2026-01-01" },
];

const sampleItems: DBPurchasedItem[] = [
  {
    id: "ITEM-1",
    name: "Cà phê Robusta",
    item_category_id: "CAT-1",
    status: "ACTIVE",
    created_at: "2026-01-01",
    is_non_inventory: false,
  },
];

const sampleConversions: DBUOMConversion[] = [
  { id: "CONV-1", purchased_item_id: "ITEM-1", from_unit_id: "U-1", to_unit_id: "U-1", factor: "1", purchased_unit: "kg", base_unit: "kg", conversion_rate: "1", status: "ACTIVE", purchase_only: false, created_at: "2026-01-01" },
];

const sampleUnits: DBUnit[] = [
  { id: "U-1", name: "kg", status: "ACTIVE", created_at: "2026-01-01" },
];

const sampleAccounts: DBBankAccount[] = [
  {
    id: "BA-001",
    name: "ACB - Phin Di",
    bank_name: "ACB",
    account_number: "123456",
    status: "ACTIVE",
    created_at: "2026-03-26T00:00:00Z",
    created_by_id: null,
    created_by_name: null,
    updated_at: "2026-03-26T00:00:00Z",
    updated_by_id: null,
    updated_by_name: null,
  },
];

const sampleAccountsMulti: DBBankAccount[] = [
  {
    id: "BA-001",
    name: "ACB - Phin Di",
    bank_name: "ACB",
    account_number: "123456",
    status: "ACTIVE",
    created_at: "2026-03-26T00:00:00Z",
    created_by_id: null,
    created_by_name: null,
    updated_at: "2026-03-26T00:00:00Z",
    updated_by_id: null,
    updated_by_name: null,
  },
  {
    id: "BA-002",
    name: "VCB - Kho Quán",
    bank_name: "Vietcombank",
    account_number: "654321",
    status: "ACTIVE",
    created_at: "2026-04-01T00:00:00Z",
    created_by_id: null,
    created_by_name: null,
    updated_at: "2026-04-01T00:00:00Z",
    updated_by_id: null,
    updated_by_name: null,
  },
];

describe("PurchaseOrderForm Trả bằng payment methods", () => {
  it("new order has no radio checked", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );

    const cashRadio = screen.getByLabelText("Tiền mặt") as HTMLInputElement;
    const transferRadio = screen.getByLabelText("Chuyển khoản") as HTMLInputElement;

    expect(cashRadio.checked).toBe(false);
    expect(transferRadio.checked).toBe(false);
    expect(screen.queryByLabelText("Tài khoản")).toBeNull();
  });

  it("saving completed without one shows 'Chọn cách trả tiền'", async () => {
    mockSavePurchaseOrder.mockResolvedValue({
      success: false,
      error: "Chọn cách trả tiền",
    });

    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-NEW",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "50000",
            total_amount: "50000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [
            {
              id: "POL-1",
              purchase_order_id: "PO-NEW",
              item_id: "ITEM-1",
              quantity: "1",
              unit_id: "U-1",
              unit_cost: "50000",
              subtotal: "50000",
              created_at: "2026-10-01",
              conversion_id: "CONV-1",
              purchased_item_id: "ITEM-1",
              unit: "kg",
            } as any,
          ],
        }}
      />
    );

    const completeBtn = screen.getByRole("button", { name: /Tạo|Hoàn thành/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1);
    });

    const formData = mockSavePurchaseOrder.mock.calls[0][0] as FormData;
    expect(formData.get("payment_method")).toBe("");
    expect(formData.get("bank_account_id")).toBe("");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Chọn cách trả tiền")).toBeTruthy();
    });
  });

  it("editing PO with BANK_TRANSFER/BA-001 shows both selected", () => {
    const existingPo: DBPurchaseOrder = {
      id: "PO-100",
      supplier_id: "SUP-1",
      source_id: "SRC-1",
      status: "COMPLETED",
      payment_method: "BANK_TRANSFER",
      bank_account_id: "BA-001",
      subtotal: "100000",
      total_amount: "100000",
      shipping_cost: "0",
      tax_amount: "0",
      discount_amount: "0",
      transaction_date: "2026-10-01",
      created_at: "2026-10-01",
    };

    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
        initialData={{
          po: existingPo,
          lines: [],
        }}
      />
    );

    const transferRadio = screen.getByLabelText("Chuyển khoản") as HTMLInputElement;
    expect(transferRadio.checked).toBe(true);

    const cashRadio = screen.getByLabelText("Tiền mặt") as HTMLInputElement;
    expect(cashRadio.checked).toBe(false);

    const accountSelect = screen.getByLabelText("Tài khoản") as HTMLSelectElement;
    expect(accountSelect.value).toBe("BA-001");
  });

  it("preselects single active account when Chuyển khoản is picked", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );

    const transferRadio = screen.getByLabelText("Chuyển khoản");
    fireEvent.click(transferRadio);

    const accountSelect = screen.getByLabelText("Tài khoản") as HTMLSelectElement;
    expect(accountSelect.value).toBe("BA-001");
  });

  it("does not preselect account when multiple active accounts exist", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccountsMulti}
      />
    );

    const transferRadio = screen.getByLabelText("Chuyển khoản");
    fireEvent.click(transferRadio);

    const accountSelect = screen.getByLabelText("Tài khoản") as HTMLSelectElement;
    expect(accountSelect.value).toBe("");
  });

  it("switching to Tiền mặt clears bank_account_id and hides account select", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );

    const transferRadio = screen.getByLabelText("Chuyển khoản");
    fireEvent.click(transferRadio);
    expect(screen.getByLabelText("Tài khoản")).toBeTruthy();

    const cashRadio = screen.getByLabelText("Tiền mặt");
    fireEvent.click(cashRadio);
    expect(screen.queryByLabelText("Tài khoản")).toBeNull();
  });
});

describe("PurchaseOrderForm copySeed prefill and draft override (BR-INV-016)", () => {
  const seedSuppliers: DBSupplier[] = [
    {
      id: "SUP-BB",
      name: "Cửa Hàng B&B Supplier Ly - Bar",
      phone: "0900000001",
      tax_id: "0100000001",
      address: "Hà Nội",
      links: "",
      status: "ACTIVE",
      created_at: "2026-01-01",
    },
    {
      id: "SUP-OTHER",
      name: "Nhà cung cấp khác",
      phone: "0900000002",
      tax_id: "0100000002",
      address: "TPHCM",
      links: "",
      status: "ACTIVE",
      created_at: "2026-01-01",
    },
  ];

  const seedItems: DBPurchasedItem[] = [
    {
      id: "ITEM-VOI",
      name: "Vòi rót rượu",
      item_category_id: "CAT-1",
      status: "ACTIVE",
      created_at: "2026-01-01",
      is_non_inventory: false,
    },
  ];

  const seedConversions: DBUOMConversion[] = [
    {
      id: "CONV-VOI",
      purchased_item_id: "ITEM-VOI",
      from_unit_id: "U-CAI",
      to_unit_id: "U-CAI",
      factor: "1",
      purchased_unit: "Cái",
      base_unit: "Cái",
      conversion_rate: "1",
      status: "ACTIVE",
      purchase_only: false,
      created_at: "2026-01-01",
    },
  ];

  const seedUnits: DBUnit[] = [
    { id: "U-CAI", name: "Cái", status: "ACTIVE", created_at: "2026-01-01" },
  ];

  const po147Seed: PurchaseOrderCopySeed = {
    sourceOrderId: "PO-147",
    sourceCancelled: false,
    supplier_id: "SUP-BB",
    source_id: "SRC-1",
    supplier_invoice_code: "",
    transaction_date: null,
    notes: "Ghi chú PO-147",
    shipping_fee: 0,
    tax_amount: 0,
    voucher_amount: 35000,
    discount_amount: 0,
    payment_method: "CASH",
    bank_account_id: "",
    lines: [
      {
        purchased_item_id: "ITEM-VOI",
        unit: "Cái",
        quantity: 2,
        subtotal: 55200,
        conversion_id: "CONV-VOI",
      },
    ],
  };

  it("with a seed for PO-147, saving as draft calls savePurchaseOrder with FormData that has NO 'id' and has voucher_amount '35000' and the seed's supplier_id", async () => {
    mockSavePurchaseOrder.mockResolvedValueOnce({ success: true });

    render(
      <PurchaseOrderForm
        suppliers={seedSuppliers}
        sources={sampleSources}
        items={seedItems}
        conversions={seedConversions}
        units={seedUnits}
        bankAccounts={sampleAccounts}
        copySeed={po147Seed}
      />
    );

    const cashRadio = screen.getByLabelText("Tiền mặt") as HTMLInputElement;
    expect(cashRadio.checked).toBe(true);

    const draftBtn = screen.getByRole("button", { name: /Lưu Nháp/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1);
    });

    const formData = mockSavePurchaseOrder.mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBeNull();
    expect(formData.get("supplier_id")).toBe("SUP-BB");
    expect(formData.get("voucher_amount")).toBe("35000");
    expect(formData.get("payment_method")).toBe("CASH");
    expect(formData.get("status")).toBe("DRAFT");
  });

  // Owner 2026-10-14: on a slow connection a second tap must not save a second slip.
  it("after a successful save the buttons stay switched off until the page moves on, so a second tap saves nothing", async () => {
    mockSavePurchaseOrder.mockResolvedValue({ success: true });

    render(
      <PurchaseOrderForm
        suppliers={seedSuppliers}
        sources={sampleSources}
        items={seedItems}
        conversions={seedConversions}
        units={seedUnits}
        bankAccounts={sampleAccounts}
        copySeed={po147Seed}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Lưu nháp/i }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));

    const draftBtn = screen.getByRole("button", { name: /Lưu nháp/i });
    expect(draftBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tạo" })).toBeDisabled();
    fireEvent.click(draftBtn);
    fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
    expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1);
  });

  it("after a failed save the buttons work again", async () => {
    mockSavePurchaseOrder.mockResolvedValue({ success: false, error: "Mất kết nối" });

    render(
      <PurchaseOrderForm
        suppliers={seedSuppliers}
        sources={sampleSources}
        items={seedItems}
        conversions={seedConversions}
        units={seedUnits}
        bankAccounts={sampleAccounts}
        copySeed={po147Seed}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Lưu nháp/i }));
    await waitFor(() => expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /Lưu nháp/i })).not.toBeDisabled());
  });

  it("with ?draft=1 and a stored draft whose supplierId differs, the draft's supplier wins", async () => {
    mockSearchParams = new URLSearchParams("draft=1");
    mockSavePurchaseOrder.mockResolvedValueOnce({ success: true });

    const storedDraft = {
      savedAt: Date.now(),
      state: {
        supplierId: "SUP-OTHER",
        sourceId: "SRC-1",
        supplierInvoiceCode: "",
        transactionDate: null,
        notes: "Ghi chú từ draft",
        lines: [],
        shippingFee: 0,
        taxAmount: 0,
        voucherAmount: 10000,
        discountAmount: 0,
        paymentMethod: "CASH",
        bankAccountId: "",
      },
    };
    localStorage.setItem("fnb:po-draft:new", JSON.stringify(storedDraft));

    render(
      <PurchaseOrderForm
        suppliers={seedSuppliers}
        sources={sampleSources}
        items={seedItems}
        conversions={seedConversions}
        units={seedUnits}
        bankAccounts={sampleAccounts}
        copySeed={po147Seed}
      />
    );

    const draftBtn = screen.getByRole("button", { name: /Lưu Nháp/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1);
    });

    const formData = mockSavePurchaseOrder.mock.calls[0][0] as FormData;
    expect(formData.get("supplier_id")).toBe("SUP-OTHER");
    expect(formData.get("voucher_amount")).toBe("10000");
  });

  describe("PurchaseOrderForm Row 4 styling and wording", () => {
    it("renders Hình thức thanh toán label and does not render Trả bằng", () => {
      render(
        <PurchaseOrderForm
          suppliers={sampleSuppliers}
          sources={sampleSources}
          items={sampleItems}
          conversions={sampleConversions}
          units={sampleUnits}
          bankAccounts={sampleAccounts}
        />
      );

      expect(screen.getByText("Hình thức thanh toán")).toBeTruthy();
      expect(screen.queryByText("Trả bằng")).toBeNull();
    });

    // Wave K3: both boxes are now the shared NumberInput (BR-UI-005), so the
    // test checks they are the same kind of box rather than a pinned class string.
    it("renders Thành tiền and Số lượng as the same shared number box, and Đơn giá without background box", () => {
      render(
        <PurchaseOrderForm
          suppliers={sampleSuppliers}
          sources={sampleSources}
          items={sampleItems}
          conversions={sampleConversions}
          units={sampleUnits}
          bankAccounts={sampleAccounts}
        />
      );
      // A new order starts with no line; open one first.
      fireEvent.click(screen.getByText("+ Thêm mặt hàng đầu tiên"));

      const subtotalInput = screen.getByLabelText("Thành tiền (đ)");
      const quantityInput = screen.getByLabelText("Số lượng");

      expect((subtotalInput as HTMLInputElement).type).toBe("text");
      expect((quantityInput as HTMLInputElement).type).toBe("text");
      expect(subtotalInput.className).toBe(quantityInput.className);
      expect(subtotalInput.className).not.toContain("bg-success");

      const unitPriceLabel = screen.getByText("Đơn giá");
      const unitPriceContainer = unitPriceLabel.nextElementSibling;
      expect(unitPriceContainer).toBeTruthy();
      expect(unitPriceContainer?.className).not.toContain("bg-surface-secondary");
      expect(unitPriceContainer?.className).toContain("text-text-secondary");
    });

    it("renders draft button with text 'Lưu nháp'", () => {
      render(
        <PurchaseOrderForm
          suppliers={sampleSuppliers}
          sources={sampleSources}
          items={sampleItems}
          conversions={sampleConversions}
          units={sampleUnits}
          bankAccounts={sampleAccounts}
        />
      );

      expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeTruthy();
      expect(screen.queryByText(/Draft/i)).toBeNull();
    });
  });
});


// Owner 2026-10-10: a create/edit form looks like the slip's detail page —
// on a computer the lines take the left two thirds and the slip-wide boxes
// stack in the right third; on a phone the same blocks run top to bottom in
// their source order (shared boxes, lines, then money and buttons).
function expectBefore(a: Element, b: Element) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("PurchaseOrderForm two columns (owner 2026-10-10)", () => {
  function renderForm() {
    return render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );
  }

  it("on a computer: lines on the left two thirds, shared boxes then money on the right third", () => {
    renderForm();
    const layout = screen.getByTestId("form-layout");
    expect(layout.className).toMatch(/\bgrid\b/);
    expect(layout.className).toContain("lg:grid-cols-3");
    const lines = screen.getByTestId("form-lines");
    const shared = screen.getByTestId("form-shared");
    const money = screen.getByTestId("form-money");
    expect(lines.className).toContain("lg:col-span-2");
    expect(lines.className).toContain("lg:col-start-1");
    expect(shared.className).toContain("lg:col-start-3");
    expect(money.className).toContain("lg:col-start-3");
    for (const block of [lines, shared, money]) expect(layout.contains(block)).toBe(true);
  });

  it("each box sits in its block", () => {
    renderForm();
    const shared = screen.getByTestId("form-shared");
    const lines = screen.getByTestId("form-lines");
    const money = screen.getByTestId("form-money");
    expect(within(shared).getByText("Nhà cung cấp")).toBeInTheDocument();
    expect(within(shared).getByText("Mã hoá đơn")).toBeInTheDocument();
    expect(within(shared).getByText("Ghi chú")).toBeInTheDocument();
    expect(within(lines).getByText("Chi tiết nhập hàng")).toBeInTheDocument();
    expect(within(money).getByText(/Tổng tiền hàng/)).toBeInTheDocument();
    expect(within(money).getByRole("button", { name: "Lưu nháp" })).toBeInTheDocument();
    expect(within(money).getByRole("button", { name: "Tạo" })).toBeInTheDocument();
  });

  it("on a phone the blocks run shared, lines, money", () => {
    renderForm();
    expectBefore(screen.getByTestId("form-shared"), screen.getByTestId("form-lines"));
    expectBefore(screen.getByTestId("form-lines"), screen.getByTestId("form-money"));
  });

  it("no white frame around the whole form (no frame inside a frame on a phone)", () => {
    const { container } = renderForm();
    let el: HTMLElement | null = screen.getByTestId("form-layout");
    while (el && el !== container) {
      expect(el.className).not.toContain("bg-surface-card");
      el = el.parentElement;
    }
  });
});

describe("PurchaseOrderForm source picker (BR-DATA-007, K4)", () => {
  it("does not render the + Thêm button with window.prompt", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );
    expect(screen.queryByRole("button", { name: "+ Thêm" })).toBeNull();
  });

  it("marks Nguồn nhập hàng field as required", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );
    const shared = screen.getByTestId("form-shared");
    const sourceLabel = within(shared).getByText("Nguồn nhập hàng");
    expect(sourceLabel).toBeInTheDocument();
    expect(sourceLabel.parentElement?.textContent).toContain("*");
  });

  it("creates a new source with onCreateNew and selects it on success", async () => {
    mockAddPurchaseSource.mockResolvedValueOnce({
      success: true,
      data: { id: "SRC-TIKTOK", name: "Tiktok Shop" },
    });

    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );

    const sourceCombobox = screen.getByRole("combobox", { name: "Ví dụ: Shopee, Lazada..." });
    fireEvent.click(sourceCombobox);

    const searchInput = screen.getByRole("textbox", { name: "Tìm trong danh sách" });
    fireEvent.change(searchInput, { target: { value: "Tiktok Shop" } });

    const createBtn = screen.getByRole("button", { name: '+ Thêm "Tiktok Shop"' });
    fireEvent.mouseDown(createBtn);

    await waitFor(() => {
      expect(mockAddPurchaseSource).toHaveBeenCalledWith("Tiktok Shop");
    });

    await waitFor(() => {
      expect(screen.getByText("Tiktok Shop")).toBeInTheDocument();
    });
  });

  it("shows alert error when adding source fails", async () => {
    mockAddPurchaseSource.mockResolvedValueOnce({
      success: false,
      error: "Tên nguồn không hợp lệ",
    });

    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
      />
    );

    const sourceCombobox = screen.getByRole("combobox", { name: "Ví dụ: Shopee, Lazada..." });
    fireEvent.click(sourceCombobox);

    const searchInput = screen.getByRole("textbox", { name: "Tìm trong danh sách" });
    fireEvent.change(searchInput, { target: { value: "Tên Lỗi" } });
    const createBtn = screen.getByRole("button", { name: '+ Thêm "Tên Lỗi"' });
    fireEvent.mouseDown(createBtn);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Lỗi",
          message: "Lỗi: Tên nguồn không hợp lệ",
          variant: "danger",
        })
      );
    });
  });
});


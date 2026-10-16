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
    expect(within(lines).getByText("Hàng nhập")).toBeInTheDocument();
    expect(within(money).getByText(/Tổng tiền hàng/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
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

const sampleItemsWithOngTho: DBPurchasedItem[] = [
  ...sampleItems,
  {
    id: "ITEM-ONGTHO",
    name: "Sữa đặc Ông Thọ",
    item_category_id: "CAT-1",
    status: "ACTIVE",
    created_at: "2026-01-01",
    is_non_inventory: false,
  },
  {
    id: "ITEM-DUONG",
    name: "Đường cát",
    item_category_id: "CAT-1",
    status: "ACTIVE",
    created_at: "2026-01-01",
    is_non_inventory: false,
  },
  {
    id: "ITEM-TRA",
    name: "Trà đen",
    item_category_id: "CAT-1",
    status: "ACTIVE",
    created_at: "2026-01-01",
    is_non_inventory: false,
  },
];

const sampleConversionsWithOngTho: DBUOMConversion[] = [
  ...sampleConversions,
  {
    id: "CONV-ONGTHO",
    purchased_item_id: "ITEM-ONGTHO",
    from_unit_id: "U-HOP",
    to_unit_id: "U-HOP",
    factor: "1",
    purchased_unit: "hộp",
    base_unit: "hộp",
    conversion_rate: "1",
    status: "ACTIVE",
    purchase_only: false,
    created_at: "2026-01-01",
  },
  {
    id: "CONV-DUONG",
    purchased_item_id: "ITEM-DUONG",
    from_unit_id: "U-1",
    to_unit_id: "U-1",
    factor: "1",
    purchased_unit: "kg",
    base_unit: "kg",
    conversion_rate: "1",
    status: "ACTIVE",
    purchase_only: false,
    created_at: "2026-01-01",
  },
  {
    id: "CONV-TRA",
    purchased_item_id: "ITEM-TRA",
    from_unit_id: "U-1",
    to_unit_id: "U-1",
    factor: "1",
    purchased_unit: "kg",
    base_unit: "kg",
    conversion_rate: "1",
    status: "ACTIVE",
    purchase_only: false,
    created_at: "2026-01-01",
  },
];

const sampleUnitsWithHop: DBUnit[] = [
  ...sampleUnits,
  { id: "U-HOP", name: "hộp", status: "ACTIVE", created_at: "2026-01-01" },
];

describe("Ticket 6c: PurchaseOrderForm sections (Thông tin phiếu, Hàng nhập, Thanh toán)", () => {
  it("renders section headings 'Thông tin phiếu', 'Hàng nhập', and 'Thanh toán' with text-sm text-text-secondary and not bold", () => {
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

    const hShared = screen.getByText("Thông tin phiếu");
    const hLines = screen.getByText("Hàng nhập");
    const hPayment = screen.getByText("Thanh toán");

    for (const h of [hShared, hLines, hPayment]) {
      expect(h).toBeInTheDocument();
      expect(h.className).toContain("text-sm");
      expect(h.className).toContain("text-text-secondary");
      expect(h.className).not.toMatch(/\bfont-(bold|semibold)\b/);
    }
  });

  it("hides Thuế, Chiết khấu, Ghi chú behind tap row 'Thuế, chiết khấu, ghi chú' when empty/zero, and tapping opens them", () => {
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

    const toggleBtn = screen.getByText("Thuế, chiết khấu, ghi chú");
    expect(toggleBtn).toBeInTheDocument();

    const taxInput = screen.getByLabelText("Thuế");
    const discountInput = screen.getByLabelText("Chiết khấu");
    const notesInput = screen.getByPlaceholderText("Ví dụ: giao buổi sáng");

    expect(taxInput.closest(".hidden") || taxInput).not.toBeVisible();
    expect(discountInput.closest(".hidden") || discountInput).not.toBeVisible();
    expect(notesInput.closest(".hidden") || notesInput).not.toBeVisible();

    fireEvent.click(toggleBtn);
    expect(taxInput).toBeVisible();
    expect(discountInput).toBeVisible();
    expect(notesInput).toBeVisible();
  });

  it("tap row 'Thuế, chiết khấu, ghi chú' starts open when any value is non-zero or non-empty", () => {
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
            id: "PO-DISCOUNT",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "50000",
            total_amount: "40000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "10000",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [],
        }}
      />
    );

    const discountInput = screen.getByLabelText("Chiết khấu");
    expect(discountInput).toBeVisible();
  });
});

describe("Ticket 6c: PurchaseOrderForm FormActionBar save bar", () => {
  it("create page renders FormActionBar with 'Tạo', 'Lưu nháp', and 'Bỏ'", () => {
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

    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("edit page renders FormActionBar with 'Cập nhật & Hoàn thành' and 'Bỏ thay đổi'", () => {
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
            id: "PO-EDIT",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "100000",
            total_amount: "100000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [],
        }}
      />
    );

    expect(screen.getByRole("button", { name: "Cập nhật & Hoàn thành" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });
});

describe("Ticket 6c: PurchaseOrderLines phone rows, openIndex, and validation", () => {
  const lineOngTho = {
    id: "POL-1",
    purchase_order_id: "PO-1",
    item_id: "ITEM-ONGTHO",
    purchased_item_id: "ITEM-ONGTHO",
    quantity: "10",
    unit: "hộp",
    unit_cost: "38000",
    subtotal: "380000",
    conversion_id: "CONV-ONGTHO",
  };

  it("renders collapsed PhoneRow with item name, line total, and unit breakdown ('Sữa đặc Ông Thọ' … '380,000đ' … '10 hộp × 38,000đ')", () => {
    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-1",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "380000",
            total_amount: "380000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [lineOngTho as any],
        }}
      />
    );

    const phoneRow = container.querySelector(".md\\:hidden") as HTMLElement;
    expect(within(phoneRow).getByText("Sữa đặc Ông Thọ")).toBeInTheDocument();
    expect(within(phoneRow).getByText("380,000đ")).toBeInTheDocument();
    expect(within(phoneRow).getByText("10 hộp × 38,000đ")).toBeInTheDocument();
  });

  it("tapping a collapsed line opens it in place showing its inputs, 'Xong', and 'Xoá dòng', and clicking 'Xong' closes it", () => {
    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-1",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "380000",
            total_amount: "380000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [lineOngTho as any],
        }}
      />
    );

    const phoneRow = container.querySelector(".md\\:hidden") as HTMLElement;
    const collapsedRow = within(phoneRow).getByText("10 hộp × 38,000đ");
    fireEvent.click(collapsedRow);

    const phoneActions = container.querySelector(".flex.md\\:hidden") as HTMLElement;
    const doneBtn = within(phoneActions).getByRole("button", { name: "Xong" });
    const deleteLineBtn = within(phoneActions).getByRole("button", { name: "Xoá dòng" });
    expect(doneBtn).toBeVisible();
    expect(deleteLineBtn).toBeVisible();

    fireEvent.click(doneBtn);
    expect(screen.queryByRole("button", { name: "Xong" })).toBeNull();
    expect(within(phoneRow).getByText("10 hộp × 38,000đ")).toBeInTheDocument();
  });

  it("corner absolute X button is removed on the phone", () => {
    render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-1",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "380000",
            total_amount: "380000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [lineOngTho as any],
        }}
      />
    );

    const absoluteX = document.querySelector(".absolute.top-4.right-4");
    if (absoluteX) {
      expect(absoluteX.className).toMatch(/\bhidden\b/);
      expect(absoluteX.className).toMatch(/\bmd:(block|flex|inline-flex)\b/);
    } else {
      expect(absoluteX).toBeNull();
    }
  });

  it("openIndex rule: newly added line opens immediately", () => {
    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
      />
    );

    fireEvent.click(screen.getByText("+ Thêm mặt hàng đầu tiên"));

    const phoneActions = container.querySelector(".flex.md\\:hidden") as HTMLElement;
    expect(within(phoneActions).getByRole("button", { name: "Xong" })).toBeVisible();
    expect(within(phoneActions).getByRole("button", { name: "Xoá dòng" })).toBeVisible();
  });

  it("openIndex rule (a): pressing 'Tạo' on Phiếu nhập when line 2 has no quantity opens line 2 (its inputs become visible / it is the expanded line) with border-danger", async () => {
    const line1 = {
      purchased_item_id: "ITEM-1",
      unit: "kg",
      conversion_id: "CONV-1",
      quantity: "5",
      subtotal: "100000",
    };
    const line2 = {
      purchased_item_id: "ITEM-ONGTHO",
      unit: "hộp",
      conversion_id: "CONV-ONGTHO",
      quantity: "",
      subtotal: "0",
    };

    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-ERR",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "100000",
            total_amount: "100000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [line1 as any, line2 as any],
        }}
      />
    );

    expect(screen.queryByRole("button", { name: "Xong" })).toBeNull();

    const createBtn = screen.getByRole("button", { name: /Tạo|Cập nhật/ });
    fireEvent.click(createBtn);

    await waitFor(() => {
      const phoneActions = container.querySelector(".flex.md\\:hidden") as HTMLElement;
      expect(within(phoneActions).getByRole("button", { name: "Xong" })).toBeInTheDocument();
    });

    const dangerBox = document.querySelector(".border-danger");
    expect(dangerBox).not.toBeNull();
  });

  it("openIndex rule (b): pressing 'Tạo' while a line is open still submits that line's full quantity", async () => {
    mockSavePurchaseOrder.mockResolvedValueOnce({ success: true, po_id: "PO-SUBMITTED" });

    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-OPEN",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            payment_method: "CASH",
            status: "DRAFT",
            subtotal: "380000",
            total_amount: "380000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [lineOngTho as any],
        }}
      />
    );

    const phoneRow = container.querySelector(".md\\:hidden") as HTMLElement;
    const collapsed = within(phoneRow).getByText("10 hộp × 38,000đ");
    fireEvent.click(collapsed);
    const phoneActions = container.querySelector(".flex.md\\:hidden") as HTMLElement;
    expect(within(phoneActions).getByRole("button", { name: "Xong" })).toBeInTheDocument();

    const createBtn = screen.getByRole("button", { name: /Tạo|Cập nhật/ });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockSavePurchaseOrder).toHaveBeenCalledTimes(1);
    });

    const formData = mockSavePurchaseOrder.mock.calls[0][0] as FormData;
    const linesSubmitted = JSON.parse(formData.get("lines_json") as string);
    expect(linesSubmitted[0].quantity).toBe("10");
    expect(linesSubmitted[0].subtotal).toBe("380000");
  });

  it("openIndex rule (c): open line 3, delete line 1, the open line is still the same item (now line 2)", () => {
    const lines3 = [
      { purchased_item_id: "ITEM-1", unit: "kg", conversion_id: "CONV-1", quantity: "1", subtotal: "50000" },
      { purchased_item_id: "ITEM-DUONG", unit: "kg", conversion_id: "CONV-DUONG", quantity: "2", subtotal: "60000" },
      { purchased_item_id: "ITEM-TRA", unit: "kg", conversion_id: "CONV-TRA", quantity: "3", subtotal: "90000" },
    ];

    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-3",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "200000",
            total_amount: "200000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: lines3 as any,
        }}
      />
    );

    const cards = container.querySelectorAll('[data-testid="po-line-card"]');
    const line3PhoneRow = cards[2].querySelector(".md\\:hidden") as HTMLElement;
    const line3Row = within(line3PhoneRow).getByText("Trà đen");
    fireEvent.click(line3Row);
    const phoneActions = cards[2].querySelector(".flex.md\\:hidden") as HTMLElement;
    expect(within(phoneActions).getByRole("button", { name: "Xong" })).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /Xoá/i });
    fireEvent.click(deleteButtons[0]);

    expect(screen.queryByText("Cà phê Robusta")).toBeNull();
    const openCard = screen.getByRole("button", { name: "Xong" }).closest('[data-testid="po-line-card"]') || screen.getByRole("button", { name: "Xong" }).parentElement;
    expect(openCard?.textContent).toContain("Trà đen");
    expect(openCard?.textContent).not.toContain("Đường cát");
  });

  it("openIndex rule: deleting the open line sets openIndex = null so all lines collapse", () => {
    const lines2 = [
      { purchased_item_id: "ITEM-1", unit: "kg", conversion_id: "CONV-1", quantity: "1", subtotal: "50000" },
      { purchased_item_id: "ITEM-DUONG", unit: "kg", conversion_id: "CONV-DUONG", quantity: "2", subtotal: "60000" },
    ];

    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-2",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "110000",
            total_amount: "110000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: lines2 as any,
        }}
      />
    );

    const cards = container.querySelectorAll('[data-testid="po-line-card"]');
    const line2PhoneRow = cards[1].querySelector(".md\\:hidden") as HTMLElement;
    const line2Row = within(line2PhoneRow).getByText("Đường cát");
    fireEvent.click(line2Row);
    const phoneActions = cards[1].querySelector(".flex.md\\:hidden") as HTMLElement;
    expect(within(phoneActions).getByRole("button", { name: "Xong" })).toBeInTheDocument();

    const deleteOpenLineBtn = within(phoneActions).getByRole("button", { name: "Xoá dòng" });
    fireEvent.click(deleteOpenLineBtn);

    expect(screen.queryByText("Đường cát")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xong" })).toBeNull();
    const remainingCards = container.querySelectorAll('[data-testid="po-line-card"]');
    const remainingPhoneRow = remainingCards[0].querySelector(".md\\:hidden") as HTMLElement;
    expect(within(remainingPhoneRow).getByText("Cà phê Robusta")).toBeInTheDocument();
  });

  it("openIndex rule: a restored draft starts with all lines collapsed", () => {
    mockSearchParams = new URLSearchParams("draft=1");
    const storedDraft = {
      savedAt: Date.now(),
      state: {
        supplierId: "SUP-1",
        sourceId: "SRC-1",
        supplierInvoiceCode: "",
        transactionDate: null,
        notes: "",
        lines: [
          { purchased_item_id: "ITEM-1", unit: "kg", conversion_id: "CONV-1", quantity: "1", subtotal: "50000" },
          { purchased_item_id: "ITEM-ONGTHO", unit: "hộp", conversion_id: "CONV-ONGTHO", quantity: "10", subtotal: "380000" },
        ],
        shippingFee: 0,
        taxAmount: 0,
        voucherAmount: 0,
        discountAmount: 0,
        paymentMethod: "CASH",
        bankAccountId: "",
      },
    };
    localStorage.setItem("fnb:po-draft:new", JSON.stringify(storedDraft));

    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItemsWithOngTho}
        conversions={sampleConversionsWithOngTho}
        units={sampleUnitsWithHop}
        bankAccounts={sampleAccounts}
      />
    );

    expect(screen.queryByRole("button", { name: "Xong" })).toBeNull();
    const cards = container.querySelectorAll('[data-testid="po-line-card"]');
    const row0 = cards[0].querySelector(".md\\:hidden") as HTMLElement;
    const row1 = cards[1].querySelector(".md\\:hidden") as HTMLElement;
    expect(within(row0).getByText("Cà phê Robusta")).toBeInTheDocument();
    expect(within(row1).getByText("Sữa đặc Ông Thọ")).toBeInTheDocument();
  });
});

describe("Ticket 6c-2: PurchaseOrderLines & PurchaseOrderTotals enhancements", () => {
  const lineWithRawUnit = {
    purchased_item_id: "ITEM-1",
    unit: "U-1",
    conversion_id: "CONV-1",
    quantity: "1000",
    subtotal: "50000000",
  };

  it("collapsed row uses <button type='button' className='w-full text-left'> instead of div role='button'", () => {
    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-BTN",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "50000000",
            total_amount: "50000000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [lineWithRawUnit as any],
        }}
      />
    );

    const cards = container.querySelectorAll('[data-testid="po-line-card"]');
    const collapsedBtn = cards[0].querySelector("button.w-full.text-left") as HTMLButtonElement;
    expect(collapsedBtn).toBeInTheDocument();
    expect(collapsedBtn.type).toBe("button");
    expect(cards[0].querySelector('div[role="button"]')).toBeNull();
  });

  it("meta unit shows unit NAME (not raw id) and formats quantity with formatNumber (1000 -> 1,000)", () => {
    const { container } = render(
      <PurchaseOrderForm
        suppliers={sampleSuppliers}
        sources={sampleSources}
        items={sampleItems}
        conversions={sampleConversions}
        units={sampleUnits}
        bankAccounts={sampleAccounts}
        initialData={{
          po: {
            id: "PO-UNIT",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            subtotal: "50000000",
            total_amount: "50000000",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [lineWithRawUnit as any],
        }}
      />
    );

    const cards = container.querySelectorAll('[data-testid="po-line-card"]');
    const phoneRow = cards[0].querySelector(".md\\:hidden") as HTMLElement;
    expect(within(phoneRow).getByText(/1,000 kg × 50,000đ/)).toBeInTheDocument();
    expect(phoneRow.textContent).not.toContain("U-1");
  });

  it("moves 'Ghi chú' into folded block in 'Thanh toán' (form-money), not in 'Thông tin phiếu' (form-shared)", () => {
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

    const sharedBlock = screen.getByTestId("form-shared");
    expect(within(sharedBlock).queryByLabelText("Ghi chú")).toBeNull();

    const moneyBlock = screen.getByTestId("form-money");
    expect(within(moneyBlock).getByLabelText("Ghi chú")).toBeInTheDocument();
  });

  it("folded block is open whenever Thuế, Chiết khấu, or Ghi chú has a value, and toggle is disabled", () => {
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
            id: "PO-NOTES",
            supplier_id: "SUP-1",
            source_id: "SRC-1",
            status: "DRAFT",
            notes: "Ghi chú giao sáng",
            subtotal: "0",
            total_amount: "0",
            shipping_cost: "0",
            tax_amount: "0",
            discount_amount: "0",
            transaction_date: "2026-10-01",
            created_at: "2026-10-01",
          },
          lines: [],
        }}
      />
    );

    const moneyBlock = screen.getByTestId("form-money");
    const toggleBtn = within(moneyBlock).getByRole("button", { name: /Thuế, chiết khấu, ghi chú/i });
    expect(toggleBtn).toBeDisabled();

    const notesInput = within(moneyBlock).getByLabelText("Ghi chú") as HTMLInputElement;
    expect(notesInput.value).toBe("Ghi chú giao sáng");
    const foldedContainer = notesInput.closest(".space-y-2");
    expect(foldedContainer).not.toBeNull();
    expect(foldedContainer?.className).not.toContain("hidden");
  });

  it("toggle line in Thanh toán is at least 48px tall on phone (min-h-[48px] md:min-h-[40px])", () => {
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

    const moneyBlock = screen.getByTestId("form-money");
    const toggleBtn = within(moneyBlock).getByRole("button", { name: /Thuế, chiết khấu, ghi chú/i });
    expect(toggleBtn.className).toContain("min-h-[48px]");
    expect(toggleBtn.className).toContain("md:min-h-[40px]");
  });
});




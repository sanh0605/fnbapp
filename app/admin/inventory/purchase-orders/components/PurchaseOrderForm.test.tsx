// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderForm from "./PurchaseOrderForm";
import type { DBBankAccount, DBPurchaseOrder, DBPurchasedItem, DBSupplier, DBPurchaseSource, DBUOMConversion, DBUnit, DBPurchaseOrderLine } from "@/types/db";

const { mockSavePurchaseOrder, router } = vi.hoisted(() => ({
  mockSavePurchaseOrder: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("../actions", () => ({
  savePurchaseOrder: mockSavePurchaseOrder,
  addPurchaseSource: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/inventory/purchase-orders/new",
  useSearchParams: () => new URLSearchParams(),
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
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
    default_unit_id: "U-1",
    status: "ACTIVE",
    created_at: "2026-01-01",
    is_non_inventory: false,
  },
];

const sampleConversions: DBUOMConversion[] = [
  { id: "CONV-1", purchased_item_id: "ITEM-1", from_unit_id: "U-1", to_unit_id: "U-1", factor: "1", purchased_unit: "kg", base_unit: "kg", conversion_rate: "1", status: "ACTIVE", purchase_only: false, created_at: "2026-01-01" },
];

const sampleUnits: DBUnit[] = [
  { id: "U-1", name: "kg", abbreviation: "kg", status: "ACTIVE", created_at: "2026-01-01" },
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

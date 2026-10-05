// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import PurchaseOrderForm from "./PurchaseOrderForm";
import type {
  DBSupplier,
  DBPurchaseSource,
  DBPurchasedItem,
  DBUOMConversion,
  DBUnit,
  DBPurchaseOrder,
  DBPurchaseOrderLine,
} from "@/types/db";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
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

// jsdom has no layout, so SearchableSelect's scrollIntoView is missing.
if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const { push, replace, refresh, back, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  return {
    push: pushFn,
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    router: { push: pushFn, replace: replaceFn, refresh: refreshFn, back: backFn },
  };
});

let mockPathname = "/admin/inventory/purchase-orders/new";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("../actions", () => ({
  savePurchaseOrder: vi.fn(),
  addPurchaseSource: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn(),
}));

function createSupplier(overrides: Partial<DBSupplier> = {}): DBSupplier {
  return {
    id: "SUP-1",
    name: "Nhà cung cấp 1",
    phone: "0900000001",
    tax_id: "0100000001",
    address: "Hà Nội",
    links: "",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createSource(overrides: Partial<DBPurchaseSource> = {}): DBPurchaseSource {
  return {
    id: "SRC-1",
    name: "Shopee",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createItem(overrides: Partial<DBPurchasedItem> = {}): DBPurchasedItem {
  return {
    id: "ITEM-1",
    name: "Cà phê Robusta",
    item_category_id: "CAT-1",
    default_unit_id: "UNIT-1",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    is_non_inventory: false,
    ...overrides,
  };
}

function createConversion(overrides: Partial<DBUOMConversion> = {}): DBUOMConversion {
  return {
    id: "CONV-1",
    purchased_item_id: "ITEM-1",
    from_unit_id: "UNIT-1",
    to_unit_id: "UNIT-1",
    factor: "1",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    purchased_unit: "kg",
    base_unit: "kg",
    conversion_rate: "1",
    purchase_only: false,
    ...overrides,
  };
}

function createUnit(overrides: Partial<DBUnit> = {}): DBUnit {
  return {
    id: "UNIT-1",
    name: "kg",
    abbreviation: "kg",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createPurchaseOrder(overrides: Partial<DBPurchaseOrder> = {}): DBPurchaseOrder {
  return {
    id: "PO-1",
    supplier_id: "SUP-1",
    source_id: "SRC-1",
    transaction_date: "2026-01-01T00:00:00Z",
    subtotal: "0",
    shipping_cost: "0",
    tax_amount: "0",
    discount_amount: "0",
    total_amount: "0",
    status: "DRAFT",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createPurchaseOrderLine(overrides: Partial<DBPurchaseOrderLine> = {}): DBPurchaseOrderLine {
  return {
    id: "POL-1",
    purchase_order_id: "PO-1",
    item_id: "ITEM-1",
    quantity: "1",
    unit_id: "UNIT-1",
    unit_cost: "10000",
    subtotal: "10000",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  mockPathname = "/admin/inventory/purchase-orders/new";
  mockSearchParams = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("PurchaseOrderForm draft restoration and navigation", () => {
  it("navigates to new supplier page with returnTo including draft=1 and saves draft to localStorage when creating new supplier", async () => {
    mockPathname = "/admin/inventory/purchase-orders/new";
    mockSearchParams = new URLSearchParams();

    render(
      <PurchaseOrderForm
        suppliers={[createSupplier({ id: "SUP-1", name: "Nhà cung cấp 1" })]}
        sources={[createSource()]}
        items={[createItem()]}
        conversions={[createConversion()]}
        units={[createUnit()]}
      />
    );

    // Open SearchableSelect
    const supplierCombobox = screen.getByRole("combobox", { name: "Chọn nhà cung cấp..." });
    fireEvent.click(supplierCombobox);

    // Type "Đại Phát" in SearchableSelect input
    const searchInput = screen.getByPlaceholderText("Gõ để tìm kiếm…");
    fireEvent.change(searchInput, { target: { value: "Đại Phát" } });

    // The add new button should appear with + Thêm "Đại Phát"
    const addBtn = screen.getByText('+ Thêm "Đại Phát"');
    fireEvent.mouseDown(addBtn);

    // Check localStorage
    const saved = localStorage.getItem("fnb:po-draft:new");
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.state).toBeDefined();

    // Check router.push
    expect(push).toHaveBeenCalledTimes(1);
    const pushedUrl = push.mock.calls[0][0];
    const [pushedPath, pushedQuery] = pushedUrl.split("?");
    expect(pushedPath).toBe("/admin/suppliers/new");
    const params = new URLSearchParams(pushedQuery);
    expect(params.get("from")).toBe("po");
    expect(params.get("name")).toBe("Đại Phát");
    expect(params.get("returnTo")).toBe("/admin/inventory/purchase-orders/new?draft=1");
  });

  it("restores draft when draft=1 and newSupplier is in query params, replacing the URL", async () => {
    mockPathname = "/admin/inventory/purchase-orders/new";
    mockSearchParams = new URLSearchParams("draft=1&newSupplier=SUP-2");

    const draftState = {
      savedAt: Date.now(),
      state: {
        supplierId: "SUP-1",
        sourceId: "SRC-1",
        supplierInvoiceCode: "INV-999",
        transactionDate: "2026-10-01T08:00:00.000Z",
        notes: "giao sáng",
        lines: [],
        shippingFee: 0,
        taxAmount: 0,
        voucherAmount: 0,
        discountAmount: 0,
      },
    };
    localStorage.setItem("fnb:po-draft:new", JSON.stringify(draftState));

    render(
      <PurchaseOrderForm
        suppliers={[
          createSupplier({ id: "SUP-1", name: "Nhà cung cấp 1" }),
          createSupplier({ id: "SUP-2", name: "Nhà cung cấp 2" }),
        ]}
        sources={[createSource()]}
        items={[createItem()]}
        conversions={[createConversion()]}
        units={[createUnit()]}
      />
    );

    // Notes field has "giao sáng"
    expect(screen.getByPlaceholderText("Ghi chú thêm...")).toHaveValue("giao sáng");

    // Supplier is SUP-2 ("Nhà cung cấp 2")
    expect(screen.getByText("Nhà cung cấp 2")).toBeInTheDocument();

    // router.replace was called to clean up URL
    expect(replace).toHaveBeenCalledWith("/admin/inventory/purchase-orders/new");
  });

  it("shows yellow warning when draft=1 but draft cannot be restored", async () => {
    mockPathname = "/admin/inventory/purchase-orders/new";
    mockSearchParams = new URLSearchParams("draft=1");

    render(
      <PurchaseOrderForm
        suppliers={[createSupplier()]}
        sources={[createSource()]}
        items={[createItem()]}
        conversions={[createConversion()]}
        units={[createUnit()]}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Không khôi phục được phiếu đang nhập dở");
    expect(replace).toHaveBeenCalledWith("/admin/inventory/purchase-orders/new");
  });
});

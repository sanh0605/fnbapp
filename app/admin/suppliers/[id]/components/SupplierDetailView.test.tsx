// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SupplierDetailView } from "./SupplierDetailView";
import type { DBSupplier } from "@/types/db";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../actions", () => ({
  deleteSupplierAction: vi.fn(),
}));

const vinamilkSupplier: DBSupplier = {
  id: "NCC-029",
  name: "Vinamilk",
  phone: "0901234567",
  tax_id: "", // empty tax_id to test "—"
  address: "10 Tân Trào, Q7, TP.HCM",
  links: "vinamilk.com.vn",
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00Z",
};

const ordersWithTwelve: PurchaseOrderListPage = {
  rows: [
    {
      id: "PO-001",
      dateText: "01/10/2026",
      supplierName: "Vinamilk",
      sourceName: "Kho Tổng",
      status: "COMPLETED",
      totalAmount: 12500000,
    },
  ],
  total: 12,
  page: 1,
  pageCount: 2,
  firstIndex: 1,
  lastIndex: 1,
  rangeError: false,
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("SupplierDetailView", () => {
  it("renders Vinamilk with orders.total = 12 and checks detail view elements", () => {
    const returnTo = "/admin/suppliers?q=vina";
    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={ordersWithTwelve}
        returnTo={returnTo}
        canDelete={false}
        poPageHref={(p) => `/admin/suppliers/NCC-029?returnTo=${encodeURIComponent(returnTo)}&poPage=${p}`}
      />
    );

    // Thấy "Phiếu nhập (12)"
    expect(screen.getByText("Phiếu nhập (12)")).toBeInTheDocument();

    // "Chỉnh sửa" trỏ /admin/suppliers/NCC-029/edit?returnTo=…
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      `/admin/suppliers/NCC-029/edit?returnTo=${encodeURIComponent(returnTo)}`
    );

    // canDelete=false thì không có nút "Xoá"
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();

    // Mã số thuế rỗng hiện "—"
    expect(screen.getByText("Mã số thuế")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders delete button when canDelete is true", () => {
    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={ordersWithTwelve}
        returnTo="/admin/suppliers"
        canDelete={true}
        poPageHref={(p) => `?poPage=${p}`}
      />
    );

    expect(screen.getByRole("button", { name: /Xoá/ })).toBeInTheDocument();
  });

  it("shows empty state when orders is empty", () => {
    const emptyOrders: PurchaseOrderListPage = {
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      firstIndex: 0,
      lastIndex: 0,
  rangeError: false,
    };

    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={false}
        poPageHref={(p) => `?poPage=${p}`}
      />
    );

    expect(screen.getByText("Phiếu nhập (0)")).toBeInTheDocument();
    expect(screen.getByText("Chưa có phiếu nhập nào.")).toBeInTheDocument();
  });
});

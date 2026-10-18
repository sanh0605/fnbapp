// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { SupplierDetailView } from "./SupplierDetailView";
import type { DBSupplier } from "@/types/db";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

const { refreshMock, pushMock } = vi.hoisted(() => {
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return { refreshMock: refreshFn, pushMock: pushFn };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: (...args: any[]) => confirmMock(...args),
}));

const { setSupplierStatusMock, deleteSupplierActionMock } = vi.hoisted(() => ({
  setSupplierStatusMock: vi.fn(),
  deleteSupplierActionMock: vi.fn(),
}));


vi.mock("../../actions", () => ({
  setSupplierStatus: (...args: any[]) => setSupplierStatusMock(...args),
  deleteSupplierAction: (...args: any[]) => deleteSupplierActionMock(...args),
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
      paymentLabel: "Tiền mặt",
    },
  ],
  total: 12,
  page: 1,
  pageCount: 2,
  firstIndex: 1,
  lastIndex: 1,
  rangeError: false,
  daySpan: { first: "2026-03-14", last: "2026-10-01" },
  totals: { count: 0, totalAmount: 0 },
};

const emptyOrders: PurchaseOrderListPage = {
  rows: [],
  total: 0,
  page: 1,
  pageCount: 1,
  firstIndex: 0,
  lastIndex: 0,
  rangeError: false,
  daySpan: null,
  totals: { count: 0, totalAmount: 0 },
};

beforeEach(() => {
  refreshMock.mockReset();
  pushMock.mockReset();
  confirmMock.mockReset();
  setSupplierStatusMock.mockReset();
  deleteSupplierActionMock.mockReset();
});

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

    // Phân trang trang 2
    const page2Link = screen.getByRole("link", { name: "2" });
    expect(page2Link).toHaveAttribute(
      "href",
      "/admin/suppliers/NCC-029?returnTo=%2Fadmin%2Fsuppliers%3Fq%3Dvina&poPage=2"
    );

    // Mã số thuế rỗng hiện "—"
    expect(screen.getByText("Mã số thuế")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();

    // Subtitle shows NCC-029 and no Mã/Tên labels
    expect(screen.getByText("NCC-029")).toHaveClass("text-text-secondary");
    expect(screen.queryByText("Mã")).toBeNull();
    expect(screen.queryByText("Tên")).toBeNull();
  });

  // Final review (BR-UI-007): Phiếu nhập opens on Tháng này, so the link
  // carries the days of the supplier's slips and every status — the list then
  // shows the same slips the heading counts.
  it("Xem trong Phiếu nhập opens the list on the days this supplier's slips span", () => {
    render(
      <SupplierDetailView supplier={vinamilkSupplier} orders={ordersWithTwelve} returnTo="/admin/suppliers" canDelete={false} />
    );
    const href = screen.getByRole("link", { name: /Xem trong Phiếu nhập/ }).getAttribute("href")!;
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/admin/inventory/purchase-orders");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      supplier: "NCC-029", status: "ALL", range: "CUSTOM", from: "2026-03-14", to: "2026-10-01",
    });
  });

  it("ACTIVE supplier shows 'Ngừng hợp tác', INACTIVE shows 'Hợp tác lại'", () => {
    const { unmount } = render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={ordersWithTwelve}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );
    expect(screen.getByRole("button", { name: "Ngừng hợp tác" })).toBeInTheDocument();

    unmount();

    const inactiveSupplier: DBSupplier = {
      ...vinamilkSupplier,
      status: "INACTIVE",
    };
    render(
      <SupplierDetailView
        supplier={inactiveSupplier}
        orders={ordersWithTwelve}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );
    expect(screen.getByRole("button", { name: "Hợp tác lại" })).toBeInTheDocument();
  });

  it("'Xoá' hidden when orders.total > 0, shown when 0 for a viewer who may delete", () => {
    const { unmount } = render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={ordersWithTwelve}
        returnTo="/admin/suppliers"
        canDelete={true}
      />
    );
    // orders.total is 12 (> 0) -> Xoá hidden
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();

    unmount();

    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={true}
      />
    );
    // orders.total is 0 and canDelete is true -> Xoá shown
    expect(screen.getByRole("button", { name: /Xoá/ })).toBeInTheDocument();
  });

  it("clicking 'Hợp tác lại' calls setSupplierStatus with id and status ACTIVE", async () => {
    setSupplierStatusMock.mockResolvedValue({});
    const inactiveSupplier: DBSupplier = {
      ...vinamilkSupplier,
      status: "INACTIVE",
    };

    render(
      <SupplierDetailView
        supplier={inactiveSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    const reactivateBtn = screen.getByRole("button", { name: "Hợp tác lại" });
    fireEvent.click(reactivateBtn);

    await waitFor(() => {
      expect(setSupplierStatusMock).toHaveBeenCalledTimes(1);
    });

    const fd: FormData = setSupplierStatusMock.mock.calls[0][0];
    expect(fd.get("id")).toBe("NCC-029");
    expect(fd.get("status")).toBe("ACTIVE");
    expect(confirmMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("clicking 'Ngừng hợp tác' asks confirmation and calls setSupplierStatus with INACTIVE on confirm", async () => {
    confirmMock.mockResolvedValue(true);
    setSupplierStatusMock.mockResolvedValue({});

    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    const stopBtn = screen.getByRole("button", { name: "Ngừng hợp tác" });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith({
        title: "Ngừng hợp tác",
        message: "Ngừng hợp tác với Vinamilk? Phiếu nhập mới sẽ không chọn được nhà cung cấp này.",
        variant: "danger",
      });
      expect(setSupplierStatusMock).toHaveBeenCalledTimes(1);
    });

    const fd: FormData = setSupplierStatusMock.mock.calls[0][0];
    expect(fd.get("id")).toBe("NCC-029");
    expect(fd.get("status")).toBe("INACTIVE");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("cancelling 'Ngừng hợp tác' does not call setSupplierStatus", async () => {
    confirmMock.mockResolvedValue(false);

    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    const stopBtn = screen.getByRole("button", { name: "Ngừng hợp tác" });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    });

    expect(setSupplierStatusMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows error alert near header when setSupplierStatus fails", async () => {
    setSupplierStatusMock.mockResolvedValue({ error: "Lỗi kết nối máy chủ" });
    const inactiveSupplier: DBSupplier = {
      ...vinamilkSupplier,
      status: "INACTIVE",
    };

    render(
      <SupplierDetailView
        supplier={inactiveSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hợp tác lại" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Lỗi kết nối máy chủ");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows empty state when orders is empty", () => {
    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={emptyOrders}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    expect(screen.getByText("Phiếu nhập (0)")).toBeInTheDocument();
    expect(screen.getByText("Chưa có phiếu nhập nào.")).toBeInTheDocument();
  });

  it("renders Đã huỷ badge for CANCELLED order", () => {
    const ordersWithCancelled: PurchaseOrderListPage = {
      rows: [
        {
          id: "PO-065",
          dateText: "12/08/2026",
          supplierName: "Vinamilk",
          sourceName: "Kho Tổng",
          status: "CANCELLED",
          totalAmount: 180000,
          paymentLabel: "Tiền mặt",
        },
      ],
      total: 1,
      page: 1,
      pageCount: 1,
      firstIndex: 1,
      lastIndex: 1,
      rangeError: false,
      daySpan: { first: "2026-08-12", last: "2026-08-12" },
      totals: { count: 0, totalAmount: 0 },
    };

    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={ordersWithCancelled}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    const badges = screen.getAllByText("Đã huỷ");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders purchase orders on phone as a divide-y list of PhoneRow links with 48px controls", () => {
    render(
      <SupplierDetailView
        supplier={vinamilkSupplier}
        orders={ordersWithTwelve}
        returnTo="/admin/suppliers"
        canDelete={false}
      />
    );

    const mobileList = document.querySelector(".md\\:hidden") as HTMLElement;
    expect(mobileList).toBeInTheDocument();
    expect(mobileList.className).toContain("divide-y");

    const links = within(mobileList).getAllByRole("link");
    expect(links).toHaveLength(1);

    const firstLink = links[0];
    expect(firstLink).toHaveAttribute("href", "/admin/inventory/purchase-orders/PO-001");
    expect(firstLink.className).toContain("px-4");
    expect(firstLink.className).toContain("py-2.5");
    expect(firstLink.className).toContain("min-h-[48px]");
    expect(firstLink.className).not.toContain("min-h-[44px]");
    expect(firstLink.className).not.toContain("p-4");

    // PhoneRow: line 1 has po.id (text-base) and totalAmount; line 2 has dateText · sourceName (text-sm) and status badge
    const titleEl = within(firstLink).getByText("PO-001");
    expect(titleEl.className).toContain("text-base");
    expect(within(firstLink).getByText("12,500,000đ")).toBeInTheDocument();

    const metaEl = within(firstLink).getByText("01/10/2026 · Kho Tổng");
    expect(metaEl.className).toContain("text-sm");
    expect(metaEl.className).not.toContain("text-xs");

    expect(within(firstLink).getByText("Hoàn thành")).toBeInTheDocument();
  });
});

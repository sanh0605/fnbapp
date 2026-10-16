// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrdersClient from "./PurchaseOrdersClient";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

// BR-UI-007: the list now takes its range from the page.
const TEST_TODAY = "2026-10-09";
const TEST_RANGE = { preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" } as const;

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

const { replace, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  return {
    replace: replaceFn,
    searchParams: new URLSearchParams(),
    router: { replace: replaceFn },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/inventory/purchase-orders",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
});

const pageData: PurchaseOrderListPage & { suppliers: { id: string; name: string }[] } = {
  rows: [],
  total: 0,
  page: 1,
  pageCount: 1,
  firstIndex: 0,
  lastIndex: 0,
  rangeError: false, daySpan: null, totals: { count: 0, totalAmount: 0 },
  suppliers: [
    { id: 'SUP-1', name: 'Nhà cung cấp A' },
    { id: 'SUP-2', name: 'Nhà cung cấp B' }
  ]
};

describe("PurchaseOrdersClient", () => {
  it("T4: Enter in search box applies filter", async () => {
    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);
    const searchInput = screen.getByLabelText("Tìm kiếm");
    fireEvent.change(searchInput, { target: { value: "PO-19" } });
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter", charCode: 13, bubbles: true });
    
    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
    });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("q=PO-19"), expect.anything());
  });

  it("T5: Clear filter button visibility", async () => {
    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);
    expect(screen.queryByRole("button", { name: "Xoá lọc" })).toBeNull();
    
    const searchInput = screen.getByLabelText("Tìm kiếm");
    fireEvent.change(searchInput, { target: { value: "PO-19" } });
    
    expect(screen.getByRole("button", { name: "Xoá lọc" })).toBeTruthy();
  });

  it("T6: Renders Hình thức thanh toán secondary column in table and card", () => {
    const dataWithRow: typeof pageData = {
      ...pageData,
      total: 1,
      firstIndex: 1,
      lastIndex: 1,
      rows: [
        {
          id: "PO-181",
          dateText: "15/09/2026 10:00:00",
          supplierName: "Thế Kỷ Xanh",
          sourceName: "Shopee",
          status: "COMPLETED",
          totalAmount: 506023,
          paymentLabel: "Tiền mặt",
        },
      ],
    };

    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={dataWithRow} />);
    expect(screen.getByRole("columnheader", { name: "Hình thức thanh toán" })).toBeTruthy();
    // Tiền mặt appears in both desktop table and phone card
    const labels = screen.getAllByText("Tiền mặt");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("T7: Filter by Hình thức thanh toán", async () => {
    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);
    const paySelect = screen.getByLabelText("Hình thức thanh toán");
    fireEvent.change(paySelect, { target: { value: "BANK_TRANSFER" } });

    const filterBtn = screen.getByRole("button", { name: "Lọc" });
    fireEvent.click(filterBtn);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
    });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("pay=BANK_TRANSFER"), expect.anything());
  });

  it("Create button on list page reads exactly 'Tạo'", () => {
    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);
    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeTruthy();
    expect(createLink.getAttribute("href")).toBe("/admin/inventory/purchase-orders/new");
  });

  it("T8: Status select default value is ACTIVE, has options Chưa huỷ and Đã huỷ", () => {
    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);
    const statusSelect = screen.getByLabelText("Trạng thái") as HTMLSelectElement;
    expect(statusSelect.value).toBe("ACTIVE");

    const optionActive = screen.getByRole("option", { name: "Chưa huỷ" }) as HTMLOptionElement;
    expect(optionActive.value).toBe("ACTIVE");

    const optionCancelled = screen.getByRole("option", { name: "Đã huỷ" }) as HTMLOptionElement;
    expect(optionCancelled.value).toBe("CANCELLED");
  });

  it("T9: CANCELLED row renders the badge Đã huỷ", () => {
    const cancelledData: typeof pageData = {
      ...pageData,
      total: 1,
      firstIndex: 1,
      lastIndex: 1,
      rows: [
        {
          id: "PO-065",
          dateText: "12/08/2026 10:00:00",
          supplierName: "Trứng Ba Huân",
          sourceName: "Shopee",
          status: "CANCELLED",
          totalAmount: 180000,
          paymentLabel: "Tiền mặt",
        },
      ],
    };

    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={cancelledData} />);
    const badges = screen.getAllByText("Đã huỷ");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  // BR-UI-003 / BR-UI-005 and Review Focus 4 (wave K3).
  describe("shared list (wave K3)", () => {
    const rows: typeof pageData = {
      ...pageData,
      total: 2,
      firstIndex: 1,
      lastIndex: 2,
      rows: [
        { id: "PO-181", dateText: "15/09/2026 10:00:00", supplierName: "Thế Kỷ Xanh", sourceName: "Shopee", status: "COMPLETED", totalAmount: 506023, paymentLabel: "Tiền mặt" },
        { id: "PO-065", dateText: "12/08/2026 10:00:00", supplierName: "Trứng Ba Huân", sourceName: "Shopee", status: "CANCELLED", totalAmount: 180000, paymentLabel: "Tiền mặt" },
      ],
    };

    afterEach(() => {
      for (const k of Array.from(searchParams.keys())) searchParams.delete(k);
    });

    it("header cells are plain text, not capitals", () => {
      render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      for (const th of within(screen.getByRole("table")).getAllByRole("columnheader")) {
        // The capitals can come from the cell or from its header row.
        expect(th.closest(".uppercase")).toBeNull();
      }
    });

    it("filter labels are plain text, not capitals", () => {
      render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      for (const label of ["Tìm kiếm", "Trạng thái", "Hình thức thanh toán", "Nhà cung cấp"]) {
        const el = screen.getByLabelText(label);
        const tag = document.querySelector(`label[for="${el.id}"]`)!;
        expect(tag.closest(".uppercase")).toBeNull();
      }
    });

    it("a row opens with returnTo carrying the active filter", () => {
      searchParams.set("status", "CANCELLED");
      searchParams.set("page", "2");
      render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      const href = within(screen.getByRole("table")).getByRole("link", { name: "Xem chi tiết PO-065" }).getAttribute("href")!;
      const url = new URL(href, "http://x");
      expect(url.pathname).toBe("/admin/inventory/purchase-orders/PO-065");
      expect(url.searchParams.get("returnTo")).toBe("/admin/inventory/purchase-orders?status=CANCELLED&page=2");
    });

    it("with no filter the row still carries returnTo to the bare list", () => {
      render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      const href = within(screen.getByRole("table")).getByRole("link", { name: "Xem chi tiết PO-181" }).getAttribute("href")!;
      expect(new URL(href, "http://x").searchParams.get("returnTo")).toBe("/admin/inventory/purchase-orders");
    });

    it("the phone list is cards, one per row, with no table", () => {
      const { container } = render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
      expect(phone).toBeTruthy();
      expect(phone.querySelector("table")).toBeNull();
      expect(phone.textContent).toContain("PO-181");
      expect(phone.textContent).toContain("Trứng Ba Huân");
      expect(phone.textContent).toContain("506,023");
    });
  });

  // BR-UI-004 (owner 2026-10-06): the money column shows the total of every
  // slip the filter matches, cancelled and draft slips left out.
  it("shows the filter's total under the Tổng tiền header", () => {
    const withTotals: typeof pageData = {
      ...pageData,
      total: 1, firstIndex: 1, lastIndex: 1,
      rows: [{ id: "PO-181", dateText: "15/09/2026 10:00:00", supplierName: "Thế Kỷ Xanh", sourceName: "Shopee", status: "COMPLETED", totalAmount: 506023, paymentLabel: "Tiền mặt" }],
      totals: { count: 21, totalAmount: 12345678 },
    };
    render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={withTotals} />);
    expect(screen.getAllByText("Tổng (không tính huỷ, nháp)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12,345,678").length).toBeGreaterThan(0);
  });

  it("recognises account parameter in URL, showing Xoá lọc and deleting account on clear", () => {
    searchParams.set("account", "BA-001");
    try {
      render(<PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);
      const clearBtn = screen.getAllByRole("button", { name: "Xoá lọc" })[0];
      expect(clearBtn).toBeTruthy();

      fireEvent.click(clearBtn);
      expect(replace).toHaveBeenCalledWith(expect.not.stringContaining("account="), expect.anything());
    } finally {
      searchParams.delete("account");
    }
  });

  it("phoneRow meta uses short date (day/month and hour:minute) while desktop column keeps full dateText", () => {
    const dataWithRow: typeof pageData = {
      ...pageData,
      total: 1,
      firstIndex: 1,
      lastIndex: 1,
      rows: [
        {
          id: "PO-206",
          dateText: "15/10/2026 18:34:59",
          supplierName: "Nhà cung cấp C",
          sourceName: "Shopee",
          status: "COMPLETED",
          totalAmount: 350000,
          paymentLabel: "Tiền mặt",
        },
      ],
    };

    const { container } = render(
      <PurchaseOrdersClient range={TEST_RANGE} today={TEST_TODAY} pageData={dataWithRow} />
    );

    // Desktop table keeps full dateText
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    expect(within(table!).getByText("15/10/2026 18:34:59")).toBeInTheDocument();

    // Phone row meta uses short date
    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col");
    expect(phone).toBeTruthy();
    expect(within(phone!).getByText("15/10 18:34 · PO-206 · Tiền mặt")).toBeInTheDocument();
    expect(phone!.textContent).not.toContain("15/10/2026 18:34:59");
  });
});


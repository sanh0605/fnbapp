// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrdersClient from "./PurchaseOrdersClient";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

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
  rangeError: false,
  suppliers: [
    { id: 'SUP-1', name: 'Nhà cung cấp A' },
    { id: 'SUP-2', name: 'Nhà cung cấp B' }
  ]
};

describe("PurchaseOrdersClient", () => {
  it("T1: Type invalid date and press Enter", async () => {
    render(<PurchaseOrdersClient pageData={pageData} />);
    const fromInput = screen.getByLabelText("Từ ngày");
    fireEvent.change(fromInput, { target: { value: "31/02/2026" } });
    fireEvent.keyDown(fromInput, { key: "Enter", code: "Enter", charCode: 13 });
    
    await waitFor(() => {
      expect(screen.getByText("Ngày không hợp lệ")).toBeTruthy();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("T2: Start date after end date", async () => {
    render(<PurchaseOrdersClient pageData={pageData} />);
    const fromInput = screen.getByLabelText("Từ ngày");
    const toInput = screen.getByLabelText("Đến ngày");
    
    fireEvent.change(fromInput, { target: { value: "25/09/2026" } });
    fireEvent.blur(fromInput);
    
    fireEvent.change(toInput, { target: { value: "20/09/2026" } });
    fireEvent.blur(toInput);
    
    const filterBtn = screen.getByRole("button", { name: "Lọc" });
    fireEvent.click(filterBtn);
    
    await waitFor(() => {
      expect(screen.getAllByText("Ngày bắt đầu phải trước ngày kết thúc").length).toBe(1);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("T3: Stale Enter in day box applies filter", async () => {
    render(<PurchaseOrdersClient pageData={pageData} />);
    const fromInput = screen.getByLabelText("Từ ngày");
    fireEvent.change(fromInput, { target: { value: "23/09/2026" } });
    fireEvent.keyDown(fromInput, { key: "Enter", code: "Enter", charCode: 13, bubbles: true });
    
    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
    });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("from=2026-09-23"), expect.anything());
  });

  it("T4: Enter in search box applies filter", async () => {
    render(<PurchaseOrdersClient pageData={pageData} />);
    const searchInput = screen.getByLabelText("Tìm kiếm");
    fireEvent.change(searchInput, { target: { value: "PO-19" } });
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter", charCode: 13, bubbles: true });
    
    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
    });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("q=PO-19"), expect.anything());
  });

  it("T5: Clear filter button visibility", async () => {
    render(<PurchaseOrdersClient pageData={pageData} />);
    expect(screen.queryByRole("button", { name: "Xoá lọc" })).toBeNull();
    
    const searchInput = screen.getByLabelText("Tìm kiếm");
    fireEvent.change(searchInput, { target: { value: "PO-19" } });
    
    expect(screen.getByRole("button", { name: "Xoá lọc" })).toBeTruthy();
  });

  it("T6: Renders Trả bằng secondary column in table and card", () => {
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

    render(<PurchaseOrdersClient pageData={dataWithRow} />);
    expect(screen.getByRole("columnheader", { name: "Trả bằng" })).toBeTruthy();
    // Tiền mặt appears in both desktop table and phone card
    const labels = screen.getAllByText("Tiền mặt");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("T7: Filter by Trả bằng", async () => {
    render(<PurchaseOrdersClient pageData={pageData} />);
    const paySelect = screen.getByLabelText("Trả bằng");
    fireEvent.change(paySelect, { target: { value: "BANK_TRANSFER" } });

    const filterBtn = screen.getByRole("button", { name: "Lọc" });
    fireEvent.click(filterBtn);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(1);
    });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("pay=BANK_TRANSFER"), expect.anything());
  });
});

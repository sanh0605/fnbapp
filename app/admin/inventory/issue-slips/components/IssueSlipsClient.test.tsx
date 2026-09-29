// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import IssueSlipsClient from "./IssueSlipsClient";
import type { IssueSlipListPage } from "@/lib/stock/issue-slip-list";

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
  usePathname: () => "/admin/inventory/issue-slips",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>
}));

const defaultPageData: IssueSlipListPage = {
  rows: [],
  total: 0,
  page: 1,
  pageCount: 1,
  firstIndex: 0,
  lastIndex: 0,
  rangeError: false,
  people: ["admin", "tuyen2612"],
};

describe("IssueSlipsClient", () => {
  it("hiện đúng nhãn ba loại và bấm dòng STK đi /admin/inventory/stocktake", () => {
    const pageData: IssueSlipListPage = {
      ...defaultPageData,
      rows: [
        { id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", reason: "Hư hỏng", dateText: "29/09", createdByName: "admin", value: 100 },
        { id: "STK-01", href: "/admin/inventory/stocktake", kind: "STOCKTAKE", reason: "", dateText: "28/09", createdByName: "admin", value: 50 },
        { id: "ISL-02", href: "/admin/inventory/issue-slips/ISL-02", kind: "CANCELLED", reason: "Sai sót", dateText: "27/09", createdByName: "admin", value: 0 },
      ],
      total: 3,
      lastIndex: 3,
      firstIndex: 1,
    };
    render(<IssueSlipsClient pageData={pageData} />);

    const table = screen.getByRole("table");
    const tableScope = within(table);

    // Should render badges for desktop table (1x each)
    expect(tableScope.getAllByText("Phiếu xuất · Hư hỏng")).toHaveLength(1);
    expect(tableScope.getAllByText("Kiểm kê")).toHaveLength(1);
    expect(tableScope.getAllByText("Đã huỷ")).toHaveLength(1);

    // Desktop uses sr-only text "Xem chi tiết STK-01" for the link covering the row
    const deskLink = tableScope.getByRole("link", { name: "Xem chi tiết STK-01" });
    expect(deskLink.getAttribute("href")).toBe("/admin/inventory/stocktake");
  });

  it("Loại có đúng bốn lựa chọn", () => {
    render(<IssueSlipsClient pageData={defaultPageData} />);
    const typeSelect = screen.getByLabelText("Loại");
    const options = Array.from(typeSelect.querySelectorAll("option"));
    
    expect(options).toHaveLength(4);
    expect(options.map(o => o.textContent)).toEqual(["Tất cả", "Phiếu xuất", "Kiểm kê", "Đã huỷ"]);
    expect(options.map(o => o.getAttribute("value"))).toEqual(["ALL", "SLIP", "STOCKTAKE", "CANCELLED"]);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import IssueSlipsClient from "./IssueSlipsClient";
import type { IssueSlipListPage } from "@/lib/stock/issue-slip-list";

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
  totals: { count: 0, value: 0 },
};

describe("IssueSlipsClient", () => {
  it("hiện đúng nhãn hai loại, không còn nhãn Kiểm kê", () => {
    const pageData: IssueSlipListPage = {
      ...defaultPageData,
      rows: [
        { id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", reason: "Hư hỏng", dateText: "29/09", createdByName: "admin", value: 100 },
        { id: "ISL-02", href: "/admin/inventory/issue-slips/ISL-02", kind: "CANCELLED", reason: "Sai sót", dateText: "27/09", createdByName: "admin", value: 0 },
      ],
      total: 2,
      lastIndex: 2,
      firstIndex: 1,
    };
    render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);

    const table = screen.getByRole("table");
    const tableScope = within(table);

    // Should render badges for desktop table (1x each)
    expect(tableScope.getAllByText("Phiếu xuất")).toHaveLength(1);
    expect(tableScope.queryByText("Kiểm kê")).toBeNull();
    expect(tableScope.getAllByText("Đã huỷ")).toHaveLength(1);
  });

  it("Loại có đúng ba lựa chọn", () => {
    render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={defaultPageData} />);
    const typeSelect = screen.getByLabelText("Loại");
    const options = Array.from(typeSelect.querySelectorAll("option"));
    
    expect(options).toHaveLength(3);
    expect(options.map(o => o.textContent)).toEqual(["Tất cả", "Phiếu xuất", "Đã huỷ"]);
    expect(options.map(o => o.getAttribute("value"))).toEqual(["ALL", "SLIP", "CANCELLED"]);
  });

  // BR-UI-003 / BR-UI-005 and Review Focus 4 (wave K3).
  describe("shared list (wave K3)", () => {
    const rows: IssueSlipListPage = {
      ...defaultPageData,
      rows: [
        { id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", reason: "Hư hỏng", dateText: "29/09", createdByName: "admin", value: 100 },
        { id: "ISL-03", href: "/admin/inventory/issue-slips/ISL-03", kind: "SLIP", reason: "Hết hạn", dateText: "28/09", createdByName: "admin", value: 50 },
      ],
      total: 2,
      firstIndex: 1,
      lastIndex: 2,
    };

    afterEach(() => {
      for (const k of Array.from(searchParams.keys())) searchParams.delete(k);
    });

    it("header cells are plain text, not capitals", () => {
      render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      for (const th of within(screen.getByRole("table")).getAllByRole("columnheader")) {
        // The capitals can come from the cell or from its header row.
        expect(th.closest(".uppercase")).toBeNull();
      }
    });

    it("a slip row opens with returnTo carrying the active filter", () => {
      searchParams.set("kind", "SLIP");
      searchParams.set("page", "2");
      render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      const table = within(screen.getByRole("table"));
      const slip = table.getByRole("link", { name: "Xem chi tiết ISL-01" }).getAttribute("href")!;
      const url = new URL(slip, "http://x");
      expect(url.pathname).toBe("/admin/inventory/issue-slips/ISL-01");
      expect(url.searchParams.get("returnTo")).toBe("/admin/inventory/issue-slips?kind=SLIP&page=2");
    });

    it("the phone list renders rows with date title, value, code · creator meta, and kind badge", () => {
      const { container } = render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={rows} />);
      const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
      expect(phone).toBeTruthy();
      expect(phone.querySelector("table")).toBeNull();
      expect(within(phone).getByText("29/09")).toBeInTheDocument();
      expect(within(phone).getByText("100đ")).toBeInTheDocument();
      expect(within(phone).getByText("ISL-01 · admin")).toBeInTheDocument();
      expect(within(phone).getByText("ISL-03 · admin")).toBeInTheDocument();
      expect(within(phone).getAllByText("Phiếu xuất")).toHaveLength(2);
    });
  });

  it("create link reads 'Tạo' and points to /admin/inventory/issue-slips/new", () => {
    render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={defaultPageData} />);
    const link = screen.getByRole("link", { name: "Tạo" });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/admin/inventory/issue-slips/new");
  });

  // BR-UI-004: total of every slip the filter matches, cancelled slips left out.
  it("shows the filter's total under the value header", () => {
    const withTotals: IssueSlipListPage = {
      ...defaultPageData,
      rows: [{ id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", reason: "Hư hỏng", dateText: "29/09", createdByName: "admin", value: 100 }],
      total: 1, firstIndex: 1, lastIndex: 1,
      totals: { count: 21, value: 2108 },
    };
    render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={withTotals} />);
    expect(screen.getAllByText("Tổng (không tính huỷ)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2,108").length).toBeGreaterThan(0);
  });
});

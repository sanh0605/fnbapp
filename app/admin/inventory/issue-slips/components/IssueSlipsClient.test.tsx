// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
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
  personLabel: null,
  totals: { count: 0, value: 0 },
};

describe("IssueSlipsClient", () => {
  it("hiện đúng nhãn hai loại, không còn nhãn Kiểm kê", () => {
    const pageData: IssueSlipListPage = {
      ...defaultPageData,
      rows: [
        { id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", dateText: "29/09", createdByName: "admin", value: 100 },
        { id: "ISL-02", href: "/admin/inventory/issue-slips/ISL-02", kind: "CANCELLED", dateText: "27/09", createdByName: "admin", value: 0 },
      ],
      total: 2,
      lastIndex: 2,
      firstIndex: 1,
    };
    render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={pageData} />);

    const table = screen.getByRole("table");
    const tableScope = within(table);

    // Normal slips do not show badge; only cancelled slips do
    expect(tableScope.queryByText("Phiếu xuất")).toBeNull();
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

  it("an old ?person=<login> link preselects that person's label, and a new pick still wins", () => {
    searchParams.set("person", "tuyen2612");
    try {
      render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={{ ...defaultPageData, people: ["admin", "Tài Chí Tuyền"], personLabel: "Tài Chí Tuyền" }} />);
      const select = screen.getByLabelText("Người ghi") as HTMLSelectElement;
      expect(select.value).toBe("Tài Chí Tuyền");
      fireEvent.change(select, { target: { value: "admin" } });
      expect(select.value).toBe("admin");
    } finally {
      searchParams.delete("person");
    }
  });

  it("with ?person=Ghost in the URL, personLabel: null, and people not containing Ghost, the select's value is Ghost and an option named Ghost exists", () => {
    searchParams.set("person", "Ghost");
    try {
      render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={{ ...defaultPageData, people: ["admin", "tuyen2612"], personLabel: null }} />);
      const select = screen.getByLabelText("Người ghi") as HTMLSelectElement;
      expect(select.value).toBe("Ghost");
      expect(screen.getByRole("option", { name: "Ghost" })).toBeInTheDocument();
    } finally {
      searchParams.delete("person");
    }
  });

  it("with an empty ?person= in the URL the select shows Tất cả, not a blank choice, and Xoá lọc stays hidden", () => {
    searchParams.set("person", "");
    try {
      // One row, so the empty state's own "Xoá lọc" button does not render and only the filter card's could.
      const oneRow: IssueSlipListPage = {
        ...defaultPageData,
        rows: [{ id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", dateText: "29/09", createdByName: "admin", value: 100 }],
        total: 1, firstIndex: 1, lastIndex: 1,
      };
      render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={oneRow} />);
      expect((screen.getByLabelText("Người ghi") as HTMLSelectElement).value).toBe("ALL");
      expect(screen.queryByRole("button", { name: "Xoá lọc" })).toBeNull();
    } finally {
      searchParams.delete("person");
    }
  });

  // BR-UI-003 / BR-UI-005 and Review Focus 4 (wave K3).
  describe("shared list (wave K3)", () => {
    const rows: IssueSlipListPage = {
      ...defaultPageData,
      rows: [
        { id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", dateText: "29/09", createdByName: "admin", value: 100 },
        { id: "ISL-03", href: "/admin/inventory/issue-slips/ISL-03", kind: "SLIP", dateText: "28/09", createdByName: "admin", value: 50 },
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

    it("has no Loại column: the kind badge sits after the code", () => {
      const withCancelled: IssueSlipListPage = {
        ...rows,
        rows: [...rows.rows, { id: "ISL-02", href: "/admin/inventory/issue-slips/ISL-02", kind: "CANCELLED", dateText: "27/09", createdByName: "admin", value: 0 }],
      };
      render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={withCancelled} />);
      expect(screen.queryByRole("columnheader", { name: "Loại" })).toBeNull();
      const codeCell = within(screen.getByRole("table")).getByText("ISL-02").closest("td")!;
      expect(within(codeCell).getByText("Đã huỷ")).toBeInTheDocument();
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
      expect(within(phone).getAllByText("ISL-01").some((el) => el.parentElement?.textContent === "ISL-01 · admin")).toBe(true);
      expect(within(phone).getAllByText("ISL-03").some((el) => el.parentElement?.textContent === "ISL-03 · admin")).toBe(true);
      expect(within(phone).queryByText("Phiếu xuất")).toBeNull();
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
      rows: [{ id: "ISL-01", href: "/admin/inventory/issue-slips/ISL-01", kind: "SLIP", dateText: "29/09", createdByName: "admin", value: 100 }],
      total: 1, firstIndex: 1, lastIndex: 1,
      totals: { count: 21, value: 2108 },
    };
    render(<IssueSlipsClient range={TEST_RANGE} today={TEST_TODAY} pageData={withTotals} />);
    expect(screen.getAllByText("Tổng (không tính huỷ)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2,108đ").length).toBeGreaterThan(0);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import React from "react";
import ProductTypesClient from "./ProductTypesClient";
import type { ProductTypeRow } from "../actions";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/products/types",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleRows: ProductTypeRow[] = [
  {
    type: { id: "PT-001", name: "Thức uống", is_drink: true, created_at: "2026-10-14T09:00:00Z" },
    categoryCount: 2,
    categoryNames: ["Cà phê", "Trà"],
  },
  {
    type: { id: "PT-002", name: "Thức ăn", is_drink: false, created_at: "2026-10-14T09:00:00Z" },
    categoryCount: 1,
    categoryNames: ["Bánh"],
  },
  {
    type: { id: "PT-003", name: "Topping", is_drink: false, created_at: "2026-10-14T09:00:00Z" },
    categoryCount: 0,
    categoryNames: [],
  },
];

describe("ProductTypesClient", () => {
  it("renders columns Mã, Tên loại, Tính là ly, Nhóm món đang dùng", () => {
    render(<ProductTypesClient rows={sampleRows} />);

    expect(screen.getByText("Mã")).toBeInTheDocument();
    expect(screen.getByText("Tên loại")).toBeInTheDocument();
    expect(screen.getByText("Tính là ly")).toBeInTheDocument();
    expect(screen.getByText("Nhóm món đang dùng")).toBeInTheDocument();
  });

  it("renders rows with Có / Không for Tính là ly and category names joined by ', ' or 'Chưa có nhóm nào'", () => {
    const { container } = render(<ProductTypesClient rows={sampleRows} />);

    expect(screen.getAllByText("Thức uống").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thức ăn").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Topping").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Có").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Không").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Cà phê, Trà").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bánh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chưa có nhóm nào").length).toBeGreaterThan(0);

    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    expect(within(phone).getAllByText("PT-001").some((el) => el.parentElement?.textContent === "PT-001 · Tính là ly: Có · Cà phê, Trà")).toBe(true);
    expect(within(phone).getAllByText("PT-002").some((el) => el.parentElement?.textContent === "PT-002 · Tính là ly: Không · Bánh")).toBe(true);
    expect(within(phone).getAllByText("PT-003").some((el) => el.parentElement?.textContent === "PT-003 · Tính là ly: Không · Chưa có nhóm nào")).toBe(true);
    expect(within(phone).queryByText(/Nhóm món đang dùng:/)).toBeNull();
  });

  it("rows have links opening the detail page", () => {
    render(<ProductTypesClient rows={sampleRows} />);

    const allLinks = screen.getAllByRole("link");
    const pt1Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/products/types/PT-001?returnTo=")
    );
    expect(pt1Links.length).toBeGreaterThan(0);
  });

  it("create button links to /admin/products/types/new", () => {
    render(<ProductTypesClient rows={sampleRows} />);

    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/products/types/new?returnTo=");
  });

  it("filters rows by search keyword", () => {
    render(<ProductTypesClient rows={sampleRows} />);

    const searchInput = screen.getByPlaceholderText("Ví dụ: Thức uống");
    fireEvent.change(searchInput, { target: { value: "Topping" } });

    expect(screen.getAllByText("Topping").length).toBeGreaterThan(0);
    expect(screen.queryByText("Thức uống")).toBeNull();
  });

  it("renders plain text without font-bold in row data cells", () => {
    const { container } = render(<ProductTypesClient rows={sampleRows} />);
    const tableBody = container.querySelector("tbody");
    expect(tableBody).toBeInTheDocument();
    const boldInsideTbody = tableBody?.querySelectorAll(".font-bold, .font-semibold");
    expect(boldInsideTbody?.length ?? 0).toBe(0);
  });

  it("renders in default order newest code first (code descending)", () => {
    render(<ProductTypesClient rows={sampleRows} />);

    const codeElements = screen.getAllByText(/^PT-00[123]$/);
    expect(codeElements[0].textContent).toBe("PT-003");
    expect(codeElements[1].textContent).toBe("PT-002");
    expect(codeElements[2].textContent).toBe("PT-001");
  });
});

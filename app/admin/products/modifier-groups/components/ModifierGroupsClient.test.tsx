// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import ModifierGroupsClient, { type ModifierGroupRow } from "./ModifierGroupsClient";

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
  usePathname: () => "/admin/products/modifier-groups",
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

const sampleRows: ModifierGroupRow[] = [
  {
    group: {
      id: "MG-001",
      name: "Thêm Topping",
      selection_mode: "MANY",
      max_total: 3,
      allow_standalone: true,
      sort_order: 50,
      status: "ACTIVE",
    },
    optionNames: ["Trân châu trắng", "Kem muối"],
    productCount: 20,
  },
  {
    group: {
      id: "MG-002",
      name: "Mức đường",
      selection_mode: "ONE",
      max_total: null,
      allow_standalone: false,
      sort_order: 10,
      status: "ACTIVE",
    },
    optionNames: ["Ít đường", "Bình thường", "Nhiều đường"],
    productCount: 15,
  },
  {
    group: {
      id: "MG-003",
      name: "Loại sữa",
      selection_mode: "ONE",
      max_total: null,
      allow_standalone: false,
      sort_order: 30,
      status: "INACTIVE",
    },
    optionNames: ["Sữa tươi", "Sữa yến mạch"],
    productCount: 5,
  },
];

describe("ModifierGroupsClient", () => {
  it("renders columns Thứ tự hiện, Tên nhóm, Kiểu chọn, Tối đa, Bán riêng, Tuỳ chọn, Số món, Trạng thái", () => {
    render(<ModifierGroupsClient rows={sampleRows} />);

    expect(screen.getByText("Thứ tự hiện")).toBeInTheDocument();
    expect(screen.getByText("Tên nhóm")).toBeInTheDocument();
    expect(screen.getByText("Kiểu chọn")).toBeInTheDocument();
    expect(screen.getByText("Tối đa")).toBeInTheDocument();
    expect(screen.getByText("Bán riêng")).toBeInTheDocument();
    expect(screen.getByText("Tuỳ chọn")).toBeInTheDocument();
    expect(screen.getByText("Số món")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái")).toBeInTheDocument();
  });

  it("the list sorts by Thứ tự hiện", () => {
    const { container } = render(<ModifierGroupsClient rows={sampleRows} />);

    // In desktop table tbody, rows should be sorted by sort_order ascending:
    // 10 ("Mức đường"), then 30 ("Loại sữa"), then 50 ("Thêm Topping")
    const tbody = container.querySelector("tbody");
    expect(tbody).toBeInTheDocument();
    const rows = tbody?.querySelectorAll("tr");
    expect(rows?.length).toBe(3);

    expect(rows?.[0].textContent).toContain("Mức đường");
    expect(rows?.[0].textContent).toContain("10");

    expect(rows?.[1].textContent).toContain("Loại sữa");
    expect(rows?.[1].textContent).toContain("30");

    expect(rows?.[2].textContent).toContain("Thêm Topping");
    expect(rows?.[2].textContent).toContain("50");
  });

  it("renders row details: selection mode, caps, standalone, options, product count, status", () => {
    render(<ModifierGroupsClient rows={sampleRows} />);

    expect(screen.getAllByText("Chọn nhiều").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chọn một").length).toBeGreaterThan(0);

    expect(screen.getAllByText("3 phần").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Có").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Trân châu trắng, Kem muối").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20 món").length).toBeGreaterThan(0);
  });

  it("rows have links opening the detail page", () => {
    render(<ModifierGroupsClient rows={sampleRows} />);

    const allLinks = screen.getAllByRole("link");
    const mgLinks = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/products/modifier-groups/MG-001?returnTo=")
    );
    expect(mgLinks.length).toBeGreaterThan(0);
  });

  it("create button links to /admin/products/modifier-groups/new", () => {
    render(<ModifierGroupsClient rows={sampleRows} />);

    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/products/modifier-groups/new?returnTo=");
  });

  it("filters rows by search keyword", () => {
    render(<ModifierGroupsClient rows={sampleRows} />);

    const searchInput = screen.getByPlaceholderText("Ví dụ: Mức đường");
    fireEvent.change(searchInput, { target: { value: "Topping" } });

    expect(screen.getAllByText("Thêm Topping").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mức đường")).toBeNull();
  });

  it("renders plain text without font-bold in row data cells", () => {
    const { container } = render(<ModifierGroupsClient rows={sampleRows} />);
    const tableBody = container.querySelector("tbody");
    expect(tableBody).toBeInTheDocument();
    const boldInsideTbody = tableBody?.querySelectorAll(".font-bold, .font-semibold");
    expect(boldInsideTbody?.length ?? 0).toBe(0);
  });
});

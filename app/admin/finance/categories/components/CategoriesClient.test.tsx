// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import CategoriesClient, { pnlTreatmentLabel } from "./CategoriesClient";
import type { DBCashCategory } from "@/types/db";

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
  usePathname: () => "/admin/finance/categories",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/finance/categories/actions", () => ({
  setCashCategoryStatus: vi.fn(),
  deleteCashCategory: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleCategories = [
  {
    id: "CFC-001",
    name: "Vận hành",
    kind: "EXPENSE",
    affects_pnl: true,
    is_sales_revenue: false,
    status: "ACTIVE",
  },
  {
    id: "CFC-005",
    name: "Vốn góp",
    kind: "INCOME",
    affects_pnl: false,
    is_sales_revenue: false,
    status: "ACTIVE",
  },
  {
    id: "CFC-006",
    name: "Doanh thu ghi tay",
    kind: "INCOME",
    affects_pnl: true,
    is_sales_revenue: true,
    status: "INACTIVE",
  },
] as unknown as DBCashCategory[];

describe("pnlTreatmentLabel", () => {
  it("returns 'Không' when affects_pnl is false", () => {
    expect(pnlTreatmentLabel({ affects_pnl: false, is_sales_revenue: false })).toBe("Không");
  });

  it("returns 'Có' when affects_pnl is true and is_sales_revenue is not true", () => {
    expect(pnlTreatmentLabel({ affects_pnl: true, is_sales_revenue: false })).toBe("Có");
  });

  it("returns 'Có — doanh thu bán hàng' when affects_pnl is true and is_sales_revenue is true", () => {
    expect(pnlTreatmentLabel({ affects_pnl: true, is_sales_revenue: true })).toBe("Có — doanh thu bán hàng");
  });
});

describe("CategoriesClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(<CategoriesClient categories={sampleCategories} />);

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link starting with /admin/finance/categories/CFC-001?returnTo=", () => {
    render(<CategoriesClient categories={sampleCategories} />);

    const allLinks = screen.getAllByRole("link");
    const cfcLinks = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/finance/categories/CFC-001?returnTo="),
    );
    expect(cfcLinks.length).toBeGreaterThan(0);
  });

  it("renders bin labelled 'Ngừng dùng' when status is ACTIVE and hides it when status=INACTIVE", () => {
    const { unmount } = render(<CategoriesClient categories={sampleCategories} />);

    const binButtons = screen.getAllByRole("button", { name: /^Ngừng dùng/i });
    expect(binButtons.length).toBeGreaterThan(0);
    unmount();

    mockSearchParams = new URLSearchParams("status=INACTIVE");
    render(<CategoriesClient categories={sampleCategories} initialStatus="INACTIVE" />);

    expect(screen.queryByRole("button", { name: /^Ngừng dùng/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("'Tất cả' shows both active and inactive categories", () => {
    mockSearchParams = new URLSearchParams("status=ALL");
    render(<CategoriesClient categories={sampleCategories} initialStatus="ALL" />);

    expect(screen.getAllByText("Vận hành").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Doanh thu ghi tay").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first (CFC-006 before CFC-001)", () => {
    mockSearchParams = new URLSearchParams("status=ALL");
    render(<CategoriesClient categories={sampleCategories} initialStatus="ALL" />);

    const codes = screen.getAllByText(/^CFC-00[156]$/).map((el) => el.textContent);
    const idx006 = codes.indexOf("CFC-006");
    const idx001 = codes.indexOf("CFC-001");
    expect(idx006).toBeGreaterThan(-1);
    expect(idx001).toBeGreaterThan(-1);
    expect(idx006).toBeLessThan(idx001);
  });

  it("create link reads 'Tạo' and points to /admin/finance/categories/new", () => {
    render(<CategoriesClient categories={sampleCategories} />);
    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/finance/categories/new?returnTo=");
  });
});

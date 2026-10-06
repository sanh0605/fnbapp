// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import CategoriesClient from "./CategoriesClient";
import type { DBProductCategory } from "@/types/db";

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
  usePathname: () => "/admin/products/categories",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({
  deleteCategory: vi.fn(),
}));

vi.mock("@/app/admin/products/categories/actions", () => ({
  deleteCategory: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleCategories: DBProductCategory[] = [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE" },
  { id: "CAT-002", name: "Trà sữa", status: "ACTIVE" },
];

const sampleCounts: Record<string, number> = {
  "CAT-001": 8,
  "CAT-002": 3,
};

describe("CategoriesClient", () => {
  it("has no 'Sửa' or '/edit' link", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("row link for CAT-001 starts with /admin/products/categories/CAT-001?returnTo=", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    const allLinks = screen.getAllByRole("link");
    const cat1Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/products/categories/CAT-001?returnTo="),
    );
    expect(cat1Links.length).toBeGreaterThan(0);
  });

  it("bin 'Xoá' is present", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    const binButtons = screen.getAllByRole("button", { name: /Xoá/i });
    expect(binButtons.length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    const codeElements = screen.getAllByText(/^CAT-00[12]$/);
    expect(codeElements[0].textContent).toBe("CAT-002");
    expect(codeElements[1].textContent).toBe("CAT-001");
  });

  it("shows '8 món'", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    expect(screen.getAllByText("8 món").length).toBeGreaterThan(0);
  });

  it("search by code finds it", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/Tên hoặc mã nhóm/i);
    fireEvent.change(searchInput, { target: { value: "CAT-001" } });

    expect(screen.getAllByText("Cà phê").length).toBeGreaterThan(0);
    expect(screen.queryByText("Trà sữa")).toBeNull();
  });

  it("create link reads 'Tạo' and points to /admin/products/categories/new", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={sampleCounts}
      />,
    );

    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/products/categories/new?returnTo=");
  });
});

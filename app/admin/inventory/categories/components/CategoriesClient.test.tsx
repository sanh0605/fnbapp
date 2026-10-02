// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CategoriesClient from "./CategoriesClient";
import type { DBItemCategory } from "@/types/db";

const { replace, refresh, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/categories",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/inventory/actions", () => ({
  deleteItemCategory: vi.fn(),
}));

const CATEGORIES: DBItemCategory[] = [
  { id: "NHH-001", name: "Nguyên liệu", system_type: "RAW", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "NHH-002", name: "Vật tư tiêu hao", system_type: "CONSUMABLE", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "NHH-003", name: "Dụng cụ", system_type: "EQUIPMENT", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  push.mockClear();
});

describe("CategoriesClient", () => {
  it("renders row linking to detail page instead of removed Sửa button", () => {
    render(
      <CategoriesClient
        categories={CATEGORIES}
        canDelete={false}
      />,
    );

    // Sửa button must NOT exist
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();

    // Row links to detail page
    const links = screen.getAllByRole("link", { name: /Nguyên liệu/ });
    expect(links.length).toBeGreaterThan(0);
    expect(
      links.some((l) =>
        l.getAttribute("href")?.startsWith("/admin/inventory/categories/NHH-001?returnTo=")
      )
    ).toBe(true);
  });

  it("links '+ Phân loại Hàng Hoá' to new page with returnTo", () => {
    render(
      <CategoriesClient
        categories={CATEGORIES}
        canDelete={false}
      />,
    );

    const addLink = screen.getByRole("link", { name: "+ Phân loại Hàng Hoá" });
    expect(addLink.getAttribute("href")).toContain("/admin/inventory/categories/new?returnTo=");
  });

  it("renders system_type labels correctly", () => {
    render(
      <CategoriesClient
        categories={CATEGORIES}
        canDelete={false}
      />,
    );

    expect(screen.getAllByText(/Nguyên Liệu|Nguyên liệu/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vật Tư|Vật tư/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dụng Cụ|Dụng cụ/).length).toBeGreaterThan(0);
  });

  it("canDelete=false renders no checkboxes and no removal bin", () => {
    render(
      <CategoriesClient
        categories={CATEGORIES}
        canDelete={false}
      />,
    );

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("canDelete=true renders removal bin and checkboxes", () => {
    render(
      <CategoriesClient
        categories={CATEGORIES}
        canDelete={true}
      />,
    );

    expect(screen.queryAllByRole("checkbox").length).toBeGreaterThan(0);
    const bins = screen.getAllByRole("button", { name: /Xoá/ });
    expect(bins.length).toBeGreaterThan(0);
  });
});

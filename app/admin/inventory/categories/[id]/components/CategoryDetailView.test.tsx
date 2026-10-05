// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CategoryDetailView } from "./CategoryDetailView";
import type { DBItemCategory } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

const category: DBItemCategory = {
  id: "NHH-001",
  name: "Nguyên liệu",
  system_type: "RAW",
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("CategoryDetailView", () => {
  it("renders category details, itemCount, and links", () => {
    const returnTo = "/admin/inventory/categories";
    render(
      <CategoryDetailView
        category={category}
        itemCount={56}
        returnTo={returnTo}
        canDelete={false}
      />,
    );

    // Header back link
    const backLink = screen.getByRole("link", { name: /Phân loại hàng/ });
    expect(backLink).toHaveAttribute("href", returnTo);

    // "Chỉnh sửa" link
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      `/admin/inventory/categories/NHH-001/edit?returnTo=${encodeURIComponent(returnTo)}`,
    );

    // canDelete=false hides "Xoá"
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();

    // Fields: Mã, Tên, Đặc tính, Số hàng hoá
    expect(screen.getAllByText("NHH-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nguyên liệu").length).toBeGreaterThan(0);
    expect(screen.getByText("56")).toBeInTheDocument();

    // Action link "Xem hàng hoá" to /admin/inventory/items?category=NHH-001
    const viewItemsLink = screen.getByRole("link", { name: "Xem hàng hoá" });
    expect(viewItemsLink).toHaveAttribute("href", "/admin/inventory/items?category=NHH-001");
  });

  it("renders delete button when canDelete is true", () => {
    render(
      <CategoryDetailView
        category={category}
        itemCount={0}
        returnTo="/admin/inventory/categories"
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Xoá/ })).toBeInTheDocument();
  });
});

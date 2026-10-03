// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ProductCategoryDetailView } from "./ProductCategoryDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/products/categories/CAT-001",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/products/categories/actions", () => ({
  deleteCategory: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleCategory = {
  id: "CAT-001",
  name: "Cà phê",
  status: "ACTIVE",
};

const sampleDishes = [
  { id: "PROD-001", name: "Cà phê đá", status: "ACTIVE" },
  { id: "PROD-009", name: "Bạc xỉu", status: "INACTIVE" },
];

describe("ProductCategoryDetailView", () => {
  it("renders Cà phê CAT-001 with dishes, status label, edit link and delete button", () => {
    const returnTo = "/admin/products/categories";
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={sampleDishes.length}
        dishes={sampleDishes}
        returnTo={returnTo}
      />,
    );

    // "Món trong nhóm (2)"
    expect(screen.getByText("Món trong nhóm (2)")).toBeInTheDocument();

    // dish link /admin/products/PROD-001
    const links = screen.getAllByRole("link");
    const prod1Link = links.find(
      (l) => l.getAttribute("href") === "/admin/products/PROD-001",
    );
    expect(prod1Link).toBeDefined();

    // "Ngừng bán" label for PROD-009
    expect(screen.getAllByText("Ngừng bán").length).toBeGreaterThan(0);

    // "Chỉnh sửa" link to /admin/products/categories/CAT-001/edit?returnTo=
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink.getAttribute("href")).toContain(
      "/admin/products/categories/CAT-001/edit?returnTo=",
    );

    // "Xoá" button
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });

  it("renders empty state message when group has no dishes", () => {
    render(
      <ProductCategoryDetailView
        category={sampleCategory}
        dishCount={0}
        dishes={[]}
        returnTo="/admin/products/categories"
      />,
    );

    expect(screen.getByText("Chưa có món nào trong nhóm này.")).toBeInTheDocument();
  });
});

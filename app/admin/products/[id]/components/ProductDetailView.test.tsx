// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import React from "react";
import { ProductDetailView } from "./ProductDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/products/PROD-005",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/products/actions", () => ({
  pauseProduct: vi.fn(),
  resumeProduct: vi.fn(),
  eraseProduct: vi.fn(),
}));

const matchaLatteProduct = {
  id: "PROD-005",
  name: "Matcha latte",
  category_id: "CAT-002",
  status: "ACTIVE",
  neverSold: false,
  hasNoSellableVariant: false,
  isLinkedTopping: false,
  variants: [
    { id: "VAR-005-1", size_name: "360ml", price: 20000, status: "ACTIVE" },
    { id: "VAR-005-2", size_name: "500ml", price: 23000, status: "ACTIVE" },
    { id: "VAR-005-3", size_name: "700ml", price: 27000, status: "ACTIVE" },
  ],
  priceHistory: [
    {
      id: "PPH-1",
      variant_id: "VAR-005-1",
      old_price: null,
      new_price: 0,
      effective_at: "2026-06-28T16:27:49.637Z",
      created_at: "2026-06-28T16:27:49.637Z",
    },
    {
      id: "PPH-2",
      variant_id: "VAR-005-2",
      old_price: null,
      new_price: 0,
      effective_at: "2026-06-28T16:27:49.637Z",
      created_at: "2026-06-28T16:27:49.637Z",
    },
    {
      id: "PPH-3",
      variant_id: "VAR-005-3",
      old_price: null,
      new_price: 0,
      effective_at: "2026-06-28T16:27:49.637Z",
      created_at: "2026-06-28T16:27:49.637Z",
    },
  ],
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("ProductDetailView", () => {
  it("renders Matcha latte PROD-005 detail view with sizes, price history, and actions", () => {
    const returnTo = "/admin/products?q=matcha";
    render(
      <ProductDetailView
        product={matchaLatteProduct}
        categoryName="Giải trí"
        returnTo={returnTo}
        canDelete={false}
      />,
    );

    // Shows "Size & giá (3)"
    expect(screen.getByText("Size & giá (3)")).toBeInTheDocument();

    // Shows "Lịch sử giá (3)"
    expect(screen.getByText("Lịch sử giá (3)")).toBeInTheDocument();

    // Each history row has its size name inside the price history section
    const historySection = document.getElementById("lich-su-gia");
    expect(historySection).toBeInTheDocument();
    expect(within(historySection!).getAllByText("360ml").length).toBeGreaterThan(0);
    expect(within(historySection!).getAllByText("500ml").length).toBeGreaterThan(0);
    expect(within(historySection!).getAllByText("700ml").length).toBeGreaterThan(0);

    // "Chỉnh sửa" link pointing to edit with returnTo
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink.getAttribute("href")).toContain(
      `/admin/products/PROD-005/edit?returnTo=`,
    );

    // "Ngừng bán" button present
    expect(screen.getByRole("button", { name: "Ngừng bán" })).toBeInTheDocument();

    // No "Xoá vĩnh viễn" (neverSold is false)
    expect(screen.queryByRole("button", { name: /Xoá vĩnh viễn/ })).toBeNull();

    // No text "Đang áp dụng"
    expect(screen.queryByText(/Đang áp dụng/)).toBeNull();
  });

  it("renders 'Xoá vĩnh viễn' button when neverSold is true and canDelete is true", () => {
    render(
      <ProductDetailView
        product={{ ...matchaLatteProduct, neverSold: true }}
        categoryName="Giải trí"
        returnTo="/admin/products"
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Xoá vĩnh viễn/ })).toBeInTheDocument();
  });

  it("hides 'Xoá vĩnh viễn' when neverSold is true but canDelete is false", () => {
    render(
      <ProductDetailView
        product={{ ...matchaLatteProduct, neverSold: true }}
        categoryName="Giải trí"
        returnTo="/admin/products"
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /Xoá vĩnh viễn/ })).toBeNull();
  });

  it("shows 'Bán lại' button and badge 'Ngừng bán' when status is INACTIVE", () => {
    render(
      <ProductDetailView
        product={{ ...matchaLatteProduct, status: "INACTIVE" }}
        categoryName="Giải trí"
        returnTo="/admin/products"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Bán lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngừng bán" })).toBeNull();
    expect(screen.getAllByText("Ngừng bán").length).toBeGreaterThan(0);
  });
});

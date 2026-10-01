// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import ProductsClient from "./ProductsClient";

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
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleProducts = [
  {
    id: "PROD-001",
    name: "Cà phê đen",
    category_id: "CAT-001",
    status: "ACTIVE",
    variants: [{ size_name: "M", price: 20000, status: "ACTIVE" }],
    priceHistory: [],
    neverSold: true,
    hasNoSellableVariant: false,
  },
  {
    id: "PROD-002",
    name: "Cà phê sữa cũ",
    category_id: "CAT-001",
    status: "INACTIVE",
    variants: [{ size_name: "M", price: 25000, status: "ACTIVE" }],
    priceHistory: [],
    neverSold: false,
    hasNoSellableVariant: false,
  },
];

const sampleCategories = [
  { id: "CAT-001", name: "Cà phê" },
];

describe("ProductsClient", () => {
  it("renders status 'Ngừng bán' immediately when initialFilters.status is INACTIVE", () => {
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
        canDelete={false}
        initialFilters={{ q: "", category: "", status: "INACTIVE" }}
      />
    );

    const statusSelect = screen.getByDisplayValue("Ngừng bán") as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect.value).toBe("INACTIVE");
  });

  it("updates URL with replace and scroll:false when typing in search", () => {
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
        canDelete={false}
        initialFilters={{ q: "", category: "", status: "ACTIVE" }}
      />
    );

    const searchInput = screen.getByPlaceholderText("Tên món...");
    fireEvent.change(searchInput, { target: { value: "đen" } });

    expect(replace).toHaveBeenLastCalledWith("/admin/products?q=%C4%91en", { scroll: false });
  });

  it("renders '+ Thêm Món Mới' link pointing to new product page with returnTo", () => {
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
        canDelete={false}
        initialFilters={{ q: "đen", category: "CAT-001", status: "ACTIVE" }}
      />
    );

    const addLink = screen.getByRole("link", { name: /Thêm Món Mới/i });
    expect(addLink).toHaveAttribute(
      "href",
      "/admin/products/new?returnTo=" + encodeURIComponent("/admin/products?q=%C4%91en&category=CAT-001")
    );
  });

  it("renders 'Lịch sử' link pointing to history page with returnTo", () => {
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
        canDelete={false}
        initialFilters={{ q: "", category: "", status: "ACTIVE" }}
      />
    );

    const historyLinks = screen.getAllByRole("link", { name: /Lịch sử/i });
    expect(historyLinks[0]).toHaveAttribute(
      "href",
      "/admin/products/PROD-001/history?returnTo=" + encodeURIComponent("/admin/products")
    );
  });
});

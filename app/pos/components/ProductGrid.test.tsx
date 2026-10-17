// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ProductGrid } from "./ProductGrid";

afterEach(() => {
  cleanup();
});

// one-tap size buttons removed by BR-SALE-019
describe("ProductGrid empty states and Task 3a behaviour", () => {
  const defaultProps = {
    categories: [{ id: "CAT-1", name: "Cà phê" }],
    activeCategory: "BEST_SELLERS",
    setActiveCategory: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    filteredProducts: [],
    variants: [],
    promoVariantsMap: new Map<string, number>(),
    productsWithOptions: new Set<string>(),
    onProductClick: vi.fn(),
    onQuickAdd: vi.fn(),
    disabled: false,
  };

  it("shows 'Chưa có món bán chạy ở điểm bán này' on an empty best-sellers tab with no search", () => {
    render(<ProductGrid {...defaultProps} activeCategory="BEST_SELLERS" searchQuery="" />);

    expect(screen.getByText("Chưa có món bán chạy ở điểm bán này")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy sản phẩm nào")).toBeNull();
  });

  it("shows 'Không tìm thấy sản phẩm nào' when searching within best-sellers", () => {
    render(<ProductGrid {...defaultProps} activeCategory="BEST_SELLERS" searchQuery="tra dao" />);

    expect(screen.getByText("Không tìm thấy sản phẩm nào")).toBeInTheDocument();
    expect(screen.getByText("Thử tìm kiếm với từ khóa khác")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có món bán chạy ở điểm bán này")).toBeNull();
  });

  it("shows 'Không tìm thấy sản phẩm nào' on an empty regular category", () => {
    render(<ProductGrid {...defaultProps} activeCategory="CAT-1" searchQuery="" />);

    expect(screen.getByText("Không tìm thấy sản phẩm nào")).toBeInTheDocument();
    expect(screen.getByText("Thử tìm kiếm với từ khóa khác")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có món bán chạy ở điểm bán này")).toBeNull();
  });

  it("highlights no tab while search box has text", () => {
    const { rerender } = render(
      <ProductGrid {...defaultProps} activeCategory="CAT-1" searchQuery="" />
    );
    expect(screen.getByRole("button", { name: "Cà phê" }).className).toContain("bg-primary");

    rerender(
      <ProductGrid {...defaultProps} activeCategory="CAT-1" searchQuery="bac xiu" />
    );
    expect(screen.getByRole("button", { name: "Cà phê" }).className).not.toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Bán chạy" }).className).not.toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Tất cả món" }).className).not.toContain("bg-primary");
  });

  it("renders 'Bán chạy' without emoji, category icons before names, and active tab with bg-primary text-on-primary", () => {
    render(
      <ProductGrid
        {...defaultProps}
        categories={[
          { id: "CAT-1", name: "Cà phê", icon: "☕" },
          { id: "CAT-2", name: "Trà", icon: null },
        ]}
        activeCategory="BEST_SELLERS"
      />
    );

    const bestSellersTab = screen.getByRole("button", { name: "Bán chạy" });
    expect(bestSellersTab.className).toContain("bg-primary");
    expect(bestSellersTab.className).toContain("text-on-primary");
    expect(bestSellersTab.className).toContain("min-h-[44px]");

    const coffeeTab = screen.getByRole("button", { name: "☕ Cà phê" });
    expect(coffeeTab).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trà" })).toBeInTheDocument();
  });
});

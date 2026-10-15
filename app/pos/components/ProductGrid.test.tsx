// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ProductGrid } from "./ProductGrid";

afterEach(() => {
  cleanup();
});

describe("ProductGrid empty states (Step 3 Item 2)", () => {
  const defaultProps = {
    categories: [{ id: "CAT-1", name: "Cà phê" }],
    activeCategory: "BEST_SELLERS",
    setActiveCategory: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    filteredProducts: [],
    variants: [],
    promoProductsMap: new Map<string, number>(),
    onProductClick: vi.fn(),
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
    expect(screen.getByRole("button", { name: "🔥 Bán chạy" }).className).not.toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Tất cả món" }).className).not.toContain("bg-primary");
  });
});

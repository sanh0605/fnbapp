// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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

  it("passes hasPromo, hasOptions, and onProductClick to the card", () => {
    const product = { id: "P1", name: "Cà phê đen", category_id: "CAT-1" };
    const variant = { id: "V1", product_id: "P1", size_name: "M", price: 25000 };
    const promoMap = new Map<string, number>([["V1", 20000]]);
    const optionsSet = new Set<string>(["P1"]);
    const onProductClick = vi.fn();

    render(
      <ProductGrid
        {...defaultProps}
        filteredProducts={[product]}
        variants={[variant]}
        promoVariantsMap={promoMap}
        productsWithOptions={optionsSet}
        onProductClick={onProductClick}
      />
    );

    // hasPromo reaches both the phone row and the card -> "Khuyến mãi" twice
    expect(screen.getAllByText("Khuyến mãi")).toHaveLength(2);

    // hasOptions reaches card -> shows "Có tuỳ chọn"
    expect(screen.getByText("Có tuỳ chọn")).toBeInTheDocument();

    // onProductClick reaches card / row -> clicking calls onProductClick(product)
    const buttons = screen.getAllByRole("button", { name: "Cà phê đen" });
    expect(buttons.length).toBe(2);
    // jsdom applies no CSS, so both lists are clickable: the phone row, then the card
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onProductClick).toHaveBeenCalledTimes(2);
    expect(onProductClick).toHaveBeenNthCalledWith(2, product);
  });

  it("swipes between tabs on phone (max-width: 767px), but ignores swipe on desktop", () => {
    const setActiveCategory = vi.fn();
    const originalMatchMedia = window.matchMedia;

    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMediaMock;

    try {
      const { container } = render(
        <ProductGrid
          {...defaultProps}
          categories={[{ id: "CAT-1", name: "Cà phê" }]}
          activeCategory="BEST_SELLERS"
          setActiveCategory={setActiveCategory}
        />
      );

      const swipeArea = container.querySelector("div[class*='overflow-y-auto min-h-[200px]']")!;
      if (!swipeArea) throw new Error("swipe area not found");

      // Swipe left (next tab) on phone
      fireEvent.touchStart(swipeArea, { touches: [{ clientX: 200, clientY: 100 }] });
      fireEvent.touchEnd(swipeArea, { changedTouches: [{ clientX: 100, clientY: 100 }] });
      expect(setActiveCategory).toHaveBeenCalledWith("ALL");

      setActiveCategory.mockClear();

      // On desktop (matches: false)
      matchMediaMock.mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      fireEvent.touchStart(swipeArea, { touches: [{ clientX: 200, clientY: 100 }] });
      fireEvent.touchEnd(swipeArea, { changedTouches: [{ clientX: 100, clientY: 100 }] });
      expect(setActiveCategory).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

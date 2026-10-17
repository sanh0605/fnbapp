// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ProductCard } from "./ProductCard";

afterEach(() => {
  cleanup();
});

describe("ProductCard (Task 3a)", () => {
  const sampleProduct = {
    id: "P1",
    name: "Cà phê đen",
  };

  const sampleSizes = [
    { variant: { id: "V1", product_id: "P1", size_name: "M", price: 25000 }, price: 25000 },
    { variant: { id: "V2", product_id: "P1", size_name: "L", price: 32000 }, price: 28000 },
  ];

  it("renders dish name button and one quick-add button per size with formatted price and no emoji or 'đ'", () => {
    const { container } = render(
      <ProductCard
        product={sampleProduct}
        sizes={sampleSizes}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={vi.fn()}
        onQuickAdd={vi.fn()}
      />
    );

    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(screen.getByRole("button", { name: "Cà phê đen" })).toBeInTheDocument();

    const sizeM = screen.getByRole("button", { name: "Thêm Cà phê đen M" });
    const sizeL = screen.getByRole("button", { name: "Thêm Cà phê đen L" });
    expect(sizeM).toHaveTextContent("M");
    expect(sizeM).toHaveTextContent("25,000");
    expect(sizeM.textContent).not.toContain("đ");
    expect(sizeL).toHaveTextContent("L");
    expect(sizeL).toHaveTextContent("28,000");

    expect(screen.queryByText("☕")).toBeNull();
    expect(screen.queryByText("🥤")).toBeNull();
    expect(screen.queryByText("Có tuỳ chọn")).toBeNull();
    expect(screen.queryByText("Khuyến mãi")).toBeNull();
  });

  it("shows 'Có tuỳ chọn' when hasOptions is true and 'Khuyến mãi' tag when hasPromo is true", () => {
    render(
      <ProductCard
        product={sampleProduct}
        sizes={sampleSizes}
        hasPromo={true}
        hasOptions={true}
        disabled={false}
        onOpen={vi.fn()}
        onQuickAdd={vi.fn()}
      />
    );

    expect(screen.getByText("Có tuỳ chọn")).toBeInTheDocument();
    const promoTag = screen.getByText("Khuyến mãi");
    expect(promoTag).toBeInTheDocument();
    expect(promoTag.className).toContain("bg-primary-soft");
    expect(promoTag.className).toContain("text-primary");
  });

  it("calls onOpen when tapping dish name and calls onQuickAdd(variant) + blurs when tapping a size button", () => {
    const onOpen = vi.fn();
    const onQuickAdd = vi.fn();

    render(
      <ProductCard
        product={sampleProduct}
        sizes={sampleSizes}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={onOpen}
        onQuickAdd={onQuickAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cà phê đen" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onQuickAdd).not.toHaveBeenCalled();

    const sizeBtn = screen.getByRole("button", { name: "Thêm Cà phê đen M" });
    sizeBtn.focus();
    expect(document.activeElement).toBe(sizeBtn);

    fireEvent.click(sizeBtn);
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect(onQuickAdd).toHaveBeenCalledWith(sampleSizes[0].variant);
    expect(document.activeElement).not.toBe(sizeBtn);
  });

  it("disables top button and all size buttons when disabled is true", () => {
    render(
      <ProductCard
        product={sampleProduct}
        sizes={sampleSizes}
        hasPromo={false}
        hasOptions={false}
        disabled={true}
        onOpen={vi.fn()}
        onQuickAdd={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Cà phê đen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thêm Cà phê đen M" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thêm Cà phê đen L" })).toBeDisabled();
  });
});

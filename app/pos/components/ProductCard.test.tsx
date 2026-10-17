// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ProductCard } from "./ProductCard";

afterEach(() => {
  cleanup();
});

// one-tap size buttons removed by BR-SALE-019
describe("ProductCard (Task 3a)", () => {
  const sampleProduct = {
    id: "P1",
    name: "Cà phê đen",
  };

  const sampleSizes = [
    { variant: { id: "V1", product_id: "P1", size_name: "M", price: 25000 }, price: 25000 },
    { variant: { id: "V2", product_id: "P1", size_name: "L", price: 32000 }, price: 28000 },
  ];

  // Task 4a Test 7
  it("the dish card has no 'Thêm … 360ml' buttons", () => {
    const productWith360 = { id: "P-CFD", name: "Cà phê đá" };
    const sizesWith360 = [
      { variant: { id: "V-360", product_id: "P-CFD", size_name: "360ml", price: 15000 }, price: 15000 },
      { variant: { id: "V-500", product_id: "P-CFD", size_name: "500ml", price: 18000 }, price: 18000 },
    ];

    render(
      <ProductCard
        product={productWith360}
        sizes={sizesWith360}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={vi.fn()}
        onQuickAdd={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Thêm .* 360ml/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Thêm / })).toBeNull();
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

  it("calls onOpen when tapping dish name", () => {
    const onOpen = vi.fn();

    render(
      <ProductCard
        product={sampleProduct}
        sizes={sampleSizes}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={onOpen}
        onQuickAdd={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cà phê đen" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("disables card button when disabled is true", () => {
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
  });
});

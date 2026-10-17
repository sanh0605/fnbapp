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
      />
    );

    expect(screen.getByRole("button", { name: "Cà phê đen" })).toBeDisabled();
  });

  it("renders without emoji, without 'đ', and omits 'Có tuỳ chọn' and 'Khuyến mãi' when false", () => {
    render(
      <ProductCard
        product={sampleProduct}
        sizes={[{ variant: { id: "V1", price: 25000 }, price: 25000 }]}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={vi.fn()}
      />
    );

    const card = screen.getByRole("button", { name: "Cà phê đen" });
    expect(screen.queryByText("Có tuỳ chọn")).toBeNull();
    expect(screen.queryByText("Khuyến mãi")).toBeNull();
    expect(card.textContent).not.toMatch(/\d\s*đ/); // prices carry no "đ"; the name may
    expect(card.textContent).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it("renders list-price range '15,000 – 18,000', or one price when one size", () => {
    const { rerender } = render(
      <ProductCard
        product={{ id: "P-CFD", name: "Cà phê đá" }}
        sizes={[
          { variant: { id: "V-360", price: 15000 }, price: 15000 },
          { variant: { id: "V-500", price: 18000 }, price: 18000 },
        ]}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={vi.fn()}
      />
    );

    const card = screen.getByRole("button", { name: "Cà phê đá" });
    expect(card.textContent).toContain("15,000 – 18,000");

    rerender(
      <ProductCard
        product={{ id: "P-CFD", name: "Cà phê đá" }}
        sizes={[
          { variant: { id: "V-360", price: 15000 }, price: 15000 },
        ]}
        hasPromo={false}
        hasOptions={false}
        disabled={false}
        onOpen={vi.fn()}
      />
    );

    const cardSingle = screen.getByRole("button", { name: "Cà phê đá" });
    expect(cardSingle.textContent).toContain("15,000");
    expect(cardSingle.textContent).not.toContain("–");
  });
});

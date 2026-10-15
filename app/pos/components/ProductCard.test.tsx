// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ProductCard } from "./ProductCard";

afterEach(() => {
  cleanup();
});

describe("ProductCard category icon (R4)", () => {
  const sampleProduct = {
    id: "P1",
    name: "Cà phê đen",
    image_url: null,
  };

  it("renders group's own icon when set", () => {
    const category = { id: "C1", name: "Cà phê", icon: "☕" };
    render(
      <ProductCard
        product={sampleProduct}
        category={category}
        basePrice={25000}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText("☕")).toBeInTheDocument();
  });

  it("renders no emoji when category icon is null or blank (tidy card)", () => {
    const category = { id: "C1", name: "Cà phê", icon: null };
    render(
      <ProductCard
        product={sampleProduct}
        category={category}
        basePrice={25000}
        onClick={vi.fn()}
      />
    );
    // Should NOT show the old hardcoded default 🥤 or any emoji
    expect(screen.queryByText("🥤")).toBeNull();
    expect(screen.queryByText("☕")).toBeNull();
  });

  it("renders product image when image_url exists", () => {
    const productWithImage = { ...sampleProduct, image_url: "/coffee.png" };
    const category = { id: "C1", name: "Cà phê", icon: "☕" };
    render(
      <ProductCard
        product={productWithImage}
        category={category}
        basePrice={25000}
        onClick={vi.fn()}
      />
    );
    const img = screen.getByRole("img", { name: "Cà phê đen" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/coffee.png");
  });

  it("renders compact card without aspect-square block when neither image nor icon exists", () => {
    const category = { id: "C1", name: "Cà phê", icon: null };
    const { container } = render(
      <ProductCard
        product={sampleProduct}
        category={category}
        basePrice={25000}
        onClick={vi.fn()}
      />
    );
    expect(container.querySelector(".aspect-square")).toBeNull();
    expect(screen.getByText("Cà phê đen")).toBeInTheDocument();
    expect(screen.getByText("25,000")).toBeInTheDocument();
  });

  it("renders icon small without aspect-square container when icon is present without image", () => {
    const category = { id: "C1", name: "Cà phê", icon: "☕" };
    const { container } = render(
      <ProductCard
        product={sampleProduct}
        category={category}
        basePrice={25000}
        onClick={vi.fn()}
      />
    );
    expect(container.querySelector(".aspect-square")).toBeNull();
    expect(screen.getByText("☕")).toBeInTheDocument();
  });
});

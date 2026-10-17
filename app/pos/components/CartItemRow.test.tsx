// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { CartItemRow } from "./CartItemRow";

afterEach(() => {
  cleanup();
});

describe("CartItemRow line text (BR-SALE-019, Task 5a)", () => {
  const defaultProps = {
    idx: 0,
    products: [{ id: "P1", name: "Cà phê đá" }],
    itemPromoDiscount: 0,
    openProductModal: vi.fn(),
    removeFromCart: vi.fn(),
    changeQty: vi.fn(),
  };

  it("reads '360ml · Ít ngọt · Ít đá · Kem muối' with no 'Size ' prefix and shows two portions as 'Kem muối ×2'", () => {
    const singlePortionItem = {
      id: "line-1",
      product_id: "P1",
      product_name: "Cà phê đá",
      variant_id: "V1",
      size_name: "360ml",
      unit_price: 15000,
      qty: 1,
      modifiers: [
        { id: "M1", name: "Ít ngọt", price: 0 },
        { id: "M2", name: "Ít đá", price: 0 },
        { id: "M3", name: "Kem muối", price: 4000 },
      ],
      discount_amount: 0,
      discount_type: "VND",
    };

    const { unmount } = render(<CartItemRow {...defaultProps} item={singlePortionItem} />);
    expect(screen.queryByText(/Size 360ml/i)).toBeNull();
    expect(screen.getByText("360ml · Ít ngọt · Ít đá · Kem muối")).toBeInTheDocument();
    unmount();

    const doublePortionItem = {
      ...singlePortionItem,
      id: "line-2",
      modifiers: [
        { id: "M1", name: "Ít ngọt", price: 0 },
        { id: "M2", name: "Ít đá", price: 0 },
        { id: "M3", name: "Kem muối", price: 4000 },
        { id: "M3", name: "Kem muối", price: 4000 },
      ],
    };

    render(<CartItemRow {...defaultProps} item={doublePortionItem} />);
    expect(screen.queryByText(/Size 360ml/i)).toBeNull();
    expect(screen.getByText("360ml · Ít ngọt · Ít đá · Kem muối ×2")).toBeInTheDocument();
  });
});

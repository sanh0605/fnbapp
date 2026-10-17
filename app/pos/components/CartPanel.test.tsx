// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { CartPanel } from "./CartPanel";

afterEach(() => {
  cleanup();
});

describe("Discount (R3)", () => {
  const sampleCart = [
    {
      id: "line-1",
      product_id: "P1",
      product_name: "Bạc xỉu",
      variant_id: "V1",
      size_name: "M",
      unit_price: 81_000,
      qty: 1,
      modifiers: [],
      discount_amount: 0,
      discount_type: "VND",
    },
  ];

  const defaultProps = {
    cart: sampleCart,
    products: [{ id: "P1", name: "Bạc xỉu" }],
    isCartOpen: true,
    setIsCartOpen: vi.fn(),
    saveDraft: vi.fn(),
    drafts: [],
    setCart: vi.fn(),
    setActiveDraftId: vi.fn(),
    activeDraftId: null,
    openProductModal: vi.fn(),
    removeFromCart: vi.fn(),
    changeQty: vi.fn(),
    promoCodeInput: "",
    setPromoCodeInput: vi.fn(),
    handleApplyPromoCode: vi.fn(),
    handleRemovePromoCode: vi.fn(),
    promoDiscountAmount: 0,
    orderManualAmount: 0,
    totalAmount: 81_000,
    manualPromoError: null,
    userCustomDiscountType: "VND" as const,
    setUserCustomDiscountType: vi.fn(),
    userCustomDiscount: null,
    setUserCustomDiscount: vi.fn(),
    handleConfirmCheckout: vi.fn(),
    isCheckingOut: null,
    itemPromoDiscounts: [0],
    isOnline: true,
    onResendFailedOrder: vi.fn(),
    promotionSets: [],
    chosenSetIndex: 0,
    onSelectSet: vi.fn(),
    appliedPromotions: [],
    promotions: [],
    appliedPromoCode: null,
  };

  describe("R3 Discount box clamping", () => {
    it("has inputMode='numeric' on whole-order discount box", () => {
      render(<CartPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      expect(discountInput).toHaveAttribute("inputMode", "numeric");
    });

    it("clamps whole-order discount when cashier types above subtotal (e.g. 150.000 on 81.000)", () => {
      const setUserCustomDiscount = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          setUserCustomDiscount={setUserCustomDiscount}
          userCustomDiscountType="VND"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(discountInput, { target: { value: "150000" } });

      // Subtotal of cart is 81.000, so 150.000 must be clamped to 81.000
      expect(setUserCustomDiscount).toHaveBeenCalledWith(81_000);
    });

    it("clamps negative discount to 0", () => {
      const setUserCustomDiscount = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          setUserCustomDiscount={setUserCustomDiscount}
          userCustomDiscountType="VND"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(discountInput, { target: { value: "-10000" } });
      expect(setUserCustomDiscount).toHaveBeenCalledWith(0);
    });

    it("clamps percent discount above 100 to 100 (e.g. 101 -> 100)", () => {
      const setUserCustomDiscount = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          setUserCustomDiscount={setUserCustomDiscount}
          userCustomDiscountType="PERCENT"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(discountInput, { target: { value: "101" } });
      expect(setUserCustomDiscount).toHaveBeenCalledWith(100);
    });
  });

  describe("Task 3b: Promo disclosure", () => {
    it("with nothing applied, the disclosure is closed and the promo-code box is not in the page", () => {
      render(<CartPanel {...defaultProps} appliedPromoCode={null} userCustomDiscount={null} />);

      const disclosureBtn = screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i });
      expect(disclosureBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText("Mã giảm giá")).toBeNull();
      expect(screen.queryByLabelText("Giảm giá tùy chỉnh")).toBeNull();
    });

    it("with an applied promo code, the disclosure is open", () => {
      render(<CartPanel {...defaultProps} appliedPromoCode="SALE10" />);

      const disclosureBtn = screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i });
      expect(disclosureBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Mã giảm giá")).toBeInTheDocument();
      expect(screen.getByText("Mã: SALE10")).toBeInTheDocument();
    });
  });

  describe("Cash checkout", () => {
    it("clicking TIỀN MẶT calls handleConfirmCheckout with 'Tien mat' once", () => {
      const handleConfirmCheckout = vi.fn();
      render(<CartPanel {...defaultProps} handleConfirmCheckout={handleConfirmCheckout} />);
      const cashButton = screen.getByRole("button", { name: /TIỀN MẶT/i });
      fireEvent.click(cashButton);
      expect(handleConfirmCheckout).toHaveBeenCalledTimes(1);
      expect(handleConfirmCheckout).toHaveBeenCalledWith("Tien mat");
    });
  });
});


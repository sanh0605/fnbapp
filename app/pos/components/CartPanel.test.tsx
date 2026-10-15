// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { formatNumber } from "@/lib/shared/format";
import { CartPanel } from "./CartPanel";

afterEach(() => {
  cleanup();
});

describe("CartPanel Discount & Cash Tender (R2 & R3)", () => {
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
    isCashStepOpen: false,
    setIsCashStepOpen: vi.fn(),
    cashTendered: null,
    setCashTendered: vi.fn(),
  };

  describe("R3 Discount box clamping", () => {
    it("has inputMode='numeric' on whole-order discount box", () => {
      render(<CartPanel {...defaultProps} />);
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
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(discountInput, { target: { value: "101" } });
      expect(setUserCustomDiscount).toHaveBeenCalledWith(100);
    });
  });

  describe("R2 Khách đưa / Tiền thừa step", () => {
    it("opens inline cash tender step when tapping TIỀN MẶT", () => {
      const setIsCashStepOpen = vi.fn();
      const setCashTendered = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          setIsCashStepOpen={setIsCashStepOpen}
          setCashTendered={setCashTendered}
        />
      );

      const cashButton = screen.getByRole("button", { name: /TIỀN MẶT/i });
      fireEvent.click(cashButton);

      expect(setIsCashStepOpen).toHaveBeenCalledWith(true);
      expect(setCashTendered).toHaveBeenCalledWith(81_000);
    });

    it("prefills 'Khách đưa' with formatted total amount and uses inputMode='numeric' without spinner", () => {
      render(<CartPanel {...defaultProps} isCashStepOpen={true} cashTendered={81_000} />);
      const input = screen.getByLabelText("Khách đưa") as HTMLInputElement;
      expect(input.value).toBe(formatNumber(81_000));
      expect(input).toHaveAttribute("inputMode", "numeric");
      expect(input).toHaveAttribute("type", "text");
    });

    it("provides quick buttons for round notes above total (for 81.000 -> 100.000, 200.000, 500.000)", () => {
      render(<CartPanel {...defaultProps} isCashStepOpen={true} cashTendered={81_000} />);
      expect(screen.getByRole("button", { name: formatNumber(100_000) })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: formatNumber(200_000) })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: formatNumber(500_000) })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: formatNumber(50_000) })).toBeNull();
    });

    it("shows live 'Tiền thừa' when tendered is greater than total (200.000 for 81.000 -> Tiền thừa 119.000)", () => {
      render(<CartPanel {...defaultProps} isCashStepOpen={true} cashTendered={200_000} />);
      expect(screen.getByText("Tiền thừa")).toBeInTheDocument();
      expect(screen.getByText(formatNumber(119_000))).toBeInTheDocument();
    });

    it("shows 'Khách đưa còn thiếu' and disables confirm when tendered is less than total", () => {
      render(<CartPanel {...defaultProps} isCashStepOpen={true} cashTendered={50_000} />);
      expect(screen.getByText("Khách đưa còn thiếu")).toBeInTheDocument();
      expect(screen.getByText(formatNumber(31_000))).toBeInTheDocument();

      const confirmBtn = screen.getByRole("button", { name: "Xác nhận thanh toán" });
      expect(confirmBtn).toBeDisabled();
    });

    it("clicking quick note button updates tendered cash", () => {
      const setCashTendered = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          isCashStepOpen={true}
          cashTendered={81_000}
          setCashTendered={setCashTendered}
        />
      );
      const note200k = screen.getByRole("button", { name: formatNumber(200_000) });
      fireEvent.click(note200k);
      expect(setCashTendered).toHaveBeenCalledWith(200_000);
    });

    it("confirms cash checkout when valid amount is tendered", () => {
      const handleConfirmCheckout = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          isCashStepOpen={true}
          cashTendered={100_000}
          handleConfirmCheckout={handleConfirmCheckout}
        />
      );
      const confirmBtn = screen.getByRole("button", { name: "Xác nhận thanh toán" });
      expect(confirmBtn).not.toBeDisabled();
      fireEvent.click(confirmBtn);

      expect(handleConfirmCheckout).toHaveBeenCalledWith("Tien mat");
    });

    it("hides promo and discount blocks while cash step is open", () => {
      const { rerender } = render(<CartPanel {...defaultProps} isCashStepOpen={false} />);
      expect(screen.getByLabelText("Mã giảm giá")).toBeInTheDocument();
      expect(screen.getByLabelText("Giảm giá tùy chỉnh")).toBeInTheDocument();

      rerender(<CartPanel {...defaultProps} isCashStepOpen={true} cashTendered={81_000} />);
      expect(screen.queryByLabelText("Mã giảm giá")).toBeNull();
      expect(screen.queryByLabelText("Giảm giá tùy chỉnh")).toBeNull();
      expect(screen.getByText("Bạc xỉu")).toBeInTheDocument();
    });

    it("Enter on input confirms when tendered >= total and stops propagation", () => {
      const handleConfirmCheckout = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          isCashStepOpen={true}
          cashTendered={100_000}
          handleConfirmCheckout={handleConfirmCheckout}
        />
      );
      const input = screen.getByLabelText("Khách đưa");
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(event, "stopPropagation");
      input.dispatchEvent(event);

      expect(handleConfirmCheckout).toHaveBeenCalledWith("Tien mat");
      expect(stopSpy).toHaveBeenCalled();
    });

    it("Enter on input sends nothing when box is blank (null)", () => {
      const handleConfirmCheckout = vi.fn();
      render(
        <CartPanel
          {...defaultProps}
          isCashStepOpen={true}
          cashTendered={null}
          handleConfirmCheckout={handleConfirmCheckout}
        />
      );
      const input = screen.getByLabelText("Khách đưa");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(handleConfirmCheckout).not.toHaveBeenCalled();
    });
  });
});

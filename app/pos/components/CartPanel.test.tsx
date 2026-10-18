// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import React from "react";
import { CartPanel } from "./CartPanel";

// Owns the step state the way POSScreen does; isPayStepOpen only sets where it starts.
function CartPanelWithState(props: any) {
  const [isPayStepOpen, setIsPayStepOpen] = React.useState(props.isPayStepOpen ?? false);
  const [userCustomDiscount, setUserCustomDiscount] = React.useState<number | null>(
    props.userCustomDiscount ?? null
  );
  const [userCustomDiscountType, setUserCustomDiscountType] = React.useState(
    props.userCustomDiscountType ?? "VND"
  );
  return (
    <CartPanel
      {...props}
      isPayStepOpen={isPayStepOpen}
      setIsPayStepOpen={setIsPayStepOpen}
      userCustomDiscount={userCustomDiscount}
      setUserCustomDiscount={(val: number | null) => {
        setUserCustomDiscount(val);
        props.setUserCustomDiscount?.(val);
      }}
      userCustomDiscountType={userCustomDiscountType}
      setUserCustomDiscountType={(t: any) => {
        setUserCustomDiscountType(t);
        props.setUserCustomDiscountType?.(t);
      }}
    />
  );
}

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
    isPayStepOpen: false,
    setIsPayStepOpen: vi.fn(),
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

    it("a typed minus sign is dropped: -10000 applies 10,000", () => {
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
      expect(discountInput).toHaveValue("10,000");
      expect(setUserCustomDiscount).toHaveBeenCalledWith(10_000);
    });

    it("groups thousands while typing in order discount box (shows 10,000 and reflects discount)", () => {
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
      fireEvent.change(discountInput, { target: { value: "10000" } });
      expect(discountInput).toHaveValue("10,000");
      expect(setUserCustomDiscount).toHaveBeenCalledWith(10_000);
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

    it("order box in % mode accepts '12.5'", () => {
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
      fireEvent.change(discountInput, { target: { value: "12.5" } });
      expect(discountInput).toHaveValue("12.5");
      expect(setUserCustomDiscount).toHaveBeenCalledWith(12.5);
    });

    it("order box: 12.5 in % mode, press VNĐ -> box shows '13' and 13 is applied", () => {
      const setUserCustomDiscount = vi.fn();
      render(
        <CartPanelWithState
          {...defaultProps}
          userCustomDiscountType="PERCENT"
          setUserCustomDiscount={setUserCustomDiscount}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(discountInput, { target: { value: "12.5" } });
      expect(discountInput).toHaveValue("12.5");
      expect(setUserCustomDiscount).toHaveBeenCalledWith(12.5);

      fireEvent.click(screen.getByRole("button", { name: "VNĐ" }));
      expect(discountInput).toHaveValue("13");
      expect(setUserCustomDiscount).toHaveBeenLastCalledWith(13);
    });

    it("shows max message when typing above limit and applied discount equals limit", () => {
      const setUserCustomDiscount = vi.fn();
      render(
        <CartPanelWithState
          {...defaultProps}
          setUserCustomDiscount={setUserCustomDiscount}
          userCustomDiscountType="VND"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const discountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(discountInput, { target: { value: "150000" } });
      expect(discountInput).toHaveValue("81,000");

      fireEvent.change(discountInput, { target: { value: "810000" } });
      expect(screen.getByText("Tối đa 81,000đ")).toBeInTheDocument();
      expect(discountInput).toHaveValue("810,000");
      expect(setUserCustomDiscount).toHaveBeenLastCalledWith(81_000);
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

  describe("Cash checkout (BR-SALE-020)", () => {
    it("asserts Tiền mặt comes before Chuyển khoản in document order", () => {
      render(<CartPanelWithState {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      const cashButton = screen.getByRole("button", { name: "Tiền mặt" });
      const transferButton = screen.getByRole("button", { name: "Chuyển khoản" });
      expect(
        cashButton.compareDocumentPosition(transferButton) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("clicking Tiền mặt calls handleConfirmCheckout with 'Tien mat' once", () => {
      const handleConfirmCheckout = vi.fn();
      render(<CartPanelWithState {...defaultProps} handleConfirmCheckout={handleConfirmCheckout} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      const cashButton = screen.getByRole("button", { name: "Tiền mặt" });
      fireEvent.click(cashButton);
      expect(handleConfirmCheckout).toHaveBeenCalledTimes(1);
      expect(handleConfirmCheckout).toHaveBeenCalledWith("Tien mat");
    });
  });

  describe("Task 5a: Cart payment flow and method step (BR-SALE-020)", () => {
    it("renders one 'Thanh toán' button and no 'TIỀN MẶT' in the order view", () => {
      render(<CartPanelWithState {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Thanh toán" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /TIỀN MẶT/i })).toBeNull();
    });

    it("clicking 'Thanh toán' shows 'Khách trả bằng gì?', and Tiền mặt has focus", () => {
      render(<CartPanelWithState {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tiền mặt" }));
    });

    it("Tiền mặt calls checkout with 'Tien mat'; Chuyển khoản calls it with 'Chuyen khoan'", () => {
      const handleConfirmCheckout = vi.fn();
      const { unmount } = render(<CartPanelWithState {...defaultProps} handleConfirmCheckout={handleConfirmCheckout} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));
      expect(handleConfirmCheckout).toHaveBeenCalledWith("Tien mat");

      unmount();
      handleConfirmCheckout.mockClear();
      render(<CartPanelWithState {...defaultProps} handleConfirmCheckout={handleConfirmCheckout} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      fireEvent.click(screen.getByRole("button", { name: "Chuyển khoản" }));
      expect(handleConfirmCheckout).toHaveBeenCalledWith("Chuyen khoan");
    });

    it("offline: Thanh toán is disabled; offline with the step open: Tiền mặt, Chuyển khoản, and Chia tiền mặt + chuyển khoản are disabled", () => {
      const { unmount } = render(<CartPanelWithState {...defaultProps} isOnline={false} isPayStepOpen={false} />);
      expect(screen.getByRole("button", { name: "Thanh toán" })).toBeDisabled();
      unmount();

      // Offline with the step open
      render(<CartPanelWithState {...defaultProps} isOnline={false} isPayStepOpen={true} />);
      expect(screen.getByRole("button", { name: "Tiền mặt" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Chuyển khoản" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Chia tiền mặt + chuyển khoản" })).toBeDisabled();
    });

    it("Quay lại đơn returns to the order view", () => {
      render(<CartPanelWithState {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Quay lại đơn/i }));
      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(screen.getByRole("button", { name: "Thanh toán" })).toBeInTheDocument();
    });

    it("error strip displays 'Chia tiền mặt + chuyển khoản' when lastCheckoutError method is SPLIT", () => {
      render(
        <CartPanelWithState
          {...defaultProps}
          lastCheckoutError={{
            method: "SPLIT",
            error: "Lỗi kết nối",
            retry: false,
          }}
        />
      );
      expect(
        screen.getByText(/Lỗi thanh toán \(Chia tiền mặt \+ chuyển khoản\)/)
      ).toBeInTheDocument();
    });

    it("groups thousands while typing in split-payment box (shows 10,000 and reflects total)", () => {
      render(<CartPanelWithState {...defaultProps} totalAmount={50_000} />);
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      fireEvent.click(screen.getByRole("button", { name: "Chia tiền mặt + chuyển khoản" }));
      const splitInput = screen.getByLabelText("Số tiền phần thanh toán");
      fireEvent.change(splitInput, { target: { value: "10000" } });
      expect(splitInput).toHaveValue("10,000");
      fireEvent.click(screen.getByRole("button", { name: "Thêm phần thanh toán" }));
      // 50,000 total − 10,000 entered: "Còn thiếu" reads 40,000
      expect(screen.getByText("40,000")).toBeInTheDocument();
    });

    it("Esc with the split box open closes only the box; the payment step stays", () => {
      // Stands in for POSScreen's window listener, which closes the payment step on Esc.
      const tillEsc = vi.fn();
      window.addEventListener("keydown", tillEsc);
      try {
        render(
          <CartPanel
            {...defaultProps}
            isPayStepOpen={true}
          />
        );
        fireEvent.click(screen.getByRole("button", { name: "Chia tiền mặt + chuyển khoản" }));
        const boxHeader = screen.getByRole("heading", { name: "Thanh toán nhiều hình thức" }).parentElement!;

        fireEvent.keyDown(within(boxHeader).getByRole("button", { name: "Đóng" }), { key: "Escape" });
      } finally {
        window.removeEventListener("keydown", tillEsc);
      }
      expect(screen.queryByRole("heading", { name: "Thanh toán nhiều hình thức" })).toBeNull();
      expect(tillEsc).not.toHaveBeenCalled();
    });
  });

  describe("Ticket H8: visual fixes", () => {
    it("with an empty cart and nothing being sent, cart-footer is absent; with one item it is present", () => {
      const { rerender } = render(
        <CartPanel {...defaultProps} cart={[]} processingOrder={null} lastCheckoutError={null} />
      );
      expect(screen.queryByTestId("cart-footer")).toBeNull();

      rerender(
        <CartPanel {...defaultProps} cart={sampleCart} processingOrder={null} lastCheckoutError={null} />
      );
      expect(screen.getByTestId("cart-footer")).toBeInTheDocument();
    });

    it("'Lưu nháp' and 'Xoá hết' have the class border", () => {
      render(<CartPanel {...defaultProps} cart={sampleCart} />);
      const saveDraftBtn = screen.getByRole("button", { name: "Lưu nháp" });
      const clearBtn = screen.getByRole("button", { name: "Xoá hết" });
      expect(saveDraftBtn.className).toContain("border");
      expect(clearBtn.className).toContain("border");
    });

    // The title itself stays on one line through its truncate span (next test).
    it("the cart header stays on one line: both buttons never wrap", () => {
      render(<CartPanel {...defaultProps} cart={sampleCart} />);
      expect(screen.getByRole("button", { name: "Lưu nháp" }).className).toContain("whitespace-nowrap");
      expect(screen.getByRole("button", { name: "Xoá hết" }).className).toContain("whitespace-nowrap");
    });

    it("on a very narrow phone the title gives way, not the buttons", () => {
      render(<CartPanel {...defaultProps} cart={sampleCart} />);
      const heading = screen.getByRole("heading", { name: /Hoá đơn/ });
      expect(heading.className).toContain("min-w-0");
      expect(screen.getByText("Hoá đơn").className).toContain("truncate");
      expect(screen.getByRole("button", { name: "Lưu nháp" }).parentElement?.className).toContain("shrink-0");
    });
  });
});


// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within, act } from "@testing-library/react";
import React from "react";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn().mockResolvedValue({ success: true }),
  getPOSDrafts: vi.fn().mockResolvedValue([]),
  savePOSDraft: vi.fn().mockResolvedValue({ success: true }),
  deletePOSDraft: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
}));

import { submitOrderV2, savePOSDraft } from "@/app/pos/actions";
import { alert, confirm } from "@/lib/shared/dialog";
import POSScreen from "./POSScreen";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(confirm).mockResolvedValue(true);
  vi.mocked(submitOrderV2).mockReset();
  vi.mocked(submitOrderV2).mockResolvedValue({ success: true } as any);
  vi.mocked(savePOSDraft).mockReset();
  vi.mocked(savePOSDraft).mockResolvedValue({
    success: true,
    draft: { id: "draft-1", name: "Draft", cart_json: "[]" },
  } as any);
});

describe("POSScreen (Step 3 & 5)", () => {
  const sampleProducts = [
    { id: "P1", name: "Bạc xỉu", category_id: "CAT-1", status: "ACTIVE" },
    { id: "P2", name: "Đường đen sữa tươi", category_id: "CAT-1", status: "ACTIVE" },
    { id: "P3", name: "Trà đào", category_id: "CAT-2", status: "ACTIVE" },
    { id: "P4", name: "Cà phê đen", category_id: "CAT-1", status: "ACTIVE" },
  ];

  const sampleCategories = [
    { id: "CAT-1", name: "Cà phê", icon: "☕" },
    { id: "CAT-2", name: "Trà", icon: "🍵" },
  ];

  const sampleVariants = [
    { id: "V1", product_id: "P1", size_name: "M", price: 29000 },
    { id: "V1-L", product_id: "P1", size_name: "L", price: 39000 },
    { id: "V2", product_id: "P2", size_name: "M", price: 35000 },
    { id: "V2-L", product_id: "P2", size_name: "L", price: 45000 },
    { id: "V3", product_id: "P3", size_name: "M", price: 30000 },
    { id: "V3-L", product_id: "P3", size_name: "L", price: 40000 },
    { id: "V4", product_id: "P4", size_name: "M", price: 25000 },
    { id: "V4-L", product_id: "P4", size_name: "L", price: 35000 },
  ];

  const defaultProps = {
    categories: sampleCategories,
    products: sampleProducts,
    variants: sampleVariants,
    modifiers: [],
    optionGroups: [],
    optionGroupLinks: [],
    promotions: [],
    outletId: "OUT-1",
    brandId: "BR-1",
    bestSellers: ["P1", "P2", "P3", "P4"],
  };

  function startCashCheckout() {
    fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));
  }

  function clickProduct(name: string) {
    const el = screen.getAllByText(name)[0];
    if (!el) throw new Error(`product tile not found: ${name}`);
    fireEvent.click(el);
  }

  function clickProductButton(name: string) {
    const buttons = screen.getAllByRole("button", { name });
    if (buttons.length === 0) throw new Error(`product button not found: ${name}`);
    fireEvent.click(buttons[0]);
  }

  describe("R5: Search without accents", () => {
    it("typing 'bac xiu' finds 'Bạc xỉu'", () => {
      render(<POSScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Ví dụ: Trà đào");
      fireEvent.change(searchInput, { target: { value: "bac xiu" } });

      expect(screen.getAllByText("Bạc xỉu").length).toBeGreaterThan(0);
      expect(screen.queryByText("Đường đen sữa tươi")).toBeNull();
      expect(screen.queryByText("Trà đào")).toBeNull();
    });

    it("typing 'DUONG' finds 'Đường đen sữa tươi'", () => {
      render(<POSScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Ví dụ: Trà đào");
      fireEvent.change(searchInput, { target: { value: "DUONG" } });

      expect(screen.getAllByText("Đường đen sữa tươi").length).toBeGreaterThan(0);
      expect(screen.queryByText("Bạc xỉu")).toBeNull();
      expect(screen.queryByText("Trà đào")).toBeNull();
    });
  });

  describe("Step 5: Đăng xuất on the till", () => {
    it("renders 'Đăng xuất' button in header", () => {
      render(<POSScreen {...defaultProps} />);
      const logoutBtn = screen.getByRole("button", { name: "Đăng xuất" });
      expect(logoutBtn).toBeInTheDocument();
    });

    it("calls signOut({ callbackUrl: '/login' }) when cart is empty", async () => {
      render(<POSScreen {...defaultProps} />);
      const logoutBtn = screen.getByRole("button", { name: "Đăng xuất" });
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" });
      });
    });

    it("does NOT log out if cart is not empty and shows 'Lưu nháp hoặc thanh toán trước khi đăng xuất'", async () => {
      render(<POSScreen {...defaultProps} />);

      // Click on a product to open modal, then add to cart
      clickProduct("Bạc xỉu");

      const addBtn = screen.getByRole("button", { name: /^Thêm vào đơn/ });
      fireEvent.click(addBtn);

      // Cart now has items
      const logoutBtn = screen.getByRole("button", { name: "Đăng xuất" });
      fireEvent.click(logoutBtn);

      // Must not call signOut
      expect(signOutMock).not.toHaveBeenCalled();

      // Must display message
      expect(screen.getByText("Lưu nháp hoặc thanh toán trước khi đăng xuất")).toBeInTheDocument();
    });
  });

  // cash confirm on Enter removed by BR-SALE-020
  describe("Enter key cash flow (BR-SALE-020)", () => {
    it("Enter while sending sends nothing", async () => {
      let resolveSubmit: (val: any) => void;
      vi.mocked(submitOrderV2).mockImplementationOnce(
        () => new Promise((resolve) => { resolveSubmit = resolve; }) as any
      );

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Start checkout via Thanh toán -> Tiền mặt
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));
      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });

      // Enter while sending: sends nothing
      fireEvent.keyDown(window, { key: "Enter" });
      expect(submitOrderV2).toHaveBeenCalledTimes(1);

      resolveSubmit!({ success: true });
    });

    it("Enter while offline sends nothing", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      fireEvent(window, new Event("offline"));

      fireEvent.keyDown(window, { key: "Enter" });
      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("the first Enter opens the step (heading 'Khách trả bằng gì?', focus on Tiền mặt) and sends nothing", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      fireEvent.keyDown(window, { key: "Enter" });

      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tiền mặt" }));
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("Enter while the item modal is open (a product card clicked so ItemPicker shows) sends nothing and does not call confirm", () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      clickProduct("Đường đen sữa tươi");
      expect(screen.getByRole("button", { name: /^Thêm vào đơn/ })).toBeInTheDocument();

      (document.activeElement as HTMLElement)?.blur?.();

      fireEvent.keyDown(window, { key: "Enter" });

      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });
  });

  // cash confirm on Enter removed by BR-SALE-020
  describe("Item 1: Enter sends exactly once, blank cart sends nothing", () => {
    it("Enter on blank cart sends nothing", async () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.keyDown(window, { key: "Enter" });

      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("Enter with focus on a button does not send order", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      const draftBtn = screen.getByRole("button", { name: "Lưu nháp" });
      draftBtn.focus();
      expect(document.activeElement).toBe(draftBtn);

      fireEvent.keyDown(window, { key: "Enter" });

      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });
  });

  describe("Task 5a: Method step and Enter (BR-SALE-020)", () => {
    it("Enter with lines opens the step. Enter with an empty cart does nothing. A repeat Enter (repeat: true) does nothing.", async () => {
      render(<POSScreen {...defaultProps} />);

      // Enter with an empty cart does nothing
      fireEvent.keyDown(window, { key: "Enter" });
      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(submitOrderV2).not.toHaveBeenCalled();

      // Add line to cart
      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // A repeat Enter (repeat: true) does nothing
      fireEvent.keyDown(window, { key: "Enter", repeat: true });
      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(submitOrderV2).not.toHaveBeenCalled();

      // Enter with lines opens the step
      fireEvent.keyDown(window, { key: "Enter" });
      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tiền mặt" }));
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("holding Enter does not pay cash: auto-repeat keydown on focused Tiền mặt has defaultPrevented=true and does not call submitOrderV2", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Open method step
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      const cashBtn = screen.getByRole("button", { name: "Tiền mặt" });
      expect(cashBtn).toBeInTheDocument();
      cashBtn.focus();
      expect(document.activeElement).toBe(cashBtn);

      // Dispatch a keydown Enter with repeat: true on it
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        repeat: true,
        bubbles: true,
        cancelable: true,
      });
      cashBtn.dispatchEvent(enterEvent);

      expect(enterEvent.defaultPrevented).toBe(true);
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("a deliberate second Enter (repeat: false) on focused Tiền mặt does not prevent default", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Open method step
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      const cashBtn = screen.getByRole("button", { name: "Tiền mặt" });
      cashBtn.focus();
      expect(document.activeElement).toBe(cashBtn);

      // Deliberate keydown Enter with repeat: false
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        repeat: false,
        bubbles: true,
        cancelable: true,
      });
      cashBtn.dispatchEvent(enterEvent);

      expect(enterEvent.defaultPrevented).toBe(false);
    });

    it("two quick clicks on Tiền mặt call submitOrderV2 once", async () => {
      let resolveSubmit: (val: any) => void;
      vi.mocked(submitOrderV2).mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve; }) as any
      );

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      const cashBtn = screen.getByRole("button", { name: "Tiền mặt" });

      // Two quick clicks on Tiền mặt
      fireEvent.click(cashBtn);
      fireEvent.click(cashBtn);

      expect(submitOrderV2).toHaveBeenCalledTimes(1);

      resolveSubmit!({ success: true });
    });

    it("two quick clicks on Chuyển khoản call submitOrderV2 once", async () => {
      let resolveSubmit: (val: any) => void;
      vi.mocked(submitOrderV2).mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve; }) as any
      );

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      const transferBtn = screen.getByRole("button", { name: "Chuyển khoản" });

      // Two quick clicks on Chuyển khoản
      fireEvent.click(transferBtn);
      fireEvent.click(transferBtn);

      expect(submitOrderV2).toHaveBeenCalledTimes(1);

      resolveSubmit!({ success: true });
    });

    it("sending empties the cart and closes the step", async () => {
      let resolveSubmit: (val: any) => void;
      vi.mocked(submitOrderV2).mockImplementationOnce(
        () => new Promise((resolve) => { resolveSubmit = resolve; }) as any
      );

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Open method step
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();

      // Click Tiền mặt to start sending
      fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));

      // Sending empties the cart and closes the step
      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Bạc xỉu", level: 4 })).toBeNull();

      resolveSubmit!({ success: true });
    });

    it("adding a dish while the step is open closes it", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Open method step
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();

      // Add second dish
      clickProduct("Đường đen sữa tươi");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Adding a dish while the step is open closes it
      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(screen.getByRole("button", { name: "Thanh toán" })).toBeInTheDocument();
    });

    it("Esc on the payment step closes it, keeps the cart and sends nothing", async () => {
      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      fireEvent.keyDown(window, { key: "Enter" });

      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
      expect(screen.getByRole("heading", { name: "Bạc xỉu", level: 4 })).toBeInTheDocument();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });
  });

  describe("G-MB fix 4: One failed order, lives in the cart", () => {
    it("while submitOrderV2 is pending, clicking a product card adds nothing to the cart", async () => {
      let resolveFirstCall: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });
      vi.mocked(submitOrderV2).mockImplementationOnce(() => pendingPromise as any);

      render(<POSScreen {...defaultProps} />);

      // Add Bạc xỉu to cart
      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Checkout
      startCashCheckout();

      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });

      // Cart is empty while checking out
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      // Click product card while checkout is pending
      clickProduct("Đường đen sữa tươi");

      // Product modal does not open and nothing is added to cart
      expect(screen.queryByRole("button", { name: /^Thêm vào đơn/ })).toBeNull();
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      resolveFirstCall!({ success: true });
      await waitFor(() => {
        expect(screen.getByText("Thanh toán thành công")).toBeInTheDocument();
      });
    });

    it("thrown failure puts the line back into the cart panel with its manual discount", async () => {
      vi.mocked(submitOrderV2).mockRejectedValueOnce(new Error("Network exploded"));

      render(<POSScreen {...defaultProps} />);

      // Add Bạc xỉu with manual discount
      clickProduct("Bạc xỉu");
      const discountInput = screen.getByLabelText("Giảm giá sản phẩm");
      fireEvent.change(discountInput, { target: { value: "5000" } });
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Set manual order discount: 3,000
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const orderDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(orderDiscountInput, { target: { value: "3000" } });

      // Pay with cash
      startCashCheckout();

      await waitFor(() => {
        expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại")[0]).toBeInTheDocument();
      });

      // The line is back in the cart panel (level-4 heading)
      const lineHeading = screen.getByRole("heading", { name: "Bạc xỉu", level: 4 });
      expect(lineHeading).toBeInTheDocument();

      // Manual discount badge is preserved in the cart row
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText(/Thu ngân/i)).toBeInTheDocument();
      expect(within(cartRow).getByText(/5,000/i)).toBeInTheDocument();

      // Order discount is preserved
      expect((screen.getByLabelText("Giảm giá tùy chỉnh") as HTMLInputElement).value).toBe("3,000");
    });

    it("retry:true strip Gửi lại resends with same token and client_captured_at; success resets all so next cart has no discount", async () => {
      vi.mocked(submitOrderV2)
        .mockResolvedValueOnce({ success: false, retry: true, error: "Network timeout" } as any)
        .mockResolvedValueOnce({ success: true } as any);

      const samplePromo = {
        id: "PROMO-1",
        code: "SALE10",
        name: "Giảm 10k",
        status: "ACTIVE",
        start_date: "2020-01-01",
        type: "ORDER_DISCOUNT",
        discount_amount: 10000,
        brand_id: "BR-1",
      };

      render(<POSScreen {...defaultProps} promotions={[samplePromo]} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Apply promo code: SALE10
      fireEvent.click(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i }));
      const promoInput = screen.getByLabelText("Mã giảm giá");
      fireEvent.change(promoInput, { target: { value: "SALE10" } });
      fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
      expect(screen.getByText("Mã: SALE10")).toBeInTheDocument();

      // Set manual order discount: 5,000
      const orderDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(orderDiscountInput, { target: { value: "5000" } });

      // Checkout
      startCashCheckout();

      // First call failed
      await waitFor(() => {
        expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại")[0]).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i })).toHaveAttribute("aria-expanded", "true");
      expect(submitOrderV2).toHaveBeenCalledTimes(1);

      const firstCallArgs = vi.mocked(submitOrderV2).mock.calls[0];
      const firstPayload = firstCallArgs[0];
      const firstToken = firstCallArgs[1];

      // Click the STRIP button
      const stripResendBtn = screen.getByRole("button", { name: "Gửi lại" });
      fireEvent.click(stripResendBtn);

      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(2);
      });

      const secondCallArgs = vi.mocked(submitOrderV2).mock.calls[1];
      const secondPayload = secondCallArgs[0];
      const secondToken = secondCallArgs[1];

      expect(secondToken).toBe(firstToken);
      expect(secondPayload.client_captured_at).toBe(firstPayload.client_captured_at);

      // Success clears cart
      await waitFor(() => {
        expect(screen.queryByRole("heading", { level: 4 })).toBeNull();
      });

      // Next cart: add Đường đen sữa tươi
      clickProduct("Đường đen sữa tươi");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Check that next cart has no discount applied and no promo code carried over;
      // the promo disclosure starts closed on a new order
      const disclosure = screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i });
      expect(disclosure).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(disclosure);
      const newOrderDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh") as HTMLInputElement;
      expect(newOrderDiscountInput.value).toBe("");
      expect(screen.queryByText("Giảm giá Hoá đơn")).toBeNull();
      expect(screen.queryByText(/Mã: SALE10/)).toBeNull();
      expect((screen.getByLabelText("Mã giảm giá") as HTMLInputElement).value).toBe("");
    });

    it("retry:false shows server text in strip, no Gửi lại/Thử lại button in strip, no toast button", async () => {
      const REFUSAL_TEXT = "Món Bạc xỉu đã hết hàng";
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: false,
        error: REFUSAL_TEXT,
      } as any);

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getAllByText(REFUSAL_TEXT)[0]).toBeInTheDocument();
      });

      // Cart line is back in cart panel
      expect(screen.getByRole("heading", { name: "Bạc xỉu", level: 4 })).toBeInTheDocument();

      // No Gửi lại or Thử lại button anywhere
      expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    });

    it("two quick clicks on strip Gửi lại calls submitOrderV2 once more, not twice", async () => {
      let resolveSecondCall: (value: any) => void;
      const secondCallPromise = new Promise((resolve) => {
        resolveSecondCall = resolve;
      });

      vi.mocked(submitOrderV2)
        .mockResolvedValueOnce({ success: false, retry: true, error: "Network timeout" } as any)
        .mockImplementationOnce(() => secondCallPromise as any);

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại")[0]).toBeInTheDocument();
      });
      expect(submitOrderV2).toHaveBeenCalledTimes(1);

      const resendBtn = screen.getByRole("button", { name: "Gửi lại" });
      // Two quick clicks
      fireEvent.click(resendBtn);
      fireEvent.click(resendBtn);

      expect(submitOrderV2).toHaveBeenCalledTimes(2);

      resolveSecondCall!({ success: true });
      await waitFor(() => {
        expect(screen.getByText("Thanh toán thành công")).toBeInTheDocument();
      });
    });
  });

  describe("Item 3: No raw English error in front of cashier (BR-UI-001)", () => {
    it("shows Vietnamese message on thrown network error or retry:true, never raw error", async () => {
      vi.mocked(submitOrderV2).mockRejectedValueOnce(new Error("Failed to fetch"));

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại").length).toBeGreaterThan(0);
      });
      expect(screen.queryByText("Failed to fetch")).toBeNull();
    });

    it("keeps showing server's Vietnamese error text on retry:false refusal", async () => {
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: false,
        error: "Món Bạc xỉu đã hết hàng",
      } as any);

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getAllByText("Món Bạc xỉu đã hết hàng").length).toBeGreaterThan(0);
      });
      expect(screen.queryByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại")).toBeNull();
    });
  });

  describe("Item 10: Search vs tabs highlighting", () => {
    it("highlights no tab while search box has text even when dish is outside active tab", () => {
      render(<POSScreen {...defaultProps} />);

      // Active tab starts at BEST_SELLERS
      const bestSellersBtn = screen.getByRole("button", { name: "Bán chạy" });
      expect(bestSellersBtn.className).toContain("bg-primary");

      // Search for "Trà đào" (which is in CAT-2, not in CAT-1 or active tab)
      const searchInput = screen.getByPlaceholderText("Ví dụ: Trà đào");
      fireEvent.change(searchInput, { target: { value: "tra dao" } });

      // Trà đào is visible
      expect(screen.getAllByText("Trà đào")[0]).toBeInTheDocument();

      // No tab should be highlighted with bg-primary
      expect(screen.getByRole("button", { name: "Bán chạy" }).className).not.toContain("bg-primary");
      expect(screen.getByRole("button", { name: "Tất cả món" }).className).not.toContain("bg-primary");
      expect(screen.getByRole("button", { name: "☕ Cà phê" }).className).not.toContain("bg-primary");
      expect(screen.getByRole("button", { name: "🍵 Trà" }).className).not.toContain("bg-primary");
    });
  });

  describe("G-MB fix 5: Last gaps after fix 4", () => {
    it("strip shown after a retry:true failure disappears when clicking Xoá hết (no Gửi lại button)", async () => {
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: true,
        error: "Network timeout",
      } as any);

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      // Click "Xoá hết"
      const clearAllBtn = screen.getByRole("button", { name: "Xoá hết" });
      fireEvent.click(clearAllBtn);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
      });
    });

    it("strip shown after a retry:true failure disappears when saving draft (no Gửi lại button)", async () => {
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: true,
        error: "Network timeout",
      } as any);
      vi.mocked(savePOSDraft).mockResolvedValueOnce({
        success: true,
        draft: { id: "draft-new", name: "Draft", cart_json: "[]" },
      } as any);

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      // Click "Lưu nháp"
      const saveDraftBtn = screen.getByRole("button", { name: "Lưu nháp" });
      fireEvent.click(saveDraftBtn);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
      });
    });

    it("after a failed send ('Gửi lại' strip shown), adding a dish through the picker removes the strip", async () => {
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: true,
        error: "Network timeout",
      } as any);

      render(<POSScreen {...defaultProps} />);

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      // Adding a dish through the picker removes the strip
      clickProduct("Đường đen sữa tươi");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
      });
    });

    it("while a send is pending, opening a dish adds nothing, and after the send fails the cart equals the frozen cart", async () => {
      let rejectSubmit: (err: any) => void;
      const pendingPromise = new Promise((_, reject) => {
        rejectSubmit = reject;
      });
      vi.mocked(submitOrderV2).mockImplementationOnce(() => pendingPromise as any);

      render(<POSScreen {...defaultProps} />);

      // Add initial dish (frozen cart)
      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });

      // While send is pending, cart is cleared in UI
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      // Opening a dish adds nothing (and picker does not open while pending)
      clickProduct("Đường đen sữa tươi");
      expect(screen.queryByRole("button", { name: /^Thêm vào đơn/ })).toBeNull();
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      // Send fails
      rejectSubmit!(new Error("Network failed"));

      await waitFor(() => {
        expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại")[0]).toBeInTheDocument();
      });

      // Cart equals the frozen cart: only Bạc xỉu
      expect(screen.getByRole("heading", { name: "Bạc xỉu", level: 4 })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Đường đen sữa tươi", level: 4 })).toBeNull();
      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
    });

    it("focus on a button does not block Escape closing modal or '+' opening cart", () => {
      render(<POSScreen {...defaultProps} />);

      const productBtn = screen.getAllByText("Bạc xỉu")[0].closest("button")!;
      productBtn.focus();
      expect(document.activeElement).toBe(productBtn);

      // Open ItemPicker
      fireEvent.click(productBtn);
      expect(screen.getByRole("button", { name: /^Thêm vào đơn/ })).toBeInTheDocument();

      // Ensure focus is on a button
      productBtn.focus();

      // Press Escape -> item modal closes
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("button", { name: /^Thêm vào đơn/ })).toBeNull();

      // Focus a button again
      productBtn.focus();
      expect(document.activeElement).toBe(productBtn);

      // Before pressing '+', the phone cart sheet is closed
      const cartContainer = () => screen.getByRole("heading", { name: /Hoá đơn/i }).closest("div.fixed")!;
      expect(cartContainer().className).toContain("translate-y-full");

      // Press '+' -> cart opens (phone)
      fireEvent.keyDown(window, { key: "+" });
      expect(cartContainer().className).toContain("translate-y-0");
      expect(cartContainer().className).not.toContain("translate-y-full");
    });
  });

  // one-tap size buttons removed by BR-SALE-019
  describe("Task 3a: Quick add and product card", () => {
    const egg = { id: "P5", name: "Trứng luộc", category_id: "CAT-1", status: "ACTIVE" };
    const eggVariant = { id: "V5", product_id: "P5", size_name: "1 trái", price: 5000 };

    it("tapping the dish name opens the dish window", () => {
      render(<POSScreen {...defaultProps} />);

      const dishBtn = screen.getAllByRole("button", { name: "Cà phê đen" })[0];
      fireEvent.click(dishBtn);

      expect(screen.getByRole("button", { name: /^Thêm vào đơn/ })).toBeInTheDocument();
      // No cart line yet: the picker's own heading is the only h3/h4.
      expect(screen.queryByRole("heading", { level: 4, name: "Cà phê đen" })).toBeNull();
    });

    it("one tap on Trứng luộc puts one line in the cart and opens no window", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      expect(screen.queryByRole("button", { name: /^Thêm vào đơn/ })).toBeNull();
      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      expect(lineHeading).toBeInTheDocument();
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("1")).toBeInTheDocument();
      expect(within(cartRow).getByText("5,000")).toBeInTheDocument();
    });

    it("a second tap gives the same single line with quantity 2", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);
      fireEvent.click(dishBtn);

      expect(screen.getAllByRole("heading", { level: 4, name: "Trứng luộc" })).toHaveLength(1);
      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("2")).toBeInTheDocument();
      expect(within(cartRow).getByText("10,000")).toBeInTheDocument();
    });

    it("tapping that cart line opens the window", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      fireEvent.click(lineHeading);

      expect(screen.getByRole("button", { name: /^Cập nhật/ })).toBeInTheDocument();
    });

    it("a one-size dish with an option group linked still opens the window", () => {
      const defaultOptionGroup = {
        id: "MG-1",
        name: "Topping",
        selection_mode: "MANY" as const,
        max_total: null,
        allow_standalone: true,
        sort_order: 1,
        status: "ACTIVE",
      };
      const eggModifier = { id: "M1", group_id: "MG-1", name: "Hành phi", price: 2000, status: "ACTIVE" };

      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          optionGroups={[defaultOptionGroup]}
          optionGroupLinks={[{ group_id: "MG-1", product_id: egg.id }]}
          modifiers={[eggModifier]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      expect(screen.getByRole("button", { name: /^Thêm vào đơn/ })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 4, name: "Trứng luộc" })).toBeNull();
    });

    it("a two-size dish still opens the window", () => {
      const twoSizeVariants = [
        { id: "V5-1", product_id: "P5", size_name: "1 trái", price: 5000 },
        { id: "V5-2", product_id: "P5", size_name: "2 trái", price: 10000 },
      ];

      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, ...twoSizeVariants]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      expect(screen.getByRole("button", { name: /^Thêm vào đơn/ })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 4, name: "Trứng luộc" })).toBeNull();
    });

    it("with the egg's cart line open in the window, a tap on the egg card makes the window show quantity 2, and Cập nhật keeps 2", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      fireEvent.click(lineHeading);

      expect(screen.getByRole("button", { name: /^Cập nhật/ })).toBeInTheDocument();

      fireEvent.click(dishBtn);

      const updateBtn = screen.getByRole("button", { name: /^Cập nhật/ });
      expect(updateBtn.textContent).toContain("10,000");
      fireEvent.click(updateBtn);

      expect(screen.getAllByRole("heading", { level: 4, name: "Trứng luộc" })).toHaveLength(1);
      const updatedHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      const cartRow = updatedHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("2")).toBeInTheDocument();
      expect(within(cartRow).getByText("10,000")).toBeInTheDocument();
    });

    it("with a cart line open in the window, pressing + on that cart row makes the window show the new quantity, and Cập nhật keeps it", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      fireEvent.click(lineHeading);

      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      const increaseBtn = within(cartRow).getByRole("button", { name: "Tăng số lượng" });
      fireEvent.click(increaseBtn);

      const updateBtn = screen.getByRole("button", { name: /^Cập nhật/ });
      expect(updateBtn.textContent).toContain("10,000");
      fireEvent.click(updateBtn);

      expect(screen.getAllByRole("heading", { level: 4, name: "Trứng luộc" })).toHaveLength(1);
      const updatedHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      const updatedCartRow = updatedHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(updatedCartRow).getByText("2")).toBeInTheDocument();
      expect(within(updatedCartRow).getByText("10,000")).toBeInTheDocument();
    });

    it("after a one-tap add, Enter opens the payment step instead of tapping the dish again", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      dishBtn.focus();
      fireEvent.click(dishBtn);

      fireEvent.keyDown(window, { key: "Enter" });

      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();
      expect(screen.getAllByRole("heading", { level: 4, name: "Trứng luộc" })).toHaveLength(1);
      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("1")).toBeInTheDocument();
    });

    it("a one-tap add while the search box has focus leaves the search box focused", () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const searchInput = screen.getByPlaceholderText("Ví dụ: Trà đào");
      searchInput.focus();

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      expect(document.activeElement).toBe(searchInput);
      expect(screen.getAllByRole("heading", { level: 4, name: "Trứng luộc" })).toHaveLength(1);
      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("1")).toBeInTheDocument();
    });

    it("a one-size dish whose linked option group has no option in use goes in on one tap", () => {
      const defaultOptionGroup = {
        id: "MG-1",
        name: "Topping",
        selection_mode: "MANY" as const,
        max_total: null,
        allow_standalone: true,
        sort_order: 1,
        status: "ACTIVE",
      };
      const eggModifier = { id: "M1", group_id: "MG-1", name: "Hành phi", price: 2000, status: "INACTIVE" };

      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          optionGroups={[defaultOptionGroup]}
          optionGroupLinks={[{ group_id: "MG-1", product_id: egg.id }]}
          modifiers={[eggModifier]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      expect(screen.queryByRole("button", { name: /^Thêm vào đơn/ })).toBeNull();
      expect(screen.getAllByRole("heading", { level: 4, name: "Trứng luộc" })).toHaveLength(1);
      const lineHeading = screen.getByRole("heading", { level: 4, name: "Trứng luộc" });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("1")).toBeInTheDocument();
    });

    it("after a failed send ('Gửi lại' strip shown), one tap on the egg removes the strip", async () => {
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: true,
        error: "Network timeout",
      } as any);

      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      startCashCheckout();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
      });
    });

    it("a one tap on the egg while the payment step is open closes the step", async () => {
      render(
        <POSScreen
          {...defaultProps}
          products={[...defaultProps.products, egg]}
          variants={[...sampleVariants, eggVariant]}
          bestSellers={[...defaultProps.bestSellers, "P5"]}
        />
      );

      clickProduct("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      // Open method step
      fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
      expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();

      const dishBtn = screen.getAllByRole("button", { name: "Trứng luộc" })[0];
      fireEvent.click(dishBtn);

      expect(screen.queryByRole("heading", { name: "Khách trả bằng gì?" })).toBeNull();
    });
  });

  describe("Task 3b: Header, cart column, and notices", () => {
    it("with nothing applied, the disclosure is closed and the promo-code box is not in the page", () => {
      render(<POSScreen {...defaultProps} />);

      clickProductButton("Cà phê đen");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      const disclosureBtn = screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i });
      expect(disclosureBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText("Mã giảm giá")).toBeNull();
    });

    it("with an applied promo code, the disclosure is open", () => {
      const samplePromo = {
        id: "PROMO-1",
        code: "SALE10",
        name: "Giảm 10k",
        status: "ACTIVE",
        start_date: "2020-01-01",
        type: "ORDER_DISCOUNT",
        discount_amount: 10000,
        brand_id: "BR-1",
      };

      render(<POSScreen {...defaultProps} promotions={[samplePromo]} />);

      clickProductButton("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

      const disclosureBtn = screen.getByRole("button", { name: /Khuyến mãi, giảm giá/i });
      fireEvent.click(disclosureBtn);

      fireEvent.change(screen.getByLabelText("Mã giảm giá"), { target: { value: "SALE10" } });
      fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

      expect(disclosureBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Mã giảm giá")).toBeInTheDocument();
      expect(screen.getByText("Mã: SALE10")).toBeInTheDocument();
    });

    it("an error notice survives four later success notices", async () => {
      vi.mocked(submitOrderV2)
        .mockResolvedValueOnce({ success: false, retry: true, error: "Network timeout" } as any)
        .mockResolvedValue({ success: true } as any);

      render(<POSScreen {...defaultProps} />);

      // 1st checkout fails -> adds 1 error notice
      clickProductButton("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));
      startCashCheckout();

      const region = screen.getByRole("region", { name: "Thông báo" });
      await waitFor(() => {
        expect(within(region).getByText("Chưa gửi được đơn")).toBeInTheDocument();
      });

      // 4 later successful checkouts -> 4 success notices added, capped at 3 non-error notices
      for (let i = 0; i < 4; i++) {
        clickProductButton("Cà phê đen");
        fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));
        startCashCheckout();
        await waitFor(() => {
          expect(submitOrderV2).toHaveBeenCalledTimes(i + 2);
        });
      }

      // Error notice is never dropped; at most 3 non-error notices remain
      await waitFor(() => {
        expect(within(region).getByText("Chưa gửi được đơn")).toBeInTheDocument();
        expect(within(region).getAllByText("Thanh toán thành công")).toHaveLength(3);
      });
    });

    it("draft-save failure shows an error notice, not a dialog", async () => {
      vi.mocked(savePOSDraft).mockResolvedValueOnce({
        success: false,
        error: "Không kết nối được cơ sở dữ liệu",
      } as any);

      render(<POSScreen {...defaultProps} />);

      clickProductButton("Bạc xỉu");
      fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));
      fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));

      const region = screen.getByRole("region", { name: "Thông báo" });
      await waitFor(() => {
        expect(
          within(region).getByText("Lỗi lưu đơn nháp: Không kết nối được cơ sở dữ liệu")
        ).toBeInTheDocument();
      });
      expect(alert).not.toHaveBeenCalled();
    });

    it("a dish with no size shows a warning notice, not a dialog", () => {
      const noSizeProduct = { id: "P-NOSIZE", name: "Món chưa có giá", category_id: "CAT-1", status: "ACTIVE" };
      render(
        <POSScreen
          {...defaultProps}
          products={[...sampleProducts, noSizeProduct]}
          bestSellers={[...defaultProps.bestSellers, "P-NOSIZE"]}
        />
      );

      clickProductButton("Món chưa có giá");

      const region = screen.getByRole("region", { name: "Thông báo" });
      expect(within(region).getByText("Món này chưa cấu hình size & giá.")).toBeInTheDocument();
      expect(alert).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /^Thêm vào đơn/ })).toBeNull();
    });

    it("renders 'Đơn mới' with correct capitalization in the header", () => {
      render(<POSScreen {...defaultProps} />);
      expect(screen.getByText("Đơn mới")).toBeInTheDocument();
    });

    it("passes sizeLabel 'Cỡ' to ItemPicker when product category has is_drink === false", () => {
      const foodCategory = { id: "CAT-FOOD", name: "Đồ ăn", is_drink: false };
      const foodProduct = { id: "P-FOOD", name: "Trứng luộc", category_id: "CAT-FOOD", status: "ACTIVE" };
      const foodVariant = { id: "V-FOOD", product_id: "P-FOOD", size_name: "1 quả", price: 10000 };
      const foodVariant2 = { id: "V-FOOD-2", product_id: "P-FOOD", size_name: "2 quả", price: 20000 };

      render(
        <POSScreen
          {...defaultProps}
          categories={[...sampleCategories, foodCategory]}
          products={[...sampleProducts, foodProduct]}
          variants={[...sampleVariants, foodVariant, foodVariant2]}
          bestSellers={[...defaultProps.bestSellers, "P-FOOD"]}
        />
      );

      clickProduct("Trứng luộc");

      expect(screen.getByText("Cỡ")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Cỡ" })).toBeInTheDocument();
      expect(screen.queryByText("Cỡ ly")).toBeNull();
    });
  });
});


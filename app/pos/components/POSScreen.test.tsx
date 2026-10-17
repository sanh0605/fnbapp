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
import { confirm } from "@/lib/shared/dialog";
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
    { id: "V2", product_id: "P2", size_name: "M", price: 35000 },
    { id: "V3", product_id: "P3", size_name: "M", price: 30000 },
    { id: "V4", product_id: "P4", size_name: "M", price: 25000 },
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

  describe("R5: Search without accents", () => {
    it("typing 'bac xiu' finds 'Bạc xỉu'", () => {
      render(<POSScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Ví dụ: Trà đào");
      fireEvent.change(searchInput, { target: { value: "bac xiu" } });

      expect(screen.getByText("Bạc xỉu")).toBeInTheDocument();
      expect(screen.queryByText("Đường đen sữa tươi")).toBeNull();
      expect(screen.queryByText("Trà đào")).toBeNull();
    });

    it("typing 'DUONG' finds 'Đường đen sữa tươi'", () => {
      render(<POSScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Ví dụ: Trà đào");
      fireEvent.change(searchInput, { target: { value: "DUONG" } });

      expect(screen.getByText("Đường đen sữa tươi")).toBeInTheDocument();
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
      const productCard = screen.getByText("Bạc xỉu");
      fireEvent.click(productCard);

      const addBtn = screen.getByRole("button", { name: /^THÊM -/ });
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

  describe("Enter key cash flow (BR-SALE-018)", () => {
    it("pressing Enter twice quickly sends one order", async () => {
      render(<POSScreen {...defaultProps} />);

      // Add item to cart
      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });
      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });
    });

    it("Enter while sending sends nothing", async () => {
      let resolveSubmit: (val: any) => void;
      vi.mocked(submitOrderV2).mockImplementationOnce(
        () => new Promise((resolve) => { resolveSubmit = resolve; }) as any
      );

      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      // First Enter: starts checkout
      fireEvent.keyDown(window, { key: "Enter" });
      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });

      // Second Enter while sending: does not even ask
      fireEvent.keyDown(window, { key: "Enter" });
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(submitOrderV2).toHaveBeenCalledTimes(1);

      resolveSubmit!({ success: true });
    });

    it("Enter while offline sends nothing", async () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent(window, new Event("offline"));

      fireEvent.keyDown(window, { key: "Enter" });
      expect(confirm).not.toHaveBeenCalled();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("Enter with confirm resolving false sends nothing", async () => {
      vi.mocked(confirm).mockResolvedValueOnce(false);

      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("Enter while the item modal is open (a product card clicked so ItemConfigModal shows) sends nothing and does not call confirm", () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.click(screen.getByText("Đường đen sữa tươi"));
      expect(screen.getByRole("button", { name: /^THÊM -/ })).toBeInTheDocument();

      (document.activeElement as HTMLElement)?.blur?.();

      fireEvent.keyDown(window, { key: "Enter" });

      expect(confirm).not.toHaveBeenCalled();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });
  });

  describe("Item 1: Enter sends exactly once, blank cart sends nothing", () => {
    it("firing Enter calls submitOrderV2 exactly once", async () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });
    });

    it("Enter on blank cart sends nothing", async () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.keyDown(window, { key: "Enter" });

      expect(confirm).not.toHaveBeenCalled();
      expect(submitOrderV2).not.toHaveBeenCalled();
    });

    it("Enter with focus on a button does not send order", async () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      const draftBtn = screen.getByRole("button", { name: "Lưu Nháp" });
      draftBtn.focus();
      expect(document.activeElement).toBe(draftBtn);

      fireEvent.keyDown(window, { key: "Enter" });

      expect(confirm).not.toHaveBeenCalled();
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
      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      // Checkout
      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });

      // Cart is empty while checking out
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      // Click product card while checkout is pending
      fireEvent.click(screen.getByText("Đường đen sữa tươi"));

      // Product modal does not open and nothing is added to cart
      expect(screen.queryByRole("button", { name: /^THÊM -/ })).toBeNull();
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      resolveFirstCall!({ success: true });
      await waitFor(() => {
        expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
      });
    });

    it("thrown failure puts the line back into the cart panel with its manual discount", async () => {
      vi.mocked(submitOrderV2).mockRejectedValueOnce(new Error("Network exploded"));

      render(<POSScreen {...defaultProps} />);

      // Add Bạc xỉu with manual discount
      fireEvent.click(screen.getByText("Bạc xỉu"));
      const discountInput = screen.getByLabelText("Giảm giá sản phẩm");
      fireEvent.change(discountInput, { target: { value: "5000" } });
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      // Set manual order discount: 3,000
      const orderDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(orderDiscountInput, { target: { value: "3000" } });

      // Pay with cash
      fireEvent.keyDown(window, { key: "Enter" });

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
      expect((screen.getByLabelText("Giảm giá tùy chỉnh") as HTMLInputElement).value).toBe("3000");
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

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      // Apply promo code: SALE10
      const promoInput = screen.getByLabelText("Mã giảm giá");
      fireEvent.change(promoInput, { target: { value: "SALE10" } });
      fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
      expect(screen.getByText("Mã: SALE10")).toBeInTheDocument();

      // Set manual order discount: 5,000
      const orderDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
      fireEvent.change(orderDiscountInput, { target: { value: "5000" } });

      // Checkout
      fireEvent.keyDown(window, { key: "Enter" });

      // First call failed
      await waitFor(() => {
        expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại")[0]).toBeInTheDocument();
      });
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
      fireEvent.click(screen.getByText("Đường đen sữa tươi"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      // Check that next cart has no discount applied and no promo code carried over
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

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

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

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

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
        expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
      });
    });
  });

  describe("Item 3: No raw English error in front of cashier (BR-UI-001)", () => {
    it("shows Vietnamese message on thrown network error or retry:true, never raw error", async () => {
      vi.mocked(submitOrderV2).mockRejectedValueOnce(new Error("Failed to fetch"));

      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

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

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

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
      expect(screen.getByText("Trà đào")).toBeInTheDocument();

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

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

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

      fireEvent.click(screen.getByText("Bạc xỉu"));
      fireEvent.click(screen.getByRole("button", { name: /^THÊM -/ }));

      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      // Click "Lưu Nháp"
      const saveDraftBtn = screen.getByRole("button", { name: "Lưu Nháp" });
      fireEvent.click(saveDraftBtn);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
      });
    });

    it("focus on a button does not block Escape closing modal or '+' opening cart", () => {
      render(<POSScreen {...defaultProps} />);

      const productBtn = screen.getByText("Bạc xỉu").closest("button")!;
      productBtn.focus();
      expect(document.activeElement).toBe(productBtn);

      // Open item config modal
      fireEvent.click(productBtn);
      expect(screen.getByRole("button", { name: /^THÊM -/ })).toBeInTheDocument();

      // Ensure focus is on a button
      productBtn.focus();

      // Press Escape -> item modal closes
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("button", { name: /^THÊM -/ })).toBeNull();

      // Focus a button again
      productBtn.focus();
      expect(document.activeElement).toBe(productBtn);

      // Before pressing '+', the phone cart sheet is closed
      const cartContainer = () => screen.getByRole("heading", { name: /Hoá Đơn/i }).closest("div.fixed")!;
      expect(cartContainer().className).toContain("translate-y-full");

      // Press '+' -> cart opens (phone)
      fireEvent.keyDown(window, { key: "+" });
      expect(cartContainer().className).toContain("translate-y-0");
      expect(cartContainer().className).not.toContain("translate-y-full");
    });
  });

  describe("Task 3a: Quick add and product card", () => {
    it("tapping 'Thêm Cà phê đen M' adds one line of size M, quantity 1", () => {
      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Thêm Cà phê đen M" }));

      expect(screen.queryByRole("button", { name: /^THÊM -/ })).toBeNull();
      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
      const lineHeading = screen.getByRole("heading", { name: "Cà phê đen", level: 4 });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("Size M")).toBeInTheDocument();
      expect(within(cartRow).getByText("1")).toBeInTheDocument();
    });

    it("tapping 'Thêm Cà phê đen M' twice gives quantity 2", () => {
      render(<POSScreen {...defaultProps} />);

      const sizeBtn = screen.getByRole("button", { name: "Thêm Cà phê đen M" });
      fireEvent.click(sizeBtn);
      fireEvent.click(sizeBtn);

      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
      const lineHeading = screen.getByRole("heading", { name: "Cà phê đen", level: 4 });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("Size M")).toBeInTheDocument();
      expect(within(cartRow).getByText("2")).toBeInTheDocument();
    });

    it("while a send is pending, a size tap adds nothing, and after the send fails the cart equals the frozen cart", async () => {
      let resolveSubmit: (value: any) => void;
      vi.mocked(submitOrderV2).mockImplementationOnce(
        () => new Promise((resolve) => { resolveSubmit = resolve; }) as any
      );

      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Thêm Bạc xỉu M" }));

      fireEvent.keyDown(window, { key: "Enter" });
      await waitFor(() => {
        expect(submitOrderV2).toHaveBeenCalledTimes(1);
      });

      // Cart is empty while checking out; tapping a size button adds nothing
      fireEvent.click(screen.getByRole("button", { name: "Thêm Cà phê đen M" }));
      expect(screen.queryByRole("heading", { level: 4 })).toBeNull();

      resolveSubmit!({ success: false, retry: true, error: "Network timeout" });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      const headings = screen.getAllByRole("heading", { level: 4 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent("Bạc xỉu");
      expect(screen.queryByRole("heading", { name: "Cà phê đen", level: 4 })).toBeNull();
    });

    it("after a failed send, a size tap removes the 'Gửi lại' strip", async () => {
      vi.mocked(submitOrderV2).mockResolvedValueOnce({
        success: false,
        retry: true,
        error: "Network timeout",
      } as any);

      render(<POSScreen {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Thêm Bạc xỉu M" }));
      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Gửi lại" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Thêm Cà phê đen M" }));

      expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
    });

    it("after a size tap, Enter opens the cash confirm and the quantity stays 1", async () => {
      vi.mocked(confirm).mockResolvedValueOnce(false);

      render(<POSScreen {...defaultProps} />);

      const sizeBtn = screen.getByRole("button", { name: "Thêm Cà phê đen M" });
      sizeBtn.focus();
      fireEvent.click(sizeBtn);

      expect(document.activeElement).not.toBe(sizeBtn);

      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        expect(confirm).toHaveBeenCalledTimes(1);
      });

      const lineHeading = screen.getByRole("heading", { name: "Cà phê đen", level: 4 });
      const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
      expect(within(cartRow).getByText("1")).toBeInTheDocument();
    });

    it("tapping the dish name opens the dish window", () => {
      render(<POSScreen {...defaultProps} />);

      const dishBtn = screen.getByRole("button", { name: "Cà phê đen" });
      fireEvent.click(dishBtn);

      expect(screen.getByRole("button", { name: /^THÊM -/ })).toBeInTheDocument();
      // No cart line yet: the window's own "Chọn Size" heading is the only h4.
      expect(screen.queryByRole("heading", { level: 4, name: "Cà phê đen" })).toBeNull();
    });
  });
});

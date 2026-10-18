// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import POSScreen from "./POSScreen";
import { formatNumber } from "@/lib/shared/format";

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn().mockResolvedValue([]),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
}));

const CATEGORY = { id: "CAT1", name: "Cà phê" };
const PRODUCT = { id: "P1", name: "Cà phê đen", category_id: CATEGORY.id };
const VARIANTS = [
  { id: "V1", product_id: "P1", size_name: "M", price: 20000 },
  { id: "V1-L", product_id: "P1", size_name: "L", price: 30000 },
];

beforeEach(async () => {
  vi.clearAllMocks();
  const { submitOrderV2 } = await import("@/app/pos/actions");
  (submitOrderV2 as any).mockReset();
  Object.defineProperty(window.navigator, "onLine", {
    value: true,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
});

function clickProduct(name: string) {
  const el = screen.getAllByText(name)[0];
  if (!el) throw new Error(`product not found: ${name}`);
  fireEvent.click(el);
}

describe("POSScreen offline and retry behaviour (BR-SALE-015)", () => {
  it("offline: pay buttons are disabled, offline banner is shown, and Enter key sends nothing", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    const { submitOrderV2 } = await import("@/app/pos/actions");

    render(
      <POSScreen
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
        bestSellers={[PRODUCT.id]}
      />
    );

    // Banner indicates disconnection and no selling
    expect(
      screen.getByText("Mất kết nối — chưa bán được, kiểm tra mạng rồi bấm lại")
    ).toBeInTheDocument();

    // Add item to cart
    clickProduct("Cà phê đen");
    fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

    // Thanh toán button is disabled while offline (BR-SALE-020)
    const payBtn = screen.getByRole("button", { name: "Thanh toán" });
    expect(payBtn).toBeDisabled();

    // Enter key does nothing when offline
    fireEvent.keyDown(window, { key: "Enter" });
    expect(submitOrderV2).not.toHaveBeenCalled();
  });

  it("retry: true keeps cart and 'Gửi lại' resends with the same client_request_id and client_captured_at", async () => {
    const { submitOrderV2 } = await import("@/app/pos/actions");
    (submitOrderV2 as any)
      .mockResolvedValueOnce({ success: false, error: "Mất kết nối máy chủ", retry: true })
      .mockResolvedValueOnce({ success: true, order_id: "ord-1", order_no: "260825001001" });

    render(
      <POSScreen
        brandId="BR-1"
        outletId="OUT-1"
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
        bestSellers={[PRODUCT.id]}
      />
    );

    // Add item to cart
    clickProduct("Cà phê đen");
    fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

    // Checkout with cash (BR-SALE-020: Thanh toán then Tiền mặt)
    fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));

    // Wait for failure
    await waitFor(() => {
      expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Mất kết nối máy chủ")).toBeNull();
    expect(submitOrderV2).toHaveBeenCalledTimes(1);

    const firstPayload = (submitOrderV2 as any).mock.calls[0][0];
    const firstToken = (submitOrderV2 as any).mock.calls[0][1];
    expect(firstToken).toBeTruthy();
    expect(firstPayload.client_captured_at).toBeTruthy();

    // Cart is kept: product is still present
    const lineHeading = screen.getByRole("heading", { name: "Cà phê đen", level: 4 });
    expect(lineHeading).toBeInTheDocument();
    const cartRow = lineHeading.closest<HTMLElement>("div[class*='relative overflow-hidden']")!;
    expect(within(cartRow).getByText(formatNumber(20000))).toBeInTheDocument();

    // Shows "Gửi lại" action button
    const retryButton = screen.getByRole("button", { name: "Gửi lại" });
    expect(retryButton).toBeInTheDocument();

    // Click "Gửi lại"
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(submitOrderV2).toHaveBeenCalledTimes(2);
    });

    const secondPayload = (submitOrderV2 as any).mock.calls[1][0];
    const secondToken = (submitOrderV2 as any).mock.calls[1][1];

    // Resends with the SAME request token and captured time
    expect(secondToken).toBe(firstToken);
    expect(secondPayload.client_captured_at).toBe(firstPayload.client_captured_at);
  });

  it("call throws (network failure) keeps cart and 'Gửi lại' resends with the same client_request_id", async () => {
    const { submitOrderV2 } = await import("@/app/pos/actions");
    (submitOrderV2 as any)
      .mockRejectedValueOnce(new Error("Network connection dropped"))
      .mockResolvedValueOnce({ success: true, order_id: "ord-2", order_no: "260825001002" });

    render(
      <POSScreen
        brandId="BR-1"
        outletId="OUT-1"
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
        bestSellers={[PRODUCT.id]}
      />
    );

    // Add item to cart
    clickProduct("Cà phê đen");
    fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

    // Checkout with cash (BR-SALE-020: Thanh toán then Tiền mặt)
    fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));

    // Wait for error
    await waitFor(() => {
      expect(screen.getAllByText("Chưa gửi được đơn — kiểm tra mạng rồi bấm Gửi lại").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Network connection dropped")).toBeNull();
    expect(submitOrderV2).toHaveBeenCalledTimes(1);

    const firstToken = (submitOrderV2 as any).mock.calls[0][1];

    // Cart is kept
    expect(screen.getByRole("heading", { name: "Cà phê đen", level: 4 })).toBeInTheDocument();

    // "Gửi lại" button is offered
    const retryButton = screen.getByRole("button", { name: "Gửi lại" });
    expect(retryButton).toBeInTheDocument();

    // Click "Gửi lại"
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(submitOrderV2).toHaveBeenCalledTimes(2);
    });

    const secondToken = (submitOrderV2 as any).mock.calls[1][1];
    expect(secondToken).toBe(firstToken);
  });

  it("retry: false follows refusal path with server text and no retry button", async () => {
    const { submitOrderV2 } = await import("@/app/pos/actions");
    const REFUSED = "Giá hoặc khuyến mãi đã thay đổi. Tải lại trang rồi bấm lại.";
    (submitOrderV2 as any).mockResolvedValueOnce({
      success: false,
      error: REFUSED,
      retry: false,
    });

    render(
      <POSScreen
        brandId="BR-1"
        outletId="OUT-1"
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
        bestSellers={[PRODUCT.id]}
      />
    );

    // Add item to cart
    clickProduct("Cà phê đen");
    fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

    // Checkout with cash (BR-SALE-020: Thanh toán then Tiền mặt)
    fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiền mặt" }));

    // Wait for refusal error
    await waitFor(() => {
      expect(screen.getAllByText(REFUSED).length).toBeGreaterThan(0);
    });

    // Cart is kept
    expect(screen.getByRole("heading", { name: "Cà phê đen", level: 4 })).toBeInTheDocument();

    // Refusal shows no "Gửi lại" or "Thử lại" button
    expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("cart has a line, open the step, go offline: Tiền mặt, Chuyển khoản and Chia tiền mặt + chuyển khoản are disabled", async () => {
    render(
      <POSScreen
        brandId="BR-1"
        outletId="OUT-1"
        categories={[CATEGORY]}
        products={[PRODUCT]}
        variants={VARIANTS}
        modifiers={[]}
        bestSellers={[PRODUCT.id]}
      />
    );

    // Cart has a line
    clickProduct("Cà phê đen");
    fireEvent.click(screen.getByRole("button", { name: /^Thêm vào đơn/ }));

    // Open the step
    fireEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    expect(screen.getByRole("heading", { name: "Khách trả bằng gì?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiền mặt" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Chuyển khoản" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Chia tiền mặt + chuyển khoản" })).not.toBeDisabled();

    // Go offline the way the offline tests simulate it
    fireEvent(window, new Event("offline"));

    // Tiền mặt, Chuyển khoản and the split button are disabled
    expect(screen.getByRole("button", { name: "Tiền mặt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chuyển khoản" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chia tiền mặt + chuyển khoản" })).toBeDisabled();
  });
});

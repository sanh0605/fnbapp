import { describe, expect, it, vi } from "vitest";
import {
  resolvePosCheckoutAttempt,
  summarizePosCheckoutRequestIds,
} from "./pos-checkout-idempotency";

const baseCheckout = {
  brand_id: "BR-001",
  items: [{
    product_id: "PROD-001",
    variant_id: "VAR-001",
    qty: 1,
    modifiers: [],
    manual_item_discount: { value: 0, type: "VND" as const },
  }],
  payment_method: "CASH" as const,
  manual_order_discount: null,
  applied_promotion_id: null,
  actor: { id: "", name: "" },
};

describe("resolvePosCheckoutAttempt", () => {
  it("creates one request token for a new checkout payload", () => {
    const createToken = vi.fn(() => "request-1");

    expect(resolvePosCheckoutAttempt(null, baseCheckout, createToken)).toEqual({
      requestToken: "request-1",
      requestFingerprint: expect.any(String),
    });
    expect(createToken).toHaveBeenCalledOnce();
  });

  it("reuses the token when the cashier retries the same payload", () => {
    const createToken = vi.fn(() => "request-2");
    const first = resolvePosCheckoutAttempt(null, baseCheckout, () => "request-1");
    const retry = resolvePosCheckoutAttempt(
      first,
      structuredClone(baseCheckout),
      createToken,
    );

    expect(retry).toEqual(first);
    expect(createToken).not.toHaveBeenCalled();
  });

  it("creates a new token after a cart or payment change", () => {
    const first = resolvePosCheckoutAttempt(null, baseCheckout, () => "request-1");
    const changedCart = resolvePosCheckoutAttempt(
      first,
      {
        ...baseCheckout,
        items: [{ ...baseCheckout.items[0], qty: 2 }],
      },
      () => "request-2",
    );
    const changedPayment = resolvePosCheckoutAttempt(
      changedCart,
      { ...baseCheckout, payment_method: "BANK_TRANSFER" },
      () => "request-3",
    );

    expect(changedCart.requestToken).toBe("request-2");
    expect(changedPayment.requestToken).toBe("request-3");
  });
});

describe("summarizePosCheckoutRequestIds", () => {
  it("separates legacy orders and reports duplicate request keys", () => {
    expect(summarizePosCheckoutRequestIds([
      { id: "ord-legacy", client_request_id: null },
      { id: "ord-1", client_request_id: "request-1" },
      { id: "ord-2", client_request_id: " request-1 " },
      { id: "ord-3", client_request_id: "request-2" },
    ])).toEqual({
      totalOrders: 4,
      ordersWithRequestId: 3,
      legacyOrdersWithoutRequestId: 1,
      duplicateRequestIds: [{
        requestId: "request-1",
        orderIds: ["ord-1", "ord-2"],
      }],
    });
  });
});

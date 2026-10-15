import { describe, expect, it } from "vitest";
import { priceCart, bestPromotion } from "@/lib/sales/price-cart";
import type { PriceCartItem, PricePromotion } from "@/lib/sales/price-cart";

const catalog = {
  variants: [
    { id: "BAC-XIU", price: 29000 },
    { id: "CF-SUA", price: 25000 },
    { id: "TRA-DAU", price: 27000 },
    { id: "TRA-XOAI", price: 27000 },
    { id: "SIZE-L", price: 30000 },
    { id: "BIG", price: 100000 },
  ],
  modifiers: [{ id: "TRAN-CHAU", price: 5000 }],
};

const item = (variant_id: string, qty = 1, extra: Partial<PriceCartItem> = {}): PriceCartItem => ({
  variant_id,
  qty,
  modifiers: [],
  manual_item_discount: { value: 0, type: "VND" },
  ...extra,
});

const promo = (p: Partial<PricePromotion>): PricePromotion => ({
  id: "P",
  code: "",
  type: "PRODUCT_DISCOUNT",
  discount_type: "FLAT_VND",
  discount_value: 0,
  applicable_products_json: "",
  min_order_value: 0,
  stackable: false,
  ...p,
});

describe("priceCart", () => {
  it("BR-SALE-009: percent whole-order discount is taken after the dish discount", () => {
    const r = priceCart(
      [item("BAC-XIU", 1, { manual_item_discount: { value: 4000, type: "VND" } }), item("CF-SUA")],
      catalog,
      [],
      { value: 10, type: "PERCENT" },
    );
    expect(r.total).toBe(45000);
  });

  it("BR-SALE-010: whole-order promotion and cashier whole-order discount stack", () => {
    const tenPercent = promo({ id: "ORD", type: "ORDER_DISCOUNT", discount_type: "PERCENT", discount_value: 10 });
    const r = priceCart([item("BIG")], catalog, [tenPercent], { value: 5000, type: "VND" });
    expect(r.total).toBe(85000);
    expect(r.applied).toEqual([{ promotionId: "ORD", amount: 10000 }]);
  });

  it("BR-SALE-011: whole-order minimum is checked after the dish discount", () => {
    const dish = promo({ id: "DISH", discount_value: 5000, applicable_products_json: JSON.stringify(["BAC-XIU"]) });
    const order = promo({ id: "ORD", type: "ORDER_DISCOUNT", discount_type: "PERCENT", discount_value: 10, min_order_value: 100000 });
    const r = priceCart([item("BAC-XIU", 4)], catalog, [dish, order], null);
    expect(r.applied).toEqual([{ promotionId: "DISH", amount: 20000 }]);
    expect(r.total).toBe(96000);
  });

  it("đồng giá keeps the option price", () => {
    const flat = promo({ discount_type: "FLAT_PRICE", discount_value: 15000, applicable_products_json: JSON.stringify(["TRA-DAU"]) });
    const r = priceCart(
      [item("TRA-DAU", 1, { modifiers: [{ modifier_id: "TRAN-CHAU", modifier_qty: 1 }] })],
      catalog,
      [flat],
      null,
    );
    expect(r.lines[0].net).toBe(20000);
  });

  it("percent uses the per-size value, not the shared one", () => {
    const pct = promo({
      discount_type: "PERCENT",
      discount_value: 50,
      applicable_products_json: JSON.stringify({ "SIZE-L": 10 }),
    });
    expect(priceCart([item("SIZE-L")], catalog, [pct], null).lines[0].promo).toBe(3000);
  });

  it("spec section 7: dish promotion + whole-order promotion + cashier percent", () => {
    const dish = promo({ id: "PRM-004", discount_value: 10000, applicable_products_json: JSON.stringify(["TRA-DAU", "TRA-XOAI"]), stackable: true });
    const order = promo({ id: "KHAITRUONG", type: "ORDER_DISCOUNT", discount_type: "PERCENT", discount_value: 15, stackable: true });
    const r = priceCart([item("TRA-DAU"), item("TRA-XOAI")], catalog, [dish, order], { value: 10, type: "PERCENT" });
    expect(r.total).toBe(26010);
    expect(r.lines.map((l) => l.net)).toEqual([13005, 13005]);
    expect(r.applied).toEqual([
      { promotionId: "PRM-004", amount: 20000 },
      { promotionId: "KHAITRUONG", amount: 5100 },
    ]);
  });
});

describe("bestPromotion", () => {
  it("code match wins case-insensitively and trimmed", () => {
    const pNoCode = promo({ id: "P-AUTO", discount_value: 10000, applicable_products_json: JSON.stringify(["BAC-XIU"]) });
    const pCode = promo({ id: "P-CODE", code: "SAVE5", discount_value: 5000, applicable_products_json: JSON.stringify(["BAC-XIU"]) });
    const matched = bestPromotion([pNoCode, pCode], [item("BAC-XIU")], catalog, "  save5 ");
    expect(matched?.id).toBe("P-CODE");
  });

  it("best no-code wins (largest discount, ties: first)", () => {
    const pSmall = promo({ id: "SMALL", discount_value: 2000, applicable_products_json: JSON.stringify(["BAC-XIU"]) });
    const pLarge = promo({ id: "LARGE", discount_value: 5000, applicable_products_json: JSON.stringify(["BAC-XIU"]) });
    const pTie = promo({ id: "TIE", discount_value: 5000, applicable_products_json: JSON.stringify(["BAC-XIU"]) });
    const best = bestPromotion([pSmall, pLarge, pTie], [item("BAC-XIU")], catalog, null);
    expect(best?.id).toBe("LARGE");
  });

  it("none → null when no promotion gives more than 0 or unmatched code", () => {
    const pNotApplicable = promo({ id: "OTHER", discount_value: 5000, applicable_products_json: JSON.stringify(["OTHER-DISH"]) });
    expect(bestPromotion([pNotApplicable], [item("BAC-XIU")], catalog, null)).toBeNull();
    expect(bestPromotion([pNotApplicable], [item("BAC-XIU")], catalog, "UNKNOWN_CODE")).toBeNull();
    expect(bestPromotion([], [item("BAC-XIU")], catalog, null)).toBeNull();
  });
});


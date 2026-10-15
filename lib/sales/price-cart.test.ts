import { describe, expect, it } from "vitest";
import { priceCart, eligiblePromotionSets } from "@/lib/sales/price-cart";
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


describe("eligiblePromotionSets (BR-SALE-011)", () => {
  const AT = "2026-10-15T05:00:00.000Z";
  const row = (p: Record<string, unknown>) => ({
    ...promo({ discount_value: 10000, applicable_products_json: JSON.stringify(["TRA-DAU", "TRA-XOAI"]) }),
    status: "ACTIVE", start_date: "2026-01-01T00:00:00.000Z", end_date: "", brand_id: "", ...p,
  });
  const cart = [item("TRA-DAU"), item("TRA-XOAI")];
  const sets = (rows: any[], code: string | null = null) => eligiblePromotionSets(rows, cart, catalog, AT, "BR-1", code);

  it("two promotions that are both Dùng chung make one set of two", () => {
    const r = sets([row({ id: "A", stackable: true }), row({ id: "B", stackable: true, discount_value: 5000 })]);
    expect(r).toEqual([{ promotionIds: ["A", "B"], amount: 30000 }]);
  });

  it("one side not Dùng chung: two sets, the bigger first", () => {
    const r = sets([
      row({ id: "A", stackable: true, discount_value: 5000 }),
      row({ id: "B", stackable: false, discount_value: 10000 }),
    ]);
    expect(r).toEqual([
      { promotionIds: ["B"], amount: 20000 },
      { promotionIds: ["A"], amount: 10000 },
    ]);
  });

  it("a promotion with a code is left out until its code is typed (any case)", () => {
    const rows = [row({ id: "C", code: "KHAI" })];
    expect(sets(rows)).toEqual([]);
    expect(sets(rows, " khai ")).toEqual([{ promotionIds: ["C"], amount: 20000 }]);
  });

  it("leaves out inactive, expired, other-brand and below-minimum promotions", () => {
    expect(sets([
      row({ id: "OFF", status: "INACTIVE" }),
      row({ id: "OLD", end_date: "2026-10-01T00:00:00.000Z" }),
      row({ id: "FUT", start_date: "2026-11-01T00:00:00.000Z" }),
      row({ id: "BRAND", brand_id: "BR-2" }),
      row({ id: "MIN", min_order_value: 1000000 }),
    ])).toEqual([]);
  });
});

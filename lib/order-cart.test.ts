import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { buildOrderFromCart } from "@/lib/order-cart";
import type { CartInput, ReferenceData } from "@/lib/order-cart";

// Real reference data (subset matching WS-1 fixtures)
const REF: ReferenceData = {
  brands: [{ id: "BR-002", code: "UCK", name: "UCK" }],
  products: [
    { id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001" },
    { id: "PROD-017", name: "Trà dâu", category_id: "CAT-001" },
  ],
  variants: [
    { id: "VAR-031", product_id: "PROD-024", size_name: "700ml", price: "35000" },
    { id: "VAR-024", product_id: "PROD-017", size_name: "700ml", price: "27000" },
  ],
  categories: [{ id: "CAT-001", name: "Đồ uống" }],
  modifiers: [],
  promotions: [
    {
      id: "PRM-003",
      name: "KHAI TRƯƠNG ĐỒNG GIÁ",
      type: "PRODUCT_DISCOUNT",
      discount_type: "FLAT_PRICE",
      discount_value: "15000",
      applicable_products_json: JSON.stringify({ "VAR-024": 15000, "VAR-031": 25000 }),
      code: "",
      start_date: "2026-05-31T17:00:00.000Z",
      end_date: "2026-06-30T16:59:00.000Z",
      status: "ACTIVE",
      brand_id: "",
      min_order_value: "0",
    },
  ],
  recipes: [],
  base_ingredients: [],
};

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("buildOrderFromCart", () => {
  it("throws on empty cart", () => {
    expect(() =>
      buildOrderFromCart({
        brand_id: "BR-002",
        items: [],
        payment_method: "CASH",
        actor: { id: "U1", name: "Test" },
      }, REF),
    ).toThrow(/empty/i);
  });

  it("throws on unknown variant", () => {
    expect(() =>
      buildOrderFromCart({
        brand_id: "BR-002",
        items: [
          { product_id: "PROD-024", variant_id: "VAR-UNKNOWN", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
        ],
        payment_method: "CASH",
        actor: { id: "U1", name: "Test" },
      }, REF),
    ).toThrow(/variant/i);
  });

  it("Sữa Dâu standalone: net_total = 25000 (audit headline)", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        {
          product_id: "PROD-024",
          variant_id: "VAR-031",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 0, type: "VND" },
        },
      ],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result.order.gross_total).toBe(35000);
    expect(result.order.promo_discount_total).toBe(10000); // 35k - 25k promo target
    expect(result.order.manual_item_discount_total).toBe(0);
    expect(result.order.manual_order_discount).toBe(0);
    expect(result.order.net_total).toBe(25000);
    expect(result.lines[0].gross_line_total).toBe(35000);
    expect(result.lines[0].promo_discount).toBe(10000);
    expect(result.lines[0].manual_item_discount).toBe(0);
    expect(result.lines[0].order_discount_allocation).toBe(0);
    expect(result.lines[0].net_line_total).toBe(25000);
  });

  it("FLAT_PRICE promo: VAR-024 Trà dâu (27k → 15k target) → promo 12k", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        {
          product_id: "PROD-017",
          variant_id: "VAR-024",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 0, type: "VND" },
        },
      ],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result.order.promo_discount_total).toBe(12000);
    expect(result.order.net_total).toBe(15000);
  });

  it("FLAT_VND promo subtracts the configured amount per item", () => {
    const flatVndRef: ReferenceData = {
      ...REF,
      promotions: [{
        ...REF.promotions[0],
        discount_type: "FLAT_VND",
        discount_value: "3000",
        applicable_products_json: JSON.stringify(["VAR-031"]),
      }],
    };
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 2,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, flatVndRef);

    expect(result.order.gross_total).toBe(70000);
    expect(result.order.promo_discount_total).toBe(6000);
    expect(result.order.net_total).toBe(64000);
  });

  it("manual_item_discount VND: subtracts directly from line", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        {
          product_id: "PROD-024",
          variant_id: "VAR-031",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 5000, type: "VND" },
        },
      ],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, REF);

    // 35k gross - 10k promo - 5k manual_item = 20k
    expect(result.lines[0].manual_item_discount).toBe(5000);
    expect(result.lines[0].net_line_total).toBe(20000);
    expect(result.order.net_total).toBe(20000);
  });

  it("manual_item_discount PERCENT: converts to VND on gross", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        {
          product_id: "PROD-024",
          variant_id: "VAR-031",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 10, type: "PERCENT" }, // 10% of 35k = 3500
        },
      ],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result.lines[0].manual_item_discount).toBe(3500);
    // 35k - 10k promo - 3500 manual = 21500
    expect(result.lines[0].net_line_total).toBe(21500);
  });

  it("manual_order_discount allocates proportionally across lines", () => {
    // Sữa Dâu (35k) + Trà dâu (27k) = 62k gross
    // Promos: Sữa Dâu 10k, Trà dâu 12k → total 22k
    // Capacities: Sữa Dâu 25k, Trà dâu 15k → total 40k
    // Manual order discount: 4k
    // Allocations: round(4000 * 25/40) = 2500 (Sữa Dâu), residual 1500 (Trà dâu)
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
        { product_id: "PROD-017", variant_id: "VAR-024", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
      ],
      payment_method: "CASH",
      manual_order_discount: { value: 4000, type: "VND" },
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result.order.manual_order_discount).toBe(4000);
    expect(result.lines[0].order_discount_allocation).toBe(2500); // Sữa Dâu
    expect(result.lines[1].order_discount_allocation).toBe(1500); // Trà dâu (residual)
    expect(result.order.net_total).toBe(62000 - 22000 - 4000); // 36000
  });

  it("manual_order_discount PERCENT: converts to VND on gross", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
      ],
      payment_method: "CASH",
      manual_order_discount: { value: 10, type: "PERCENT" }, // 10% of 35k = 3500
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result.order.manual_order_discount).toBe(3500);
  });

  it("caps manual_item_discount at line capacity (gross - promo)", () => {
    // 35k - 10k promo = 25k capacity. Manual 50k → capped at 25k.
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 50000, type: "VND" } },
      ],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result.lines[0].manual_item_discount).toBe(25000);
    expect(result.lines[0].net_line_total).toBe(0);
  });

  it("does NOT apply promo outside its date range", () => {
    const expiredPromoRef: ReferenceData = {
      ...REF,
      promotions: [{
        ...REF.promotions[0],
        end_date: "2025-01-01T00:00:00.000Z", // expired
      }],
    };
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
      ],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, expiredPromoRef);

    expect(result.order.promo_discount_total).toBe(0);
    expect(result.order.net_total).toBe(35000);
  });

  it("all 7 invariants pass on built order+lines (buildOrderFromCart calls assertOrderInvariants)", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
        { product_id: "PROD-017", variant_id: "VAR-024", qty: 2, modifiers: [], manual_item_discount: { value: 1000, type: "VND" } },
      ],
      payment_method: "BANK_TRANSFER",
      manual_order_discount: { value: 3000, type: "VND" },
      actor: { id: "U1", name: "Test" },
    }, REF);

    // If assertOrderInvariants didn't pass internally, buildOrderFromCart would have thrown.
    expect(result.order.id).toBeDefined();
    expect(result.order.version).toBe(1);
    expect(result.order.status).toBe("COMPLETED");
    expect(result.lines.length).toBe(2);
  });

  it("modifier recipes are captured in recipe_snapshot_json", () => {
    const refWithModifierRecipe: ReferenceData = {
      ...REF,
      modifiers: [{ id: "MOD-004", name: "Trân châu trắng", price: "5000", status: "ACTIVE" }],
      recipes: [
        // Existing variant recipes...
        ...REF.recipes,
        {
          id: "RCP-MOD-004",
          target_type: "MODIFIER",
          target_id: "MOD-004",
          ingredients_json: JSON.stringify([
            { ingredient_id: "BI-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "UNIT-KG" },
          ]),
          end_date: "",
          created_at: "2026-06-01T00:00:00Z",
        },
      ],
    };

    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 1,
        modifiers: [{ modifier_id: "MOD-004", modifier_qty: 1 }],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, refWithModifierRecipe);

    const recipeSnap = JSON.parse(result.lines[0].recipe_snapshot_json);
    expect(recipeSnap.variant).toBeDefined();
    expect(recipeSnap.modifiers.length).toBe(1);
    expect(recipeSnap.modifiers[0].modifier_id).toBe("MOD-004");
    expect(recipeSnap.modifiers[0].modifier_qty).toBe(1);
    expect(recipeSnap.modifiers[0].recipe.ingredients[0].ingredient_id).toBe("BI-PEARL");
  });

  it("modifier recipe snapshots keep modifier quantity", () => {
    const refWithModifierRecipe: ReferenceData = {
      ...REF,
      modifiers: [{ id: "MOD-004", name: "Tran chau trang", price: "5000", status: "ACTIVE" }],
      recipes: [
        {
          id: "RCP-MOD-004",
          target_type: "MODIFIER",
          target_id: "MOD-004",
          ingredients_json: JSON.stringify([
            { ingredient_id: "BI-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "UNIT-KG" },
          ]),
          end_date: "",
          created_at: "2026-06-01T00:00:00Z",
        },
      ],
    };

    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 1,
        modifiers: [{ modifier_id: "MOD-004", modifier_qty: 2 }],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, refWithModifierRecipe);

    const modifiers = JSON.parse(result.lines[0].modifiers_snapshot_json);
    const recipeSnap = JSON.parse(result.lines[0].recipe_snapshot_json);

    expect(modifiers[0].qty).toBe(2);
    expect(recipeSnap.modifiers[0].modifier_qty).toBe(2);
  });

  it("3-discount coexistence: manual item, system promo, and custom order discount all active", () => {
    // Sữa Dâu (VAR-031): base 35k.
    // has system promo PRM-003: flat variant price 25k (discount 10k)
    // manual_item_discount: 5000 VND
    // manual_order_discount: 3000 VND
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      items: [
        {
          product_id: "PROD-024",
          variant_id: "VAR-031",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 5000, type: "VND" },
        },
      ],
      payment_method: "CASH",
      manual_order_discount: { value: 3000, type: "VND" },
      actor: { id: "U1", name: "Test" },
    }, REF);

    // Gross: 35k
    // Promo: 10k
    // Manual item: 5k
    // Capacity for order-level: 35k - 10k - 5k = 20k
    // Order discount: 3k
    // Net: 20k - 3k = 17k
    expect(result.order.gross_total).toBe(35000);
    expect(result.order.promo_discount_total).toBe(10000);
    expect(result.order.manual_item_discount_total).toBe(5000);
    expect(result.order.manual_order_discount).toBe(3000);
    expect(result.order.net_total).toBe(17000);

    expect(result.lines[0].gross_line_total).toBe(35000);
    expect(result.lines[0].promo_discount).toBe(10000);
    expect(result.lines[0].manual_item_discount).toBe(5000);
    expect(result.lines[0].order_discount_allocation).toBe(3000);
    expect(result.lines[0].net_line_total).toBe(17000);
  });

  describe("split/mixed payment", () => {
    const singleItemCart = {
      brand_id: "BR-002",
      items: [
        {
          product_id: "PROD-024",
          variant_id: "VAR-031",
          qty: 1,
          modifiers: [],
          manual_item_discount: { value: 0, type: "VND" as const },
        },
      ],
      actor: { id: "U1", name: "Test" },
    };

    it("returns no payments array when payments is omitted (single payment_method, unchanged behavior)", () => {
      const result = buildOrderFromCart({
        ...singleItemCart,
        payment_method: "CASH",
      }, REF);

      expect(result.payments).toEqual([]);
      expect(result.order.payment_method).toBe("CASH");
    });

    it("builds a payments array that sums to net_total when split payments are provided", () => {
      // net_total for this cart is 25000 (see "Sữa Dâu standalone" test above)
      const result = buildOrderFromCart({
        ...singleItemCart,
        payment_method: "CASH",
        payments: [
          { method: "CASH", amount: 15000 },
          { method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" },
        ],
      }, REF);

      expect(result.order.net_total).toBe(25000);
      expect(result.payments).toHaveLength(2);
      expect(result.payments[0]).toMatchObject({ method: "CASH", amount: 15000, reference: "" });
      expect(result.payments[1]).toMatchObject({ method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" });
      expect(result.payments[0].id).toMatch(/^pay-/);
      expect(result.payments[1].id).toMatch(/^pay-/);
      expect(result.payments[0].id).not.toBe(result.payments[1].id);
      // Primary payment_method column reflects the first payment for backward compatibility.
      expect(result.order.payment_method).toBe("CASH");
    });

    it("rejects a payments array that doesn't sum to net_total", () => {
      expect(() =>
        buildOrderFromCart({
          ...singleItemCart,
          payment_method: "CASH",
          payments: [
            { method: "CASH", amount: 15000 },
            { method: "BANK_TRANSFER", amount: 5000 },
          ],
        }, REF),
      ).toThrow(/payment total.*does not match/i);
    });

    it("rejects a zero or negative payment amount", () => {
      expect(() =>
        buildOrderFromCart({
          ...singleItemCart,
          payment_method: "CASH",
          payments: [
            { method: "CASH", amount: 25000 },
            { method: "BANK_TRANSFER", amount: 0 },
          ],
        }, REF),
      ).toThrow(/greater than 0/i);
    });
  });
});

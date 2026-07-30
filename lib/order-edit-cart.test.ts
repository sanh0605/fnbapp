import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import {
  buildEditedOrderFromCart,
  planEditedOrderPayments,
} from "@/lib/order-edit-cart";
import { makeSuaDauStandaloneOrder } from "@/lib/__tests__/fixtures";
import type { CartInput, ReferenceData } from "@/lib/order-cart";
import type { OrderV2 } from "@/lib/order-types";

const REF: ReferenceData = {
  brands: [{ id: "BR-002", code: "UCK", name: "UCK" }],
  products: [{ id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001" }],
  variants: [{ id: "VAR-031", product_id: "PROD-024", size_name: "700ml", price: "35000" }],
  categories: [{ id: "CAT-001", name: "Đồ uống" }],
  modifiers: [],
  promotions: [{
    id: "PRM-003", name: "PRM", type: "PRODUCT_DISCOUNT", discount_type: "FLAT_PRICE",
    discount_value: "15000",
    applicable_products_json: JSON.stringify({ "VAR-031": 25000 }),
    code: "", start_date: "2026-05-31T17:00:00.000Z", end_date: "2026-06-30T16:59:00.000Z",
    status: "ACTIVE", brand_id: "", min_order_value: "0",
  }],
  recipes: [], base_ingredients: [],
};

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("buildEditedOrderFromCart", () => {
  it("preserves created_at from original order", () => {
    const original = makeSuaDauStandaloneOrder();
    const editInput: CartInput = {
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024", variant_id: "VAR-031", qty: 2, // changed qty 1 → 2
        modifiers: [], manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    };

    const result = buildEditedOrderFromCart(editInput, REF, original);

    expect(result.order.created_at).toBe(original.order.created_at);
    expect(result.order.completed_at).toBe(original.order.completed_at);
  });

  it("increments version", () => {
    const original = makeSuaDauStandaloneOrder();
    expect(original.order.version).toBe(1);

    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, REF, original);

    expect(result.order.version).toBe(2);
  });

  it("preserves order_no from original", () => {
    const original = makeSuaDauStandaloneOrder();
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, REF, original);
    expect(result.order.order_no).toBe(original.order.order_no);
  });

  it("walks parent chain: editing v2 produces v3 with parent_order_id = root v1", () => {
    const v1 = makeSuaDauStandaloneOrder();
    const v1RootId = v1.order.id;

    // Manually construct v2 in the chain
    const v2Order = { ...v1.order, id: "ord-v2-mock", version: 2, parent_order_id: v1RootId };
    const v2 = { order: v2Order, lines: v1.lines };

    // Now edit v2
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U3", name: "Editor" },
    }, REF, v2);

    expect(result.order.version).toBe(3);
    expect(result.order.parent_order_id).toBe(v1RootId); // root, not v2
  });

  it("edits actor is recorded in created_by_*", () => {
    const original = makeSuaDauStandaloneOrder();
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "user-editor-01", name: "Quản lý A" },
    }, REF, original);

    expect(result.order.created_by_id).toBe("user-editor-01");
    expect(result.order.created_by_name).toBe("Quản lý A");
  });

  it("changing qty from 1 to 2 doubles gross_total", () => {
    const original = makeSuaDauStandaloneOrder();
    expect(original.order.gross_total).toBe(35000);

    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 2,
        promo_discount_snapshot: 20000,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, REF, original);

    expect(result.order.gross_total).toBe(70000);
    expect(result.order.promo_discount_total).toBe(20000); // 10k promo per cup × 2
    expect(result.order.net_total).toBe(50000); // 70k - 20k promo
  });

  it("invariants pass on edited order (assertOrderInvariants called internally)", () => {
    const original = makeSuaDauStandaloneOrder();
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
      ],
      payment_method: "BANK_TRANSFER",
      manual_order_discount: { value: 5000, type: "VND" },
      actor: { id: "U2", name: "Editor" },
    }, REF, original);

    // If assertOrderInvariants didn't pass, function would have thrown.
    expect(result.order.id).not.toBe(original.order.id);
    expect(result.order.status).toBe("COMPLETED");
  });

  it("preserves submitted price snapshots when current menu prices changed", () => {
    const original = makeSuaDauStandaloneOrder();
    const refWithChangedPrices: ReferenceData = {
      ...REF,
      variants: [{ id: "VAR-031", product_id: "PROD-024", size_name: "700ml", price: "99000" }],
      modifiers: [{ id: "MOD-001", name: "20ml cot ca phe new", price: "10000" }],
      recipes: [{
        id: "RCP-MOD-001",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        ingredients_json: "[]",
        end_date: "",
        created_at: "2026-06-01T00:00:00Z",
      }],
    };

    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        unit_price_snapshot: 22000,
        qty: 1,
        modifiers: [{
          modifier_id: "MOD-001",
          modifier_qty: 2,
          modifier_name_snapshot: "20ml cot ca phe",
          modifier_price_snapshot: 3000,
        }],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, refWithChangedPrices, original);

    const modifierSnapshot = JSON.parse(result.lines[0].modifiers_snapshot_json);

    expect(result.lines[0].unit_price).toBe(22000);
    expect(modifierSnapshot[0]).toMatchObject({
      id: "MOD-001",
      name: "20ml cot ca phe",
      price: 3000,
      qty: 2,
    });
    expect(result.lines[0].gross_line_total).toBe(28000);
  });

  it("preserves submitted promo discount snapshot when current promotion changed", () => {
    const original = makeSuaDauStandaloneOrder();
    const refWithChangedPromotion: ReferenceData = {
      ...REF,
      promotions: [{
        ...REF.promotions[0],
        discount_value: "99999",
        applicable_products_json: JSON.stringify({ "VAR-031": 1000 }),
      }],
    };

    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        unit_price_snapshot: 35000,
        promo_discount_snapshot: 10000,
        qty: 1,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, refWithChangedPromotion, original);

    expect(result.lines[0].promo_discount).toBe(10000);
    expect(result.lines[0].net_line_total).toBe(25000);
    expect(result.order.promo_discount_total).toBe(10000);
    expect(result.order.net_total).toBe(25000);
  });
});

describe("buildEditedOrderFromCart resolves recipes against the original sale time", () => {
  // REC-001 for VAR-001 (Cà phê đá 500ml), consuming BTP-004 (Nước đường),
  // in force 2026-03-26 -> 2026-05-12. Its successor, effective from that
  // same instant, consumes ING-022 instead -- the real shape verified
  // against production in docs/superpowers/plans/2026-07-30-phase6-recipe-snapshot-repair.md.
  const REF_WITH_TWO_RECIPE_VERSIONS: ReferenceData = {
    brands: [{ id: "BR-002", code: "UCK", name: "UCK" }],
    products: [{ id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001" }],
    variants: [{ id: "VAR-001", product_id: "PROD-001", size_name: "500ml", price: "18000" }],
    categories: [{ id: "CAT-001", name: "Đồ uống" }],
    modifiers: [],
    promotions: [],
    recipes: [
      {
        id: "REC-001", target_type: "PRODUCT_VARIANT", target_id: "VAR-001",
        ingredients_json: JSON.stringify([{ ingredient_id: "BTP-004", ingredient_type: "SEMI_PRODUCT", quantity: 20, unit_id: "U-ML" }]),
        status: "ACTIVE", start_date: null,
        created_at: "2026-03-26T17:00:00.000Z", end_date: "2026-05-12T17:00:00.000Z",
      },
      {
        id: "REC-002", target_type: "PRODUCT_VARIANT", target_id: "VAR-001",
        ingredients_json: JSON.stringify([{ ingredient_id: "ING-022", ingredient_type: "BASE_INGREDIENT", quantity: 20, unit_id: "U-ML" }]),
        status: "ACTIVE", start_date: null,
        created_at: "2026-05-12T17:00:00.000Z", end_date: null,
      },
    ],
    base_ingredients: [],
  };

  const originalOrder: OrderV2 = {
    id: "ord-original", order_no: "UCK-TEST-001", brand_id: "BR-002",
    status: "COMPLETED", version: 1, parent_order_id: "", superseded_by: "",
    created_at: "2026-04-20T03:00:00.000Z", // in force under REC-001
    created_by_id: "U1", created_by_name: "Cashier",
    completed_at: "2026-04-20T03:00:00.000Z",
    voided_at: "", voided_by_id: "", void_reason: "",
    currency: "VND", gross_total: 18000, promo_discount_total: 0,
    manual_item_discount_total: 0, manual_order_discount: 0, net_total: 18000,
    applied_promotion_id: "", applied_promotion_snapshot_json: "",
    pos_snapshot_json: "{}", payment_method: "CASH", payment_ref: "",
    migration_notes: "",
  };
  const cartInput: CartInput = {
    brand_id: "BR-002",
    items: [{ product_id: "PROD-001", variant_id: "VAR-001", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
    payment_method: "CASH",
    actor: { id: "U2", name: "Editor" },
  };

  it("resolves the recipe against the original sale time, not now", () => {
    const built = buildEditedOrderFromCart(cartInput, REF_WITH_TWO_RECIPE_VERSIONS, {
      order: originalOrder,
      lines: [],
    });
    const snapshot = JSON.parse(built.lines[0].recipe_snapshot_json);
    const ingredientIds = snapshot.variant.ingredients.map((i: any) => i.ingredient_id);
    expect(ingredientIds).toContain("BTP-004");
    expect(ingredientIds).not.toContain("ING-022");
  });

  it("still resolves correctly when the sale is older than the 30-day POS clock guard", () => {
    // resolveCapturedAt rejects >30 days and falls back to now. An edit's sale
    // time comes from the database, not a device clock, so that guard must not
    // apply here. Without a bypass this test fails while the previous one passes
    // (fake system time in this file is 2026-06-15, ~56 days after the sale).
    const built = buildEditedOrderFromCart(cartInput, REF_WITH_TWO_RECIPE_VERSIONS, {
      order: originalOrder,
      lines: [],
    });
    expect(built.order.migration_notes || "").not.toContain("rejected");
    const ingredientIds = JSON.parse(built.lines[0].recipe_snapshot_json).variant.ingredients
      .map((i: any) => i.ingredient_id);
    expect(ingredientIds).toContain("BTP-004");
  });
});

describe("planEditedOrderPayments", () => {
  it("preserves an existing split when the edited total is unchanged", () => {
    expect(planEditedOrderPayments(
      [
        { method: "CASH", amount: 15000, reference: "" },
        { method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" },
      ],
      25000,
      25000,
      "CASH",
    )).toEqual([
      { method: "CASH", amount: 15000, reference: "" },
      { method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" },
    ]);
  });

  it("rejects changing the total of an existing split instead of guessing a new allocation", () => {
    expect(() => planEditedOrderPayments(
      [
        { method: "CASH", amount: 15000, reference: "" },
        { method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" },
      ],
      25000,
      30000,
      "CASH",
    )).toThrow(/\u0110\u01a1n thanh to\u00e1n k\u1ebft h\u1ee3p.*kh\u00f4ng th\u1ec3 \u0111\u1ed5i t\u1ed5ng ti\u1ec1n/i);
  });

  it("creates one current payment row for legacy or single-method edits", () => {
    expect(planEditedOrderPayments([], 25000, 30000, "BANK_TRANSFER")).toEqual([
      { method: "BANK_TRANSFER", amount: 30000, reference: "" },
    ]);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildProductSnapshot,
  buildVariantSnapshot,
  buildModifierSnapshots,
  buildPromotionSnapshot,
  buildRecipeSnapshot,
  buildModifierSnapshotsFromCart,
} from "@/lib/order-snapshot";

describe("buildProductSnapshot", () => {
  it("builds snapshot from raw product + category rows", () => {
    const product = { id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001" };
    const category = { id: "CAT-001", name: "Đồ uống" };
    const snap = buildProductSnapshot(product, category);
    expect(snap).toEqual({
      id: "PROD-024",
      name: "Sữa dâu sấy giòn",
      category_id: "CAT-001",
      category_name: "Đồ uống",
    });
  });

  it("handles missing category (uses empty string)", () => {
    const product = { id: "P1", name: "X", category_id: "" };
    const snap = buildProductSnapshot(product, null);
    expect(snap.category_name).toBe("");
  });
});

describe("buildVariantSnapshot", () => {
  it("captures id, size_name, price as integer", () => {
    const variant = { id: "VAR-031", size_name: "700ml", price: "35000" };
    const snap = buildVariantSnapshot(variant);
    expect(snap).toEqual({ id: "VAR-031", size_name: "700ml", price: 35000 });
  });

  it("rejects non-positive price", () => {
    const variant = { id: "V1", size_name: "M", price: "0" };
    expect(() => buildVariantSnapshot(variant)).toThrow(/price/);
  });
});

describe("buildModifierSnapshots", () => {
  it("dedupes modifiers by id (preserves first occurrence)", () => {
    const mods = [
      { id: "MOD-004", name: "Trân châu trắng", price: "5000" },
      { id: "MOD-004", name: "Trân châu trắng", price: "5000" },
    ];
    const snaps = buildModifierSnapshots(mods);
    expect(snaps.length).toBe(1);
    expect(snaps[0]).toEqual({ id: "MOD-004", name: "Trân châu trắng", price: 5000, qty: 1 });
  });

  it("tracks per-modifier qty when same id appears multiple times", () => {
    const cart = [
      { modifier_id: "MOD-X", modifier_qty: 2 },
      { modifier_id: "MOD-X", modifier_qty: 1 },
    ];
    const modifierRows = [{ id: "MOD-X", name: "M", price: "1000" }];
    const snaps = buildModifierSnapshotsFromCart(cart, modifierRows);
    expect(snaps[0].qty).toBe(3);
  });

  it("uses modifier snapshot price from edit cart when provided", () => {
    const cart = [
      {
        modifier_id: "MOD-X",
        modifier_qty: 2,
        modifier_name_snapshot: "Old topping",
        modifier_price_snapshot: 3000,
      },
    ];
    const modifierRows = [{ id: "MOD-X", name: "New topping", price: "10000" }];
    const snaps = buildModifierSnapshotsFromCart(cart, modifierRows);

    expect(snaps[0]).toEqual({ id: "MOD-X", name: "Old topping", price: 3000, qty: 2 });
  });
});

describe("buildPromotionSnapshot", () => {
  it("snapshots all fields needed for replay", () => {
    const promo = {
      id: "PRM-003",
      name: "KHAI TRƯƠNG ĐỒNG GIÁ",
      type: "PRODUCT_DISCOUNT",
      discount_type: "FLAT_PRICE",
      discount_value: "15000",
      applicable_products_json: JSON.stringify({ "VAR-031": 25000 }),
      code: "",
      start_date: "2026-05-31T17:00:00.000Z",
      end_date: "2026-06-30T16:59:00.000Z",
    };
    const snap = buildPromotionSnapshot(promo);
    expect(snap.id).toBe("PRM-003");
    expect(snap.discount_value).toBe(15000);
    expect(snap.applicable_products_json).toBeDefined();
  });
});

describe("buildRecipeSnapshot", () => {
  it("includes ingredient list verbatim", () => {
    const recipe = {
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-031",
      ingredients_json: JSON.stringify([
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "UNIT-LITER" },
      ]),
    };
    const snap = buildRecipeSnapshot(recipe);
    expect(snap.target_type).toBe("PRODUCT_VARIANT");
    expect(snap.ingredients.length).toBe(1);
    expect(snap.ingredients[0].ingredient_id).toBe("BI-MILK");
  });

  it("returns empty ingredients array on malformed JSON", () => {
    const recipe = { target_type: "PRODUCT_VARIANT", target_id: "VAR-031", ingredients_json: "not-json" };
    const snap = buildRecipeSnapshot(recipe);
    expect(snap.ingredients).toEqual([]);
  });
});

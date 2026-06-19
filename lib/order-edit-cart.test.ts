import { describe, it, expect } from "vitest";
import { buildEditedOrderFromCart } from "@/lib/order-edit-cart";
import { makeSuaDauStandaloneOrder } from "@/lib/__tests__/fixtures";
import type { CartInput, ReferenceData } from "@/lib/order-cart";

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
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 2, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
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
});

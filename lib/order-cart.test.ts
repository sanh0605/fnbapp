import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import { buildOrderFromCart } from "@/lib/order-cart";
import type { CartInput, ReferenceData } from "@/lib/order-cart";

// Real reference data (subset matching WS-1 fixtures)
const REF: ReferenceData = {
  brands: [{ id: "BR-002", code: "UCK", name: "UCK" }],
  products: [
    { id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001", status: "ACTIVE" },
    { id: "PROD-017", name: "Trà dâu", category_id: "CAT-001", status: "ACTIVE" },
  ],
  variants: [
    { id: "VAR-031", product_id: "PROD-024", size_name: "700ml", price: "35000", status: "ACTIVE" },
    { id: "VAR-024", product_id: "PROD-017", size_name: "700ml", price: "27000", status: "ACTIVE" },
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
        outlet_id: "OUT-002",
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
        outlet_id: "OUT-002",
        items: [
          { product_id: "PROD-024", variant_id: "VAR-UNKNOWN", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
        ],
        payment_method: "CASH",
        actor: { id: "U1", name: "Test" },
      }, REF),
    ).toThrow(/variant/i);
  });

  describe("does not sell a paused product (docs/superpowers/plans/2026-08-29-product-stop-selling-and-real-delete.md section 5.4/5b)", () => {
    it("refuses when the product is INACTIVE, naming the product in the message", () => {
      const refWithPausedProduct: ReferenceData = {
        ...REF,
        products: [
          { id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001", status: "INACTIVE" },
          REF.products[1],
        ],
      };

      expect(() =>
        buildOrderFromCart({
          brand_id: "BR-002",
          outlet_id: "OUT-002",
          items: [
            { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
          ],
          payment_method: "CASH",
          actor: { id: "U1", name: "Test" },
        }, refWithPausedProduct),
      ).toThrow(/Sữa dâu sấy giòn.*ngừng bán/);
    });

    it("refuses when the variant is INACTIVE even though the product is ACTIVE", () => {
      const refWithPausedVariant: ReferenceData = {
        ...REF,
        variants: [
          { id: "VAR-031", product_id: "PROD-024", size_name: "700ml", price: "35000", status: "INACTIVE" },
          REF.variants[1],
        ],
      };

      expect(() =>
        buildOrderFromCart({
          brand_id: "BR-002",
          outlet_id: "OUT-002",
          items: [
            { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
          ],
          payment_method: "CASH",
          actor: { id: "U1", name: "Test" },
        }, refWithPausedVariant),
      ).toThrow(/ngừng bán/);
    });

    it("the message covers both readers: a cashier at checkout, and an admin reading a later offline-sync failure", () => {
      const refWithPausedProduct: ReferenceData = {
        ...REF,
        products: [
          { id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001", status: "INACTIVE" },
          REF.products[1],
        ],
      };

      try {
        buildOrderFromCart({
          brand_id: "BR-002",
          outlet_id: "OUT-002",
          items: [
            { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
          ],
          payment_method: "CASH",
          actor: { id: "U1", name: "Test" },
        }, refWithPausedProduct);
        throw new Error("expected buildOrderFromCart to throw");
      } catch (err: any) {
        // The cashier's actionable step (remove the item, retry) and the
        // admin's (an offline order that already reached the customer needs
        // manual revenue entry, since it never got saved) both need to be
        // present -- neither reader gets any other context, see
        // app/admin/pos-sync/PosSyncClient.tsx, which renders only this
        // string next to the request token and timestamp.
        expect(err.message).toContain("chưa được lưu");
        expect(err.message).toContain("ghi nhận doanh thu thủ công");
        expect(err.message).toContain("bỏ món này khỏi đơn rồi thử lại");
      }
    });

    it("does not refuse a normal ACTIVE product/variant (no regression)", () => {
      expect(() =>
        buildOrderFromCart({
          brand_id: "BR-002",
          outlet_id: "OUT-002",
          items: [
            { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
          ],
          payment_method: "CASH",
          actor: { id: "U1", name: "Test" },
        }, REF),
      ).not.toThrow();
    });
  });

  it("Sữa Dâu standalone: net_total = 25000 (audit headline)", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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

  // docs/superpowers/plans/2026-08-31-remove-recipe-snapshots.md section 2:
  // recipe_snapshot_json stopped being written 2026-09-01 -- no longer even
  // the inert no-recipe shell this test used to assert (Phase 2 had already
  // emptied its content; this task stops writing it at all). An empty
  // string, not "{}" or a JSON shell -- it round-trips through
  // parseJsonColumns (pos-order-transaction.ts/order-edit-transaction.ts)
  // to {}, matching the column's own NOT NULL default. Confirmed red on
  // the pre-fix code before this change: the old assertion (JSON.parse
  // producing the empty-ingredients shell) still passed then, since the
  // write side hadn't changed -- this replacement asserts the opposite
  // value on purpose, not a missing function.
  it("recipe_snapshot_json is an empty string -- no shell, no recipe, nothing written", () => {
    const refWithModifier: ReferenceData = {
      ...REF,
      modifiers: [{ id: "MOD-004", name: "Trân châu trắng", price: "5000", status: "ACTIVE" }],
    };

    const result = buildOrderFromCart({
      brand_id: "BR-002",
      outlet_id: "OUT-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 1,
        modifiers: [{ modifier_id: "MOD-004", modifier_qty: 1 }],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, refWithModifier);

    expect(result.lines[0].recipe_snapshot_json).toBe("");
  });

  it("no longer returns resolvedRecipes -- nothing consumed it (section 1.3, 0 results outside the two files that produced it)", () => {
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      outlet_id: "OUT-002",
      items: [{
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 1,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U1", name: "Test" },
    }, REF);

    expect(result).not.toHaveProperty("resolvedRecipes");
  });

  it("3-discount coexistence: manual item, system promo, and custom order discount all active", () => {
    // Sữa Dâu (VAR-031): base 35k.
    // has system promo PRM-003: flat variant price 25k (discount 10k)
    // manual_item_discount: 5000 VND
    // manual_order_discount: 3000 VND
    const result = buildOrderFromCart({
      brand_id: "BR-002",
      outlet_id: "OUT-002",
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
      outlet_id: "OUT-002",
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

describe("buildOrderFromCart client_captured_at", () => {
  const baseInput: CartInput = {
    brand_id: "BR-002",
    outlet_id: "OUT-002",
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
  };

  afterEach(() => {
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
  });

  it("uses the client-captured timestamp when within bounds", () => {
    const result = buildOrderFromCart(
      { ...baseInput, client_captured_at: "2026-06-14T10:00:00.000Z" },
      REF,
    );
    expect(result.order.created_at).toBe("2026-06-14T10:00:00.000Z");
    expect(result.order.migration_notes).toBe("");
  });

  it("falls back to server time and annotates migration_notes when the client timestamp is out of bounds", () => {
    const result = buildOrderFromCart(
      { ...baseInput, client_captured_at: "2026-05-01T00:00:00.000Z" },
      REF,
    );
    expect(result.order.created_at).toBe("2026-06-15T00:00:00.000Z");
    expect(result.order.migration_notes).toBe("client_captured_at_rejected");
  });

  it("resolves promotion eligibility against the true sale time, not the sync-time clock", () => {
    // PRM-003 (see REF above) is active 2026-05-31T17:00 through
    // 2026-06-30T16:59. The customer paid at 2026-06-15 (mid-window) but the
    // device only reached the server on 2026-07-01 (after the window
    // closed). The promotion must still apply -- it was active at the
    // moment of sale -- even though it is no longer active "now".
    vi.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));

    const result = buildOrderFromCart(
      { ...baseInput, client_captured_at: "2026-06-15T00:00:00.000Z" },
      REF,
    );

    expect(result.order.promo_discount_total).toBe(10000);
    expect(result.order.net_total).toBe(25000);
  });

  it("uses server time when client_captured_at is omitted", () => {
    const result = buildOrderFromCart(baseInput, REF);
    expect(result.order.created_at).toBe("2026-06-15T00:00:00.000Z");
    expect(result.order.migration_notes).toBe("");
  });
});

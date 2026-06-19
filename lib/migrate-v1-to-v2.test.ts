import { describe, it, expect } from "vitest";
import { reconstructOrderV2, classifyV1Discounts } from "@/lib/migrate-v1-to-v2";
import type { V1Order, V1Line, MigrationReferenceData } from "@/lib/migrate-v1-to-v2";

const REF: MigrationReferenceData = {
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
  recipes: [],
};

describe("classifyV1Discounts", () => {
  it("clean order with no discounts", () => {
    const v1: V1Order = {
      id: "ORD-1", order_no: "TEST001", brand_id: "BR", status: "COMPLETED",
      total_amount: "30000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-01T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-1", order_id: "ORD-1", product_id: "P", variant_id: "V",
      qty: "1", unit_price: "30000", line_discount: "0", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-01T00:00:00Z",
    }];
    const c = classifyV1Discounts(v1, lines);
    expect(c.inferred_promo_total).toBe(0);
    expect(c.inferred_manual_item_total).toBe(0);
    expect(c.inferred_manual_order_discount).toBe(0);
  });

  it("PRODUCT_DISCOUNT promo: line_discount is promo, order.discount_amount=0", () => {
    const v1: V1Order = {
      id: "ORD-2", order_no: "TEST002", brand_id: "BR", status: "COMPLETED",
      total_amount: "25000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: JSON.stringify({ type: "PRODUCT_DISCOUNT" }),
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-01T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-2", order_id: "ORD-2", product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-01T00:00:00Z",
    }];
    const c = classifyV1Discounts(v1, lines);
    expect(c.inferred_promo_total).toBe(10000);
    expect(c.inferred_manual_item_total).toBe(0);
    expect(c.inferred_manual_order_discount).toBe(0);
  });

  it("flags E.1 bug pattern: applied_promotion_id set but snapshot empty", () => {
    const v1: V1Order = {
      id: "ORD-3", order_no: "TEST003", brand_id: "BR", status: "COMPLETED",
      total_amount: "20000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-01T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-3", order_id: "ORD-3", product_id: "P", variant_id: "V",
      qty: "1", unit_price: "35000", line_discount: "10000", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-01T00:00:00Z",
    }];
    const c = classifyV1Discounts(v1, lines);
    expect(c.notes).toContain("applied_promotion_id set but snapshot empty (legacy E.1 bug pattern)");
  });
});

describe("reconstructOrderV2", () => {
  it("UCK000094 pattern: V1 total_amount bug ignored, computed net used instead", () => {
    const v1: V1Order = {
      id: "ORD-uck", order_no: "UCK000094", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "156000", // LEGACY BUG: should be 161000
      subtotal: "266000",     // V1 subtotal is correct
      discount_amount: "0",   // No order-level discount
      discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: "",
      method: "Chuyen khoan", staff_name: "tuyen2612", created_at: "2026-06-12T12:21:26Z",
    };
    const lines: V1Line[] = [{
      id: "OL-uck-sua-dau", order_id: "ORD-uck",
      product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000",
      discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T12:21:26Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);

    // WS-7 fix: use V1 intended math, NOT stored total_amount
    expect(result.order.gross_total).toBe(35000);
    expect(result.order.promo_discount_total).toBe(10000);
    expect(result.order.manual_item_discount_total).toBe(0);
    expect(result.order.manual_order_discount).toBe(0); // V1 discount_amount = 0
    expect(result.order.net_total).toBe(25000); // computed: 35-10-0-0 = 25k
    // Note: NOT 156000 (V1 buggy value) or 161000 (user's earlier "correct" guess for full order)
    expect(result.classification.residual).toBe(-131000); // stored - computed
    expect(result.classification.heuristic_notes.length).toBeGreaterThan(0);
    expect(result.invariantPassed).toBe(true);
  });

  it("manual_order_discount from V1 discount_amount (not solved residual)", () => {
    // Order: gross 100k, V1 says order discount 20k → manual_order = 20k
    const v1: V1Order = {
      id: "ORD-disc", order_no: "DISC001", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "80000", // gross 100 - discount 20 = 80 (V1 total correct here)
      subtotal: "100000",
      discount_amount: "20000",
      discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-disc", order_id: "ORD-disc",
      product_id: "PROD-024", variant_id: "VAR-031",
      qty: "2", unit_price: "35000", line_discount: "30000", // 70k gross, 30k line discount
      discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    // gross = 70k, line_discount = 30k, manual_order = 20k
    // net = 70 - 30 - 0 - 20 = 20k
    const result = reconstructOrderV2(v1, lines, [], REF);
    expect(result.order.manual_order_discount).toBe(20000);
    expect(result.order.net_total).toBe(20000);
  });

  it("clean Sữa Dâu order: invariants pass", () => {
    const v1: V1Order = {
      id: "ORD-clean", order_no: "CLEAN001", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "25000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: JSON.stringify({ type: "PRODUCT_DISCOUNT" }),
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-clean", order_id: "ORD-clean",
      product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000",
      discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);

    expect(result.invariantPassed).toBe(true);
    expect(result.order.net_total).toBe(25000);
    expect(result.lines[0].net_line_total).toBe(25000);
  });

  it("VOIDED order: status preserved", () => {
    const v1: V1Order = {
      id: "ORD-void", order_no: "VOID001", brand_id: "BR-002", status: "VOIDED",
      total_amount: "25000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
      voided: "true",
    };
    const lines: V1Line[] = [{
      id: "OL-void", order_id: "ORD-void", product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "0", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);
    expect(result.order.status).toBe("VOIDED");
    expect(result.order.voided_at).not.toBe("");
    expect(result.order.completed_at).toBe("");
  });

  it("creates MIGRATED event with v1_id reference", () => {
    const v1: V1Order = {
      id: "ORD-evt", order_no: "EVT001", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "35000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-evt", order_id: "ORD-evt", product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "0", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);
    expect(result.event.event_type).toBe("MIGRATED");
    expect(result.event.order_id).toBe(result.order.id);
    const delta = JSON.parse(result.event.delta_json);
    expect(delta.v1_id).toBe("ORD-evt");
  });
});

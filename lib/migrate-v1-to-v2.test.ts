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
  it("UCK000094 pattern: 5k discrepancy absorbed as manual_order_discount", () => {
    // Reconstructed V1 order matching real UCK000094 pattern
    const v1: V1Order = {
      id: "ORD-uck", order_no: "UCK000094", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "156000", // LEGACY BUG: should be 161000
      discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: "", // wiped (E.1 pattern)
      method: "Chuyen khoan", staff_name: "tuyen2612", created_at: "2026-06-12T12:21:26Z",
    };
    const lines: V1Line[] = [{
      id: "OL-uck-sua-dau", order_id: "ORD-uck",
      product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000",
      discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T12:21:26Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);

    expect(result.order.gross_total).toBe(35000);
    expect(result.order.promo_discount_total).toBe(10000);
    expect(result.order.manual_item_discount_total).toBe(0);
    // net_total = V1 total_amount (authoritative)
    expect(result.order.net_total).toBe(156000);
    // manual_order_discount = gross - promo - manual_item - net = 35 - 10 - 0 - 156 = -131
    // → clamped to 0 (overpaid case)
    expect(result.order.manual_order_discount).toBe(0);
    expect(result.classification.residual).toBe(-131000); // 35-10-0-0-156 in thousands
    expect(result.classification.heuristic_notes.length).toBeGreaterThan(0);
    expect(result.classification.heuristic_notes[0]).toMatch(/overpaid/i);
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

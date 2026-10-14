import { describe, it, expect } from "vitest";
import { selectPatches, type OrderRow } from "./restore-order-seller-promo-core";

const o = (p: Partial<OrderRow> & { id: string }): OrderRow => ({
  order_no: "N", status: "COMPLETED", parent_order_id: null, superseded_by: null,
  created_by_id: "u1", created_by_name: "Tuyên", applied_promotion_id: null,
  applied_promotion_snapshot_json: {}, ...p,
});

describe("selectPatches", () => {
  it("restores seller and promotion from the root across a two-step chain", () => {
    const rows = [
      o({ id: "A", status: "VOIDED", superseded_by: "B", applied_promotion_id: "PRM-3", applied_promotion_snapshot_json: { x: 1 } }),
      o({ id: "B", status: "VOIDED", superseded_by: "C", parent_order_id: "A", created_by_id: "ad", created_by_name: "admin" }),
      o({ id: "C", parent_order_id: "B", created_by_id: "ad", created_by_name: "admin" }),
    ];
    const [p] = selectPatches(rows);
    expect(p.id).toBe("C");
    expect(p.values).toEqual({
      created_by_id: "u1", created_by_name: "Tuyên",
      applied_promotion_id: "PRM-3", applied_promotion_snapshot_json: { x: 1 },
    });
  });

  it("skips untouched sales, superseded versions, a matching live version, and keeps a promotion the live one already has", () => {
    const rows = [
      o({ id: "S" }),
      o({ id: "A", superseded_by: "B", status: "VOIDED" }),
      o({ id: "B", parent_order_id: "A" }),
      o({ id: "R", applied_promotion_id: "PRM-1" }),
      o({ id: "L", parent_order_id: "R", applied_promotion_id: "PRM-2" }),
    ];
    expect(selectPatches(rows)).toEqual([]);
  });
});

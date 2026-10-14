import { describe, expect, it } from "vitest";
import { planRelinks } from "./relink-orphan-assets-core";

const orders = [
  { id: "PO-098", status: "COMPLETED", transaction_date: "2026-09-01T03:00:00+00:00" },
  { id: "PO-100", status: "COMPLETED", transaction_date: "2026-09-05T03:00:00+00:00" },
  { id: "PO-101", status: "COMPLETED", transaction_date: "2026-09-06T03:00:00+00:00" },
  { id: "PO-102", status: "CANCELLED", transaction_date: "2026-09-07T03:00:00+00:00" },
];
const line = (id: string, orderId: string, itemId: string, quantity: number | string, unitPrice = 1000) => ({
  id, purchase_order_id: orderId, purchased_item_id: itemId, quantity, unit_price: unitPrice,
});
const asset = (id: string, itemId: string, lineId: string | null, quantity = 1, unitCost = 1000) => ({
  id, purchased_item_id: itemId, purchase_order_line_id: lineId, name_snapshot: `snap ${id}`,
  acquired_date: "2026-09-05", unit_cost: unitCost, quantity,
});

describe("planRelinks", () => {
  it("leaves an asset with a live link alone", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-1")],
      lines: [line("L-1", "PO-100", "SPM-1", 1)],
      orders,
    });
    expect(plan).toEqual({ checked: 1, orphans: 0, relinks: [], skips: [] });
  });

  it("leaves an asset with a null link alone", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", null)],
      lines: [line("L-1", "PO-100", "SPM-1", 1)],
      orders,
    });
    expect(plan).toEqual({ checked: 1, orphans: 0, relinks: [], skips: [] });
  });

  it("relinks an orphan to the single exact candidate", () => {
    const plan = planRelinks({
      assets: [asset("TS-009", "SPM-1", "L-old", 1, 900)],
      lines: [line("L-new", "PO-098", "SPM-1", 1, 950)],
      orders,
    });
    expect(plan.checked).toBe(1);
    expect(plan.orphans).toBe(1);
    expect(plan.skips).toEqual([]);
    expect(plan.relinks).toEqual([{
      assetId: "TS-009", nameSnapshot: "snap TS-009", oldLineId: "L-old", newLineId: "L-new",
      purchaseOrderId: "PO-098", orderDate: "2026-09-01", assetAcquiredDate: "2026-09-05",
      lineUnitPrice: 950, assetUnitCost: 900,
    }]);
  });

  it("ignores a same-item candidate with a different quantity (TS-015 case)", () => {
    const plan = planRelinks({
      assets: [
        asset("TS-014", "SPM-1", "L-101", 1),          // live link to PO-101 line qty 1
        asset("TS-015", "SPM-1", "L-gone", 2),         // orphan, qty 2
      ],
      lines: [line("L-101", "PO-101", "SPM-1", 1), line("L-100", "PO-100", "SPM-1", 2)],
      orders,
    });
    expect(plan.relinks.map(r => [r.assetId, r.newLineId])).toEqual([["TS-015", "L-100"]]);
    expect(plan.skips).toEqual([]);
  });

  it("ignores a candidate already linked to another asset", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-1"), asset("TS-002", "SPM-1", "L-gone")],
      lines: [line("L-1", "PO-100", "SPM-1", 1)],
      orders,
    });
    expect(plan.relinks).toEqual([]);
    expect(plan.skips).toEqual([{ assetId: "TS-002", reason: "no candidate line", candidateLineIds: [] }]);
  });

  it("skips the second of two orphans competing for one line, never double-links", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-gone1"), asset("TS-002", "SPM-1", "L-gone2")],
      lines: [line("L-1", "PO-100", "SPM-1", 1)],
      orders,
    });
    expect(plan.orphans).toBe(2);
    expect(plan.relinks.map(r => [r.assetId, r.newLineId])).toEqual([["TS-001", "L-1"]]);
    expect(plan.skips.map(s => s.assetId)).toEqual(["TS-002"]);
  });

  it("skips an orphan with two equal candidates", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-gone")],
      lines: [line("L-1", "PO-100", "SPM-1", 1), line("L-2", "PO-101", "SPM-1", 1)],
      orders,
    });
    expect(plan.relinks).toEqual([]);
    expect(plan.skips).toEqual([
      { assetId: "TS-001", reason: "2 candidate lines, will not guess", candidateLineIds: ["L-1", "L-2"] },
    ]);
  });

  it("ignores a candidate on a CANCELLED order", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-gone")],
      lines: [line("L-1", "PO-102", "SPM-1", 1)],
      orders,
    });
    expect(plan.relinks).toEqual([]);
    expect(plan.skips.map(s => s.assetId)).toEqual(["TS-001"]);
  });

  it("shows the order day in Asia/Saigon, not UTC", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-gone")],
      lines: [line("L-1", "PO-late", "SPM-1", 1)],
      orders: [{ id: "PO-late", status: "COMPLETED", transaction_date: "2026-04-03T17:30:00+00:00" }],
    });
    expect(plan.relinks[0].orderDate).toBe("2026-04-04");
  });

  it("treats quantity '2.000000' as equal to 2", () => {
    const plan = planRelinks({
      assets: [asset("TS-001", "SPM-1", "L-gone", 2)],
      lines: [line("L-1", "PO-100", "SPM-1", "2.000000")],
      orders,
    });
    expect(plan.relinks.map(r => r.newLineId)).toEqual(["L-1"]);
  });
});

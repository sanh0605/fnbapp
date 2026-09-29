import { describe, expect, it } from "vitest";
import type { Purchase } from "@/lib/costing/issue-costing";
import { computeUnitCostsAt } from "./unit-cost-at";
import type { IdentifiedIssue } from "./issue-line-values";

const at = "2026-09-10T00:00:00Z";
const purchases: Purchase[] = [
  { purchased_item_id: "A", at: "2026-09-01T00:00:00Z", base_quantity: 1000, subtotal: 100000 },
  { purchased_item_id: "A", at: "2026-09-05T00:00:00Z", base_quantity: 1000, subtotal: 200000 },
  { purchased_item_id: "A", at: "2026-09-20T00:00:00Z", base_quantity: 1000, subtotal: 900000 },
  { purchased_item_id: "C", at: "2026-09-15T00:00:00Z", base_quantity: 10, subtotal: 50000 },
];

describe("computeUnitCostsAt", () => {
  it("averages only the purchases at or before the moment (two before, one after)", () => {
    const m = computeUnitCostsAt(purchases, [], at, ["A"]);
    expect(m.get("A")).toBeCloseTo(150, 10); // (100000 + 200000) / 2000, not the 3-purchase 400
  });

  it("gives an item with no purchase before the moment no entry, not 0", () => {
    const m = computeUnitCostsAt(purchases, [], at, ["A", "C", "Z"]);
    expect(m.has("C")).toBe(false);
    expect(m.has("Z")).toBe(false);
  });

  it("a partial issue before the moment does not change the average", () => {
    const issues: IdentifiedIssue[] = [{ id: "I1", purchased_item_id: "A", at: "2026-09-07T00:00:00Z", base_quantity: 700, source: "MANUAL" }];
    expect(computeUnitCostsAt(purchases, issues, at, ["A"]).get("A")).toBeCloseTo(150, 10);
  });

  it("stock drained to zero before a later purchase restarts the average at that purchase", () => {
    const issues: IdentifiedIssue[] = [{ id: "I1", purchased_item_id: "A", at: "2026-09-06T00:00:00Z", base_quantity: 2000, source: "MANUAL" }];
    const more: Purchase[] = [...purchases, { purchased_item_id: "A", at: "2026-09-08T00:00:00Z", base_quantity: 100, subtotal: 50000 }];
    expect(computeUnitCostsAt(more, issues, at, ["A"]).get("A")).toBeCloseTo(500, 10);
  });

  it("issues at the very moment are ignored, so a slip that empties the pool still has a price", () => {
    const issues: IdentifiedIssue[] = [{ id: "I1", purchased_item_id: "A", at, base_quantity: 2000, source: "MANUAL" }];
    expect(computeUnitCostsAt(purchases, issues, at, ["A"]).get("A")).toBeCloseTo(150, 10);
  });

  it("a purchase at the very moment counts (goods land before they leave)", () => {
    const p: Purchase[] = [{ purchased_item_id: "A", at, base_quantity: 10, subtotal: 1000 }];
    expect(computeUnitCostsAt(p, [], at, ["A"]).get("A")).toBe(100);
  });

  it("an item whose stock is empty at the moment gets no entry", () => {
    const issues: IdentifiedIssue[] = [{ id: "I1", purchased_item_id: "A", at: "2026-09-06T00:00:00Z", base_quantity: 2000, source: "MANUAL" }];
    expect(computeUnitCostsAt(purchases, issues, at, ["A"]).has("A")).toBe(false);
  });
});

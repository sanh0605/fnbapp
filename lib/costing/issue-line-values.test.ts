import { describe, expect, it } from "vitest";
import { computeIssueCosting, type Purchase } from "@/lib/costing/issue-costing";
import { computeIssueLineValues, type IdentifiedIssue } from "./issue-line-values";

const purchases: Purchase[] = [
  { purchased_item_id: "A", at: "2026-09-01T00:00:00Z", base_quantity: 1000, subtotal: 100000 },
  { purchased_item_id: "A", at: "2026-09-03T00:00:00Z", base_quantity: 1000, subtotal: 200000 },
  { purchased_item_id: "B", at: "2026-09-01T00:00:00Z", base_quantity: 10, subtotal: 50000 },
];
const issues: IdentifiedIssue[] = [
  { id: "I1", purchased_item_id: "A", at: "2026-09-02T00:00:00Z", base_quantity: 500, source: "MANUAL" },
  { id: "I2", purchased_item_id: "A", at: "2026-09-04T00:00:00Z", base_quantity: 500, source: "MANUAL" },
  { id: "I3", purchased_item_id: "B", at: "2026-09-02T00:00:00Z", base_quantity: 4, source: "MANUAL" },
  // I1 returned to stock later, at the then-current average (BR-INV-009).
  { id: "R1", purchased_item_id: "A", at: "2026-09-05T00:00:00Z", base_quantity: -500, source: "MANUAL" },
];

describe("computeIssueLineValues", () => {
  it("prices each line at the weighted average of its own moment", () => {
    const v = computeIssueLineValues(purchases, issues);
    expect(v.get("I1")).toBeCloseTo(50000, 6);
    // pool after I1: 500 @ 50.000 + 1000 @ 200.000 = 250.000 / 1500
    expect(v.get("I2")).toBeCloseTo(500 * 250000 / 1500, 6);
    expect(v.get("I3")).toBeCloseTo(20000, 6);
  });

  it("gives a return-to-stock row a negative value and leaves earlier lines unchanged", () => {
    const v = computeIssueLineValues(purchases, issues);
    expect(v.get("R1")!).toBeLessThan(0);
    expect(v.get("I1")).toBeCloseTo(50000, 6);
  });

  it("sums to exactly what computeIssueCosting reports", () => {
    const v = computeIssueLineValues(purchases, issues);
    const lineSum = [...v.values()].reduce((s, x) => s + x, 0);
    const engine = computeIssueCosting(purchases, issues).reduce((s, r) => s + r.issued_value, 0);
    expect(lineSum).toBeCloseTo(engine, 6);
  });

  it("keeps input order for two lines at the same instant", () => {
    const same: IdentifiedIssue[] = [
      { id: "S1", purchased_item_id: "B", at: "2026-09-02T00:00:00Z", base_quantity: 2, source: "MANUAL" },
      { id: "S2", purchased_item_id: "B", at: "2026-09-02T00:00:00Z", base_quantity: 3, source: "MANUAL" },
    ];
    const v = computeIssueLineValues(purchases, same);
    expect(v.get("S1")).toBeCloseTo(10000, 6);
    expect(v.get("S2")).toBeCloseTo(15000, 6);
  });
});

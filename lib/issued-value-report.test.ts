import { describe, it, expect } from "vitest";
import { computeIssuedItemFigures, computeIssuedEventFigures } from "@/lib/issued-value-report";
import { buildIssueCostingPurchases, buildIssueCostingIssues } from "@/lib/issue-costing-inputs";
import type { Purchase, Issue } from "@/lib/issue-costing";
import liveSnapshot from "@/app/admin/reports/issued/__fixtures__/2026-08-13-live-snapshot.json";

// Plan G section 5's gate: a stocktake session's or an issue slip's value is
// derived by prefix subtraction in the engine's own order, never by
// multiplying a quantity by a unit cost computed some other way -- that
// would be a second cost definition, disagreeing with the total by
// construction. The only proof that the derivation is doing that (and not
// something that merely looks similar) is that summing every group's exact
// value reproduces the exact per-item grand total, with nothing left over.
describe("computeIssuedEventFigures: the section 5 sum gate", () => {
  it("real snapshot (2026-08-13): sum of exact per-event values equals the exact per-item grand total", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const allIssues = buildIssueCostingIssues(liveSnapshot.stockIssues as any[]);

    const itemFigures = computeIssuedItemFigures(purchases, allIssues);
    const grandTotalExact = itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0);

    const eventFigures = computeIssuedEventFigures(liveSnapshot.stockIssues as any[], purchases);
    const sumOfEventValuesExact = eventFigures.reduce((sum, f) => sum + f.valueExact, 0);

    // Telescoping sum in floating point -- exact to within FP noise, not
    // display rounding (lib/display-rounding.ts rounds each part
    // independently for the page, which is a separate, accepted trade-off
    // this test does not exercise).
    expect(sumOfEventValuesExact).toBeCloseTo(grandTotalExact, 6);
  });

  it("real snapshot: no group has a negative value", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const eventFigures = computeIssuedEventFigures(liveSnapshot.stockIssues as any[], purchases);

    for (const f of eventFigures) {
      expect(f.valueExact).toBeGreaterThanOrEqual(-0.005);
    }
  });

  it("real snapshot: STOCKTAKE rows group by session_id, MANUAL rows group by issue_slip_id -- one group per real slip/session, not one per row", () => {
    const purchases = buildIssueCostingPurchases(liveSnapshot.purchaseOrders as any[], liveSnapshot.purchaseOrderLines as any[]);
    const eventFigures = computeIssuedEventFigures(liveSnapshot.stockIssues as any[], purchases);

    const stocktakeGroups = eventFigures.filter(f => f.kind === "STOCKTAKE");
    const manualGroups = eventFigures.filter(f => f.kind === "MANUAL");

    // The live snapshot has 49 STOCKTAKE rows under one session, and 10
    // MANUAL rows under 6 slips (docs/superpowers/plans/2026-08-13-issued-
    // value-page.md section 2 / verified live 2026-08-13).
    expect(stocktakeGroups).toHaveLength(1);
    expect(manualGroups).toHaveLength(6);
  });

  it("synthetic: three groups touching the same item, ordered out of insertion order, still sum exactly", () => {
    // Deliberately hands the groups to computeIssuedEventFigures in an
    // order different from their real chronological order (group C's rows
    // appear first in the array), to prove group ordering is derived from
    // each row's own issued_at, not from array position.
    const purchases: Purchase[] = [
      { purchased_item_id: "SPM-TEST", at: "2026-01-01T00:00:00Z", base_quantity: 100, subtotal: 1000 },
    ];
    const stockIssues = [
      { id: "R3", purchased_item_id: "SPM-TEST", issued_at: "2026-01-03T00:00:00Z", base_quantity: 10, source: "MANUAL", issue_slip_id: "SLIP-C" },
      { id: "R1", purchased_item_id: "SPM-TEST", issued_at: "2026-01-01T01:00:00Z", base_quantity: 20, source: "STOCKTAKE", session_id: "SESSION-A" },
      { id: "R2", purchased_item_id: "SPM-TEST", issued_at: "2026-01-02T00:00:00Z", base_quantity: 15, source: "MANUAL", issue_slip_id: "SLIP-B" },
    ];

    const allIssues: Issue[] = buildIssueCostingIssues(stockIssues);
    const itemFigures = computeIssuedItemFigures(purchases, allIssues);
    const grandTotalExact = itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0);

    const eventFigures = computeIssuedEventFigures(stockIssues, purchases);
    expect(eventFigures).toHaveLength(3);
    // Newest first, matching getRecentIssueSlips's ordering.
    expect(eventFigures.map(f => f.key)).toEqual(["M:SLIP-C", "M:SLIP-B", "S:SESSION-A"]);

    const sumOfEventValuesExact = eventFigures.reduce((sum, f) => sum + f.valueExact, 0);
    expect(sumOfEventValuesExact).toBeCloseTo(grandTotalExact, 6);

    // All three issues share one weighted-average rate (10/unit, since
    // there is only one purchase) -- each group's value is exactly its own
    // quantity times that rate.
    expect(eventFigures.find(f => f.key === "S:SESSION-A")!.valueExact).toBeCloseTo(200, 6);
    expect(eventFigures.find(f => f.key === "M:SLIP-B")!.valueExact).toBeCloseTo(150, 6);
    expect(eventFigures.find(f => f.key === "M:SLIP-C")!.valueExact).toBeCloseTo(100, 6);
  });
});

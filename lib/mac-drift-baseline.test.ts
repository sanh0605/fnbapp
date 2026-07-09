import { describe, expect, it } from "vitest";
import {
  buildMacDriftBaselineReport,
  buildMacDriftRecoveryPlan,
} from "@/lib/mac-drift-baseline";

describe("buildMacDriftBaselineReport", () => {
  it("correlates MAC drift lines with migrated orders and post-baseline dates", () => {
    const report = buildMacDriftBaselineReport({
      baselineDocumentDate: "2026-07-02T23:59:59.999Z",
      drift: {
        eligibleOrderCount: 2,
        eligibleLineCount: 2,
        mismatchedLineCount: 2,
        totalStoredCogs: 100,
        totalExpectedCogs: 175,
        totalDelta: 75,
        classificationCounts: { BTP_SHORTFALL: 1, MAC_REPRICE: 1 },
        warnings: [],
        lineMismatches: [
          {
            line_id: "line-1",
            order_id: "ord-1",
            order_no: "UCK000001",
            created_at: "2026-06-26T00:00:00Z",
            product_id: "PROD-1",
            variant_id: "VAR-1",
            qty: 1,
            stored_cost: 10,
            expected_cost: 40,
            delta: 30,
            classification: "BTP_SHORTFALL",
            has_btp_shortfall: true,
            has_semi_product_direct: false,
          },
          {
            line_id: "line-2",
            order_id: "ord-2",
            order_no: "UCK000002",
            created_at: "2026-07-06T00:00:00Z",
            product_id: "PROD-2",
            variant_id: "VAR-2",
            qty: 1,
            stored_cost: 20,
            expected_cost: 65,
            delta: 45,
            classification: "MAC_REPRICE",
            has_btp_shortfall: false,
            has_semi_product_direct: false,
          },
        ],
      },
      orders: [
        { id: "ord-1", created_at: "2026-06-26T00:00:00Z" },
        { id: "ord-2", created_at: "2026-07-06T00:00:00Z" },
      ],
      events: [{ order_id: "ord-1", event_type: "MIGRATED" }],
    });

    expect(report.lineCount).toBe(2);
    expect(report.totalDelta).toBe(75);
    expect(report.migratedOrderCount).toBe(1);
    expect(report.nonMigratedOrderCount).toBe(1);
    expect(report.afterBaselineDocumentCount).toBe(1);
    expect(report.afterBaselineDocumentDelta).toBe(45);
    expect(report.byDate).toEqual([
      { date: "2026-06-26", count: 1, delta: 30 },
      { date: "2026-07-06", count: 1, delta: 45 },
    ]);
    expect(report.byClassification).toEqual([
      { classification: "BTP_SHORTFALL", count: 1, delta: 30 },
      { classification: "MAC_REPRICE", count: 1, delta: 45 },
    ]);
  });

  it("builds a stable recovery plan from baseline drift lines", () => {
    const plan = buildMacDriftRecoveryPlan({
      runId: "MAC-DRIFT-BASELINE-2026-07-09",
      lines: [
        {
          line_id: "line-1",
          order_id: "ord-1",
          order_no: "UCK000001",
          created_at: "2026-06-26T00:00:00Z",
          product_id: "PROD-1",
          variant_id: "VAR-1",
          qty: 1,
          stored_cost: 10,
          expected_cost: 40,
          delta: 30,
          classification: "BTP_SHORTFALL",
          has_btp_shortfall: true,
          has_semi_product_direct: false,
          isMigratedOrder: false,
          hasMigrationNotes: false,
          isAfterBaselineDocument: false,
        },
      ],
    });

    expect(plan.run_id).toBe("MAC-DRIFT-BASELINE-2026-07-09");
    expect(plan.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.changes).toEqual([
      {
        line_id: "line-1",
        order_id: "ord-1",
        order_no: "UCK000001",
        old_cost_at_sale: 10,
        new_cost_at_sale: 40,
        delta_vnd: 30,
        classification: "BTP_SHORTFALL",
      },
    ]);
  });
});

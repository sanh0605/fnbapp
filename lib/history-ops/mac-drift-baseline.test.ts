import { describe, expect, it } from "vitest";
import type { MacCogsLineMismatch } from "@/lib/mac-cogs-audit";
import {
  buildMacDriftBaselineReport,
  buildMacDriftRecoveryPlan,
  buildMacDriftAuditOutputPath,
  classifyMacDriftMismatches,
  getMacDriftAuditExitCode,
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

describe("classifyMacDriftMismatches", () => {
  const makeLine = (
    overrides: Partial<MacCogsLineMismatch> = {},
  ): MacCogsLineMismatch => ({
    line_id: "line-1",
    order_id: "order-1",
    order_no: "UCK000001",
    created_at: "2026-07-16T00:00:00Z",
    product_id: "PROD-1",
    variant_id: "VAR-1",
    qty: 1,
    stored_cost: 100,
    expected_cost: 120,
    delta: 20,
    classification: "MAC_REPRICE",
    has_btp_shortfall: false,
    has_semi_product_direct: false,
    ...overrides,
  });

  it("classifies all four operator categories and preserves cohort evidence", () => {
    const result = classifyMacDriftMismatches({
      mismatches: [
        makeLine(),
        makeLine({ line_id: "line-2" }),
        makeLine({ line_id: "line-3" }),
        makeLine({ line_id: "line-4" }),
      ],
      locks: [
        {
          order_line_id: "line-1",
          reason: "BTP_RECIPE_REPLAY_DRIFT",
          source_hash: "lock-hash-1",
          stored_cost_at_sale: 100,
          expected_cost_at_sale: 120,
        },
        {
          order_line_id: "line-2",
          reason: "BACKDATED_LEDGER_HISTORICAL_GAP",
          source_hash: "lock-hash-2",
          stored_cost_at_sale: 99,
          expected_cost_at_sale: 120,
        },
      ],
      knownCohortArtifacts: [
        {
          path: "task-3.6.json",
          sourceHash: "artifact-hash",
          lineIds: new Set(["line-3"]),
        },
      ],
    });

    expect(result.summary).toEqual({
      LOCKED_MATCHED: 1,
      LOCKED_VIOLATION: 1,
      KNOWN_NOT_LOCKED: 1,
      NEW_INVESTIGATION_NEEDED: 1,
    });
    expect(result.isOperationallyClean).toBe(false);
    expect(result.lockedViolationSummary).toEqual({
      LOCKED_VIOLATION_STORED: 1,
      LOCKED_VIOLATION_REPLAY: 0,
    });
    expect(result.lines.map(line => line.audit_category)).toEqual([
      "LOCKED_MATCHED",
      "LOCKED_VIOLATION",
      "KNOWN_NOT_LOCKED",
      "NEW_INVESTIGATION_NEEDED",
    ]);
    expect(result.lines[0]).toMatchObject({
      lock_reason: "BTP_RECIPE_REPLAY_DRIFT",
      lock_source_hash: "lock-hash-1",
    });
    expect(result.lines[2]).toMatchObject({
      known_artifact_path: "task-3.6.json",
      known_artifact_source_hash: "artifact-hash",
    });
    expect(result.lines[1]).toMatchObject({
      locked_violation_subcategory: "LOCKED_VIOLATION_STORED",
    });
    expect(result.cohortBreakdown).toEqual([
      { cohort: "BTP_RECIPE_REPLAY_DRIFT", count: 1, delta: 20 },
    ]);
  });

  it("marks a locked replay-value change as a violation", () => {
    const result = classifyMacDriftMismatches({
      mismatches: [makeLine({ expected_cost: 121, delta: 21 })],
      locks: [{
        order_line_id: "line-1",
        reason: "BASELINE",
        source_hash: "hash",
        stored_cost_at_sale: 100,
        expected_cost_at_sale: 120,
      }],
      knownCohortArtifacts: [],
    });

    expect(result.summary.LOCKED_VIOLATION).toBe(1);
    expect(result.lockedViolationSummary).toEqual({
      LOCKED_VIOLATION_STORED: 0,
      LOCKED_VIOLATION_REPLAY: 1,
    });
    expect(result.lines[0].locked_violation_subcategory)
      .toBe("LOCKED_VIOLATION_REPLAY");
    expect(result.lines[0].violation_fields).toEqual(["expected_cost_at_sale"]);
  });

  it("is operationally clean with only matched and replay-shifted locks", () => {
    const result = classifyMacDriftMismatches({
      mismatches: [
        makeLine(),
        makeLine({ line_id: "line-2", expected_cost: 121, delta: 21 }),
      ],
      locks: [
        {
          order_line_id: "line-1",
          reason: "BASELINE",
          source_hash: "hash",
          stored_cost_at_sale: 100,
          expected_cost_at_sale: 120,
        },
        {
          order_line_id: "line-2",
          reason: "BASELINE",
          source_hash: "hash",
          stored_cost_at_sale: 100,
          expected_cost_at_sale: 120,
        },
      ],
      knownCohortArtifacts: [],
    });

    expect(result.isOperationallyClean).toBe(true);
    expect(getMacDriftAuditExitCode(result)).toBe(0);
  });

  it("requires review when a locked stored value changes", () => {
    const result = classifyMacDriftMismatches({
      mismatches: [makeLine()],
      locks: [{
        order_line_id: "line-1",
        reason: "BASELINE",
        source_hash: "hash",
        stored_cost_at_sale: 99,
        expected_cost_at_sale: 120,
      }],
      knownCohortArtifacts: [],
    });

    expect(result.isOperationallyClean).toBe(false);
    expect(getMacDriftAuditExitCode(result)).toBe(1);
  });

  it("requires review when a new mismatch needs investigation", () => {
    const result = classifyMacDriftMismatches({
      mismatches: [makeLine()],
      locks: [],
      knownCohortArtifacts: [],
    });

    expect(result.isOperationallyClean).toBe(false);
    expect(getMacDriftAuditExitCode(result)).toBe(1);
  });
});

describe("buildMacDriftAuditOutputPath", () => {
  it("uses a date-stamped path and refuses the frozen baseline path", () => {
    expect(buildMacDriftAuditOutputPath(new Date("2026-07-16T10:00:00Z")))
      .toBe("docs/audits/2026-07-16-mac-drift-baseline-audit.json");
    expect(() => buildMacDriftAuditOutputPath(
      new Date("2026-07-16T10:00:00Z"),
      "docs/audits/2026-07-09-mac-drift-baseline-lines.json",
    )).toThrow(/frozen baseline artifact/i);
  });
});

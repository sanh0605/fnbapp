import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assessTask3BaselineLocks,
  buildTask3RecoveryPlan,
  buildTask3SnapshotSelection,
  verifyTask3RecoveryState,
} from "@/lib/task-3-recovery";

describe("buildTask3RecoveryPlan", () => {
  it("builds 170 locks and only the 40 confirmed purchase-cost changes", () => {
    const baselineRaw = readFileSync(
      resolve(process.cwd(), "docs/audits/2026-07-09-mac-drift-baseline-lines.json"),
      "utf8",
    );
    const investigationRaw = readFileSync(
      resolve(process.cwd(), "docs/audits/2026-07-13-task-3.3-drift-investigation.json"),
      "utf8",
    );

    const plan = buildTask3RecoveryPlan({
      baselineRaw,
      investigationRaw,
      runId: "TASK-3-E3-SELECTIVE-2026-07-13",
    });

    expect(plan.source_hash).toBe(
      "cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3",
    );
    expect(plan.locks).toHaveLength(170);
    expect(plan.changes).toHaveLength(40);
    expect(plan.total_delta_vnd).toBe(-933);
    expect(new Set(plan.changes.map(change => change.line_id)).size).toBe(40);
    expect(plan.changes.every(change =>
      plan.locks.some(lock => lock.order_line_id === change.line_id)
    )).toBe(true);
  });

  it("rejects a selective line that is absent from the immutable baseline", () => {
    const baselineRaw = JSON.stringify({
      summary: { line_count: 1 },
      lines: [{
        line_id: "line-1",
        order_id: "order-1",
        order_no: "UCK000001",
        stored_cost: 100,
        expected_cost: 90,
        delta: -10,
        classification: "MAC_REPRICE",
      }],
    });
    const investigationRaw = JSON.stringify({
      hypotheses: {
        H7_purchase_cost_recovery: {
          exact_line_count: 1,
          exact_baseline_delta_vnd: -10,
          lines: [{ line_id: "line-missing" }],
        },
      },
    });

    expect(() => buildTask3RecoveryPlan({
      baselineRaw,
      investigationRaw,
      runId: "test-run",
    })).toThrow("Selective recovery line is absent from baseline: line-missing");
  });

  it("selects only the orders, lines, and ledger items needed by the 40-line snapshot", () => {
    const baselineRaw = readFileSync(
      resolve(process.cwd(), "docs/audits/2026-07-09-mac-drift-baseline-lines.json"),
      "utf8",
    );
    const investigationRaw = readFileSync(
      resolve(process.cwd(), "docs/audits/2026-07-13-task-3.3-drift-investigation.json"),
      "utf8",
    );
    const plan = buildTask3RecoveryPlan({
      baselineRaw,
      investigationRaw,
      runId: "TASK-3-E3-SELECTIVE-2026-07-13",
    });

    const selection = buildTask3SnapshotSelection(plan, investigationRaw);

    expect(selection.orderLineIds).toHaveLength(40);
    expect(selection.orderIds).toHaveLength(35);
    expect(selection.itemReferences).toHaveLength(19);
    expect(selection.itemReferences).toContain("ING-032");
  });

  it("refuses to seed over a partial or different baseline lock set", () => {
    const expected = [{
      order_line_id: "line-1",
      locked_by: "TASK_3_E3",
      reason: "TASK_3_MAC_DRIFT_BASELINE_2026_07_09",
      source_hash: "a".repeat(64),
      stored_cost_at_sale: 100,
      expected_cost_at_sale: 90,
      delta_vnd: -10,
    }];

    expect(assessTask3BaselineLocks(expected, [])).toBe("EMPTY");
    expect(assessTask3BaselineLocks(expected, expected)).toBe("MATCHED");
    expect(() => assessTask3BaselineLocks(expected, [{
      ...expected[0],
      expected_cost_at_sale: 91,
    }])).toThrow("Existing audit baseline locks do not match the Task 3 plan");
  });

  it("verifies selected lines changed and every non-selected baseline line stayed untouched", () => {
    const locks = [
      makeLock("line-1", 100, 90),
      makeLock("line-2", 200, 230),
      makeLock("line-3", 300, 305),
    ];
    const plan = {
      run_id: "task-3-test",
      source_hash: "a".repeat(64),
      baseline_line_count: 3,
      selected_line_count: 1,
      total_delta_vnd: -10,
      locks,
      changes: [{
        line_id: "line-1",
        order_id: "order-1",
        order_no: "UCK000001",
        old_cost_at_sale: 100,
        new_cost_at_sale: 90,
        delta_vnd: -10,
        classification: "MAC_REPRICE",
      }],
    };
    const liveLines = [
      { id: "line-1", cost_at_sale: 90 },
      { id: "line-2", cost_at_sale: 200 },
      { id: "line-3", cost_at_sale: 300 },
    ];
    const recoveryRows = [{
      run_id: "task-3-test",
      row_id: "line-1",
      table_name: "order_lines_v2",
      column_name: "cost_at_sale",
      old_value: 100,
      new_value: 90,
      source_hash: "a".repeat(64),
      rolled_back_at: null,
    }];

    expect(verifyTask3RecoveryState({
      plan,
      liveLines,
      mismatchLineIds: ["line-2", "line-3"],
      recoveryRows,
    })).toEqual({
      recoveredLineCount: 1,
      untouchedLineCount: 2,
      mismatchLineCount: 2,
      mismatchLineDeltaVnd: 35,
    });

    expect(() => verifyTask3RecoveryState({
      plan,
      liveLines: liveLines.map(line =>
        line.id === "line-2" ? { ...line, cost_at_sale: 201 } : line
      ),
      mismatchLineIds: ["line-2", "line-3"],
      recoveryRows,
    })).toThrow("Non-selected order line changed: line-2");
  });
});

function makeLock(lineId: string, stored: number, expected: number) {
  return {
    order_line_id: lineId,
    locked_by: "TASK_3_E3",
    reason: "TASK_3_MAC_DRIFT_BASELINE_2026_07_09",
    source_hash: "a".repeat(64),
    stored_cost_at_sale: stored,
    expected_cost_at_sale: expected,
    delta_vnd: expected - stored,
  };
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSnapshotBundleFiles } from "@/lib/recovery-snapshot";
import {
  assertAuditBaselineTriggerBlocked,
  assessTask3CohortDrift,
  assessTask3BaselineLocks,
  buildTask3RecoveryPlan,
  buildTask3RecoveryRunId,
  buildTask3RpcChanges,
  buildTask3SnapshotSelection,
  partitionTask3RecoveryLocks,
  normalizeTask3SnapshotLinesForAudit,
  resolveTask3RunId,
  resolveSupabasePublicKey,
  verifyTask3SnapshotFiles,
  verifyTask3RecoveryState,
} from "@/lib/task-3-recovery";

describe("buildTask3RecoveryPlan", () => {
  it("normalizes canonical snapshot JSON fields for the MAC audit", () => {
    expect(normalizeTask3SnapshotLinesForAudit([{
      id: "line-1",
      recipe_snapshot_json: { variant: { ingredients: [] }, modifiers: [] },
      modifiers_snapshot_json: [{ id: "mod-1", qty: 2 }],
    }])).toEqual([{
      id: "line-1",
      recipe_snapshot_json: JSON.stringify({ variant: { ingredients: [] }, modifiers: [] }),
      modifiers_snapshot_json: JSON.stringify([{ id: "mod-1", qty: 2 }]),
    }]);
  });

  it("partitions recovery locks by approved line ID instead of delta sign", () => {
    const selected = makeLock("line-selected", 100, 90);
    const negativeButUntouched = makeLock("line-untouched", 200, 190);

    expect(partitionTask3RecoveryLocks({
      locks: [selected, negativeButUntouched],
      changes: [{ line_id: "line-selected" }],
    })).toEqual({
      recoveredLocks: [selected],
      untouchedLocks: [negativeButUntouched],
    });
  });

  it("requires the cohort drift effect to equal the approved 933 VND", () => {
    expect(assessTask3CohortDrift(-933, 0)).toEqual({
      preDeltaVnd: -933,
      postDeltaVnd: 0,
      effectVnd: 933,
    });
    expect(() => assessTask3CohortDrift(-933, 1))
      .toThrow("Cohort drift effect is 934 VND, expected 933 VND");
  });

  it("accepts only the audit-baseline trigger rejection", () => {
    expect(assertAuditBaselineTriggerBlocked({
      message: "Order line line-1 is audit-baseline locked and cannot be modified",
    })).toContain("audit-baseline locked");
    expect(() => assertAuditBaselineTriggerBlocked(null))
      .toThrow("Locked-line update unexpectedly succeeded");
    expect(() => assertAuditBaselineTriggerBlocked({ message: "network error" }))
      .toThrow("Unexpected locked-line update error: network error");
  });

  it("requires an explicit timestamped run ID for production verification", () => {
    const runId = "task-3-recovery-2026-07-13-081930193Z";

    expect(resolveTask3RunId(["--run-id", runId])).toBe(runId);
    expect(() => resolveTask3RunId([])).toThrow("--run-id is required");
    expect(() => resolveTask3RunId(["--run-id", "TASK-3-E3-SELECTIVE-2026-07-13"]))
      .toThrow("Invalid Task 3 recovery run ID");
  });

  it("builds a timestamped Task 3 recovery run ID", () => {
    expect(buildTask3RecoveryRunId(new Date("2026-07-13T07:15:30.123Z")))
      .toBe("task-3-recovery-2026-07-13-071530123Z");
  });

  it("builds the exact four-field RPC change payload", () => {
    expect(buildTask3RpcChanges({
      changes: [{
        line_id: "line-1",
        order_id: "order-1",
        order_no: "UCK000001",
        old_cost_at_sale: 100,
        new_cost_at_sale: 90,
        delta_vnd: -10,
        classification: "PURCHASE_COST_RECOVERY",
      }],
    })).toEqual([{
      line_id: "line-1",
      order_id: "order-1",
      old_cost_at_sale: 100,
      new_cost_at_sale: 90,
    }]);
  });

  it("verifies a targeted snapshot against its exact plan and selection", () => {
    const runId = "task-3-recovery-2026-07-13-071530123Z";
    const lock = makeLock("line-1", 100, 90);
    const plan = {
      run_id: runId,
      source_hash: "a".repeat(64),
      baseline_line_count: 1,
      selected_line_count: 1,
      total_delta_vnd: -10,
      locks: [lock],
      changes: [{
        line_id: "line-1",
        order_id: "order-1",
        order_no: "UCK000001",
        old_cost_at_sale: 100,
        new_cost_at_sale: 90,
        delta_vnd: -10,
        classification: "PURCHASE_COST_RECOVERY",
      }],
    };
    const selection = {
      orderLineIds: ["line-1"],
      orderIds: ["order-1"],
      itemReferences: ["ING-1"],
    };
    const files = createSnapshotBundleFiles({
      runId,
      capturedAt: "2026-07-13T07:15:30.123Z",
      sourceHash: plan.source_hash,
      sheets: {},
      supabase: {
        orders_v2: [{ id: "order-1" }],
        order_lines_v2: [{ id: "line-1", order_id: "order-1", cost_at_sale: 100 }],
        stock_ledger: [{ id: "ledger-1", item_reference: "ING-1" }],
        audit_baseline_locks: [lock],
        data_recovery_changes: [],
      },
    });

    expect(verifyTask3SnapshotFiles({ files, snapshotId: runId, plan, selection })).toEqual({
      checkedFiles: 10,
      orderCount: 1,
      orderLineCount: 1,
      ledgerRowCount: 1,
      baselineLockCount: 1,
      recoveryChangeCount: 0,
    });
  });

  it("prefers the active publishable key when verifying anonymous RLS", () => {
    expect(resolveSupabasePublicKey({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_active",
      SUPABASE_ANON_KEY: "legacy-disabled",
    })).toBe("sb_publishable_active");
  });

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
    expect(plan.locks.every(lock => lock.locked_by === "codex@task-3-recovery")).toBe(true);
    expect(plan.locks.every(lock => lock.reason === "MAC drift baseline 2026-07-13")).toBe(true);
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
      locked_by: "codex@task-3-recovery",
      reason: "MAC drift baseline 2026-07-13",
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
      mismatchLineIds: ["line-2", "line-3", "line-outside"],
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
    locked_by: "codex@task-3-recovery",
    reason: "MAC drift baseline 2026-07-13",
    source_hash: "a".repeat(64),
    stored_cost_at_sale: stored,
    expected_cost_at_sale: expected,
    delta_vnd: expected - stored,
  };
}

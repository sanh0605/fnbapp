import { describe, expect, it } from "vitest";
import * as subject from "./btp-drift-lock";

describe("Task 3.7 BTP drift lock planner", () => {
  it("exports the pure planning and live-state assessment API", () => {
    expect(typeof (subject as any).buildBtpDriftLockPlan).toBe("function");
    expect(typeof (subject as any).assessBtpDriftLockLiveState).toBe("function");
    expect(typeof (subject as any).BTP_DRIFT_LOCK_REASON).toBe("string");
  });

  it("builds the exact 225-line policy cohort with a stable canonical hash", () => {
    const artifacts = makeArtifacts();
    const build = (subject as any).buildBtpDriftLockPlan;
    const plan = build(artifacts);
    const reordered = build({
      task34Raw: JSON.stringify({
        generated_at: "different",
        lines: [...JSON.parse(artifacts.task34Raw).lines].reverse(),
      }),
      task36Raw: JSON.stringify({
        generated_at: "different",
        lines: [...JSON.parse(artifacts.task36Raw).lines].reverse(),
      }),
    });

    expect(plan.line_count).toBe(225);
    expect(plan.total_delta_vnd).toBe(-193299);
    expect(plan.bucket_summary).toEqual([
      { bucket: "PRE_BASELINE_WINDOW", line_count: 90, delta_vnd: -107225 },
      { bucket: "BASELINE_SELECTION_GAP", line_count: 22, delta_vnd: -25662 },
      { bucket: "POST_CUTOFF_NEW_DRIFT", line_count: 71, delta_vnd: -67221 },
      { bucket: "LATE_PO_RECEIPT", line_count: 42, delta_vnd: 6809 },
    ]);
    expect(plan.records.map((row: any) => row.line_id)).toEqual(
      [...plan.records.map((row: any) => row.line_id)].sort(),
    );
    expect(plan.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered.source_hash).toBe(plan.source_hash);
  });

  it("rejects overlap with the excluded BACKDATED_LEDGER_LIKE bucket", () => {
    const artifacts = makeArtifacts();
    const task34 = JSON.parse(artifacts.task34Raw);
    const selected = task34.lines.find((line: any) => line.classification === "PRE_BASELINE_WINDOW");
    const excluded = task34.lines.find((line: any) => line.classification === "BACKDATED_LEDGER_LIKE");
    excluded.line_id = selected.line_id;

    expect(() => (subject as any).buildBtpDriftLockPlan({
      ...artifacts,
      task34Raw: JSON.stringify(task34),
    })).toThrow(/BACKDATED_LEDGER_LIKE overlap/);
  });

  it("rejects a source bucket count or signed delta that differs from policy", () => {
    const artifacts = makeArtifacts();
    const missing = JSON.parse(artifacts.task36Raw);
    missing.lines.pop();
    expect(() => (subject as any).buildBtpDriftLockPlan({
      ...artifacts,
      task36Raw: JSON.stringify(missing),
    })).toThrow(/LATE_PO_RECEIPT.*expected 42/i);

    const wrongDelta = JSON.parse(artifacts.task34Raw);
    const line = wrongDelta.lines.find((row: any) => row.classification === "BASELINE_SELECTION_GAP");
    line.delta_vnd += 2;
    line.expected_cost += 2;
    expect(() => (subject as any).buildBtpDriftLockPlan({
      ...artifacts,
      task34Raw: JSON.stringify(wrongDelta),
    })).toThrow(/BASELINE_SELECTION_GAP.*delta/i);
  });

  it("prepares 225 locks only when live rows match and the baseline count is 170", () => {
    const plan = (subject as any).buildBtpDriftLockPlan(makeArtifacts());
    const liveLines = plan.records.map((record: any) => ({
      id: record.line_id,
      order_id: record.order_id,
      cost_at_sale: record.stored_cost_at_sale,
    }));
    liveLines[0].cost_at_sale += 1;

    const assessment = (subject as any).assessBtpDriftLockLiveState({
      plan,
      liveLines,
      existingTargetLocks: [],
      totalExistingLockCount: 170,
    });

    expect(assessment.state).toBe("READY");
    expect(assessment.errors).toEqual([]);
    expect(assessment.locks).toHaveLength(225);
    expect(assessment.expected_total_after_apply).toBe(395);
    expect(assessment.locks[0]).toMatchObject({
      locked_by: "Codex Task 3.7",
      reason: (subject as any).BTP_DRIFT_LOCK_REASON,
      source_hash: plan.source_hash,
    });
    expect(assessment.locks.find((row: any) => row.order_line_id === liveLines[0].id)).toMatchObject({
      stored_cost_at_sale: liveLines[0].cost_at_sale,
    });
  });

  it("aborts on missing, edited, partial-lock, or unexpected baseline state", () => {
    const plan = (subject as any).buildBtpDriftLockPlan(makeArtifacts());
    const liveLines = plan.records.map((record: any) => ({
      id: record.line_id,
      order_id: record.order_id,
      cost_at_sale: record.stored_cost_at_sale,
    }));
    const assess = (overrides: Record<string, unknown>) => (
      (subject as any).assessBtpDriftLockLiveState({
        plan,
        liveLines,
        existingTargetLocks: [],
        totalExistingLockCount: 170,
        ...overrides,
      })
    );

    expect(assess({ liveLines: liveLines.slice(1) }).errors).toContainEqual(
      expect.objectContaining({ code: "MISSING_LINE", line_id: plan.records[0].line_id }),
    );
    expect(assess({
      liveLines: liveLines.map((row: any, index: number) => (
        index === 0 ? { ...row, cost_at_sale: row.cost_at_sale + 2 } : row
      )),
    }).errors).toContainEqual(expect.objectContaining({ code: "COST_AT_SALE_CHANGED" }));
    expect(assess({ existingTargetLocks: [{ order_line_id: plan.records[0].line_id }] }).errors)
      .toContainEqual(expect.objectContaining({ code: "EXISTING_LOCK_OVERLAP" }));
    expect(assess({ totalExistingLockCount: 171 }).errors)
      .toContainEqual(expect.objectContaining({ code: "BASELINE_LOCK_COUNT" }));
  });

  it("treats a complete exact cohort as an idempotent no-op", () => {
    const plan = (subject as any).buildBtpDriftLockPlan(makeArtifacts());
    const liveLines = plan.records.map((record: any) => ({
      id: record.line_id,
      order_id: record.order_id,
      cost_at_sale: record.stored_cost_at_sale,
    }));
    const ready = (subject as any).assessBtpDriftLockLiveState({
      plan,
      liveLines,
      existingTargetLocks: [],
      totalExistingLockCount: 170,
    });
    const rerun = (subject as any).assessBtpDriftLockLiveState({
      plan,
      liveLines,
      existingTargetLocks: ready.locks,
      totalExistingLockCount: 395,
    });

    expect(rerun.state).toBe("ALREADY_APPLIED");
    expect(rerun.errors).toEqual([]);
    expect(rerun.locks).toEqual([]);
    expect(rerun.expected_total_after_apply).toBe(395);
  });
});

function makeArtifacts(): { task34Raw: string; task36Raw: string } {
  let sequence = 0;
  const makeLine = (prefix: string, delta: number, extra: Record<string, unknown>) => {
    sequence += 1;
    const stored = 10000 + sequence;
    return {
      line_id: `${prefix}-${String(sequence).padStart(3, "0")}`,
      order_id: `order-${String(sequence).padStart(3, "0")}`,
      stored_cost: stored,
      expected_cost: stored + delta,
      delta_vnd: delta,
      ...extra,
    };
  };
  const task34Lines = [
    ...makeGroup(90, -107225).map(delta => makeLine("pre", delta, {
      classification: "PRE_BASELINE_WINDOW",
    })),
    ...makeGroup(22, -25662).map(delta => makeLine("gap", delta, {
      classification: "BASELINE_SELECTION_GAP",
    })),
    ...makeGroup(41, -43809).map(delta => makeLine("excluded", delta, {
      classification: "BACKDATED_LEDGER_LIKE",
    })),
  ];
  const task36Lines = [
    ...makeGroup(71, -67221).map(delta => {
      const row = makeLine("frozen", delta, {
        cohort: "FROZEN_71",
        mechanism: "RECIPE_OR_BATCH_YIELD_MUTATION",
      });
      return {
        ...row,
        current_replay_cost: row.expected_cost,
        current_delta_vnd: row.delta_vnd,
      };
    }),
    ...makeGroup(42, 6809).map(delta => {
      const row = makeLine("new", delta, {
        cohort: "NEW_42",
        mechanism: "LATE_PO_RECEIPT",
      });
      return {
        ...row,
        current_replay_cost: row.expected_cost,
        current_delta_vnd: row.delta_vnd,
      };
    }),
  ];
  return {
    task34Raw: JSON.stringify({ generated_at: "first", lines: task34Lines }),
    task36Raw: JSON.stringify({ generated_at: "first", lines: task36Lines }),
  };
}

function makeGroup(count: number, total: number): number[] {
  const base = Math.trunc(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index === 0 ? remainder : 0));
}

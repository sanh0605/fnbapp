import { describe, expect, it } from "vitest";
import * as subject from "./backdated-historical-gap-lock";

describe("Task 3.9 historical gap lock planner", () => {
  it("exports the pure planning and live-state assessment API", () => {
    expect(typeof (subject as any).buildBackdatedHistoricalGapLockPlan).toBe("function");
    expect(typeof (subject as any).assessBackdatedHistoricalGapLockLiveState).toBe("function");
    expect(typeof (subject as any).BACKDATED_HISTORICAL_GAP_LOCK_REASON).toBe("string");
  });

  it("builds the exact 41-line cohort with a stable canonical hash", () => {
    const artifact = makeArtifact();
    const build = (subject as any).buildBackdatedHistoricalGapLockPlan;
    const plan = build({ task38Raw: artifact });
    const parsed = JSON.parse(artifact);
    const reordered = build({
      task38Raw: JSON.stringify({
        generated_at: "different",
        lines: [...parsed.lines].reverse().map((line: any) => ({
          ignored: true,
          ...line,
          causal_backdated_ledger_ids: [...line.causal_backdated_ledger_ids].reverse(),
        })),
      }),
    });

    expect(plan.line_count).toBe(41);
    expect(plan.total_delta_vnd).toBe(-43809);
    expect(plan.historical_ledger_row_count).toBe(5);
    expect(plan.records.map((row: any) => row.line_id)).toEqual(
      [...plan.records.map((row: any) => row.line_id)].sort(),
    );
    expect(plan.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered.source_hash).toBe(plan.source_hash);
  });

  it("rejects duplicate IDs, non-gap coverage, or inconsistent signed delta", () => {
    const duplicate = JSON.parse(makeArtifact());
    duplicate.lines[1].line_id = duplicate.lines[0].line_id;
    expect(() => (subject as any).buildBackdatedHistoricalGapLockPlan({
      task38Raw: JSON.stringify(duplicate),
    })).toThrow(/duplicate line IDs/i);

    const covered = JSON.parse(makeArtifact());
    covered.lines[0].durable_event_coverage = "COVERED";
    expect(() => (subject as any).buildBackdatedHistoricalGapLockPlan({
      task38Raw: JSON.stringify(covered),
    })).toThrow(/HISTORICAL_GAP/);

    const wrongDelta = JSON.parse(makeArtifact());
    wrongDelta.lines[0].delta_vnd += 2;
    expect(() => (subject as any).buildBackdatedHistoricalGapLockPlan({
      task38Raw: JSON.stringify(wrongDelta),
    })).toThrow(/inconsistent signed delta/i);
  });

  it("rejects cohort counts, total delta, or historical ledger coverage outside policy", () => {
    const missing = JSON.parse(makeArtifact());
    missing.lines.pop();
    expect(() => (subject as any).buildBackdatedHistoricalGapLockPlan({
      task38Raw: JSON.stringify(missing),
    })).toThrow(/line count.*expected 41/i);

    const wrongTotal = JSON.parse(makeArtifact());
    wrongTotal.lines[0].expected_cost += 1;
    wrongTotal.lines[0].delta_vnd += 1;
    expect(() => (subject as any).buildBackdatedHistoricalGapLockPlan({
      task38Raw: JSON.stringify(wrongTotal),
    })).toThrow(/total delta.*expected -43809/i);

    const missingLedger = JSON.parse(makeArtifact());
    missingLedger.lines = missingLedger.lines.map((line: any) => ({
      ...line,
      causal_backdated_ledger_ids: line.causal_backdated_ledger_ids.map((id: string) => (
        id === "LEDGER-5" ? "LEDGER-1" : id
      )),
    }));
    expect(() => (subject as any).buildBackdatedHistoricalGapLockPlan({
      task38Raw: JSON.stringify(missingLedger),
    })).toThrow(/ledger row count.*expected 5/i);
  });

  it("prepares 41 locks only when live rows match and total existing locks are 395", () => {
    const plan = (subject as any).buildBackdatedHistoricalGapLockPlan({ task38Raw: makeArtifact() });
    const liveLines = plan.records.map((record: any) => ({
      id: record.line_id,
      order_id: record.order_id,
      cost_at_sale: record.stored_cost_at_sale,
    }));
    liveLines[0].cost_at_sale += 1;
    const assessment = (subject as any).assessBackdatedHistoricalGapLockLiveState({
      plan,
      liveLines,
      existingTargetLocks: [],
      totalExistingLockCount: 395,
    });

    expect(assessment.state).toBe("READY");
    expect(assessment.errors).toEqual([]);
    expect(assessment.locks).toHaveLength(41);
    expect(assessment.expected_total_after_apply).toBe(436);
    expect(assessment.locks[0]).toMatchObject({
      locked_by: "Codex Task 3.9",
      reason: (subject as any).BACKDATED_HISTORICAL_GAP_LOCK_REASON,
      source_hash: plan.source_hash,
    });
  });

  it("aborts on missing, edited, partial-overlap, or unexpected baseline state", () => {
    const plan = (subject as any).buildBackdatedHistoricalGapLockPlan({ task38Raw: makeArtifact() });
    const liveLines = plan.records.map((record: any) => ({
      id: record.line_id,
      order_id: record.order_id,
      cost_at_sale: record.stored_cost_at_sale,
    }));
    const assess = (overrides: Record<string, unknown>) => (
      (subject as any).assessBackdatedHistoricalGapLockLiveState({
        plan,
        liveLines,
        existingTargetLocks: [],
        totalExistingLockCount: 395,
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
    expect(assess({ totalExistingLockCount: 394 }).errors)
      .toContainEqual(expect.objectContaining({ code: "BASELINE_LOCK_COUNT" }));
  });

  it("treats the complete exact cohort as an idempotent no-op", () => {
    const plan = (subject as any).buildBackdatedHistoricalGapLockPlan({ task38Raw: makeArtifact() });
    const liveLines = plan.records.map((record: any) => ({
      id: record.line_id,
      order_id: record.order_id,
      cost_at_sale: record.stored_cost_at_sale,
    }));
    const ready = (subject as any).assessBackdatedHistoricalGapLockLiveState({
      plan,
      liveLines,
      existingTargetLocks: [],
      totalExistingLockCount: 395,
    });
    const rerun = (subject as any).assessBackdatedHistoricalGapLockLiveState({
      plan,
      liveLines,
      existingTargetLocks: ready.locks,
      totalExistingLockCount: 436,
    });

    expect(rerun.state).toBe("ALREADY_APPLIED");
    expect(rerun.errors).toEqual([]);
    expect(rerun.locks).toEqual([]);
    expect(rerun.expected_total_after_apply).toBe(436);
  });
});

function makeArtifact(): string {
  const ledgerIds = ["LEDGER-1", "LEDGER-2", "LEDGER-3", "LEDGER-4", "LEDGER-5"];
  const deltas = makeGroup(41, -43809);
  return JSON.stringify({
    generated_at: "ignored",
    lines: deltas.map((delta, index) => {
      const stored = 10000 + index;
      return {
        line_id: `line-${String(index).padStart(2, "0")}`,
        order_id: `order-${String(index).padStart(2, "0")}`,
        sale_time: `2026-06-${String(1 + (index % 28)).padStart(2, "0")}T00:00:00.000Z`,
        stored_cost: stored,
        expected_cost: stored + delta,
        delta_vnd: delta,
        causal_backdated_ledger_ids: index < 5 ? [ledgerIds[index]] : [ledgerIds[index % 5]],
        durable_event_coverage: "HISTORICAL_GAP",
      };
    }),
  });
}

function makeGroup(count: number, total: number): number[] {
  const base = Math.trunc(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < Math.abs(remainder) ? Math.sign(remainder) : 0));
}

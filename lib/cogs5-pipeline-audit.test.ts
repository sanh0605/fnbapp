import { describe, expect, it } from "vitest";
import { classifyCogs5PriorWrites } from "./cogs5-pipeline-audit";

describe("classifyCogs5PriorWrites", () => {
  it("separates Task 3.9 historical-gap writes from event-pipeline writes", () => {
    const result = classifyCogs5PriorWrites({
      events: [
        { id: "cogs5-event", notes: "COGS-5 full-system cost correction" },
        { id: "natural-event", notes: null },
      ],
      changes: [
        { run_id: "task-3.9-historical-gap-recovery-2026-07-21", row_id: "line-1", applied_at: "2026-07-21T00:00:00Z" },
        { run_id: "backdated-natural-event", row_id: "line-2", applied_at: "2026-07-21T01:00:00Z" },
        { run_id: "backdated-cogs5-event", row_id: "line-1", applied_at: "2026-07-22T00:00:00Z" },
        { run_id: "backdated-cogs5-event", row_id: "line-2", applied_at: "2026-07-22T00:00:00Z" },
        { run_id: "backdated-cogs5-event", row_id: "line-3", applied_at: "2026-07-22T00:00:00Z" },
      ],
    });

    expect(result).toEqual({
      cogs5EventCount: 1,
      cogs5TargetLineCount: 3,
      priorWriteLineCount: 2,
      task39HistoricalGapLineCount: 1,
      backdatedEventLineCount: 1,
      otherPriorWriteLineCount: 0,
      priorRunIds: [
        "backdated-natural-event",
        "task-3.9-historical-gap-recovery-2026-07-21",
      ],
    });
  });

  it("does not count writes made after the COGS-5 correction as prior evidence", () => {
    const result = classifyCogs5PriorWrites({
      events: [{ id: "cogs5-event", notes: "COGS-5 full-system cost correction" }],
      changes: [
        { run_id: "backdated-cogs5-event", row_id: "line-1", applied_at: "2026-07-22T00:00:00Z" },
        { run_id: "later-revert", row_id: "line-1", applied_at: "2026-07-22T01:00:00Z" },
      ],
    });

    expect(result.priorWriteLineCount).toBe(0);
    expect(result.priorRunIds).toEqual([]);
  });
});

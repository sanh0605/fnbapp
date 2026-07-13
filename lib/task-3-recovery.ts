import { createHash } from "node:crypto";

type BaselineLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  stored_cost: number;
  expected_cost: number;
  delta: number;
  classification: string;
};

type BaselineArtifact = {
  summary: { line_count: number };
  lines: BaselineLine[];
};

type InvestigationArtifact = {
  hypotheses: {
    H7_purchase_cost_recovery: {
      exact_line_count: number;
      exact_baseline_delta_vnd: number;
      lines: Array<{ line_id: string }>;
    };
  };
  line_replays?: Array<{
    line_id: string;
    consumed_item_ids?: string[];
  }>;
};

export type Task3BaselineLock = {
  order_line_id: string;
  locked_by: string;
  reason: string;
  source_hash: string;
  stored_cost_at_sale: number;
  expected_cost_at_sale: number;
  delta_vnd: number;
};

export type Task3RecoveryChange = {
  line_id: string;
  order_id: string;
  order_no: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
  delta_vnd: number;
  classification: string;
};

export type Task3RecoveryPlan = {
  run_id: string;
  source_hash: string;
  baseline_line_count: number;
  selected_line_count: number;
  total_delta_vnd: number;
  locks: Task3BaselineLock[];
  changes: Task3RecoveryChange[];
};

export type Task3SnapshotSelection = {
  orderLineIds: string[];
  orderIds: string[];
  itemReferences: string[];
};

export function resolveSupabasePublicKey(
  env: Record<string, string | undefined>,
): string | undefined {
  return env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
}

export function buildTask3RecoveryPlan(input: {
  baselineRaw: string;
  investigationRaw: string;
  runId: string;
}): Task3RecoveryPlan {
  if (!input.runId.trim()) {
    throw new Error("Task 3 recovery run ID is required");
  }
  const baseline = parseArtifact<BaselineArtifact>(input.baselineRaw, "baseline");
  const investigation = parseArtifact<InvestigationArtifact>(
    input.investigationRaw,
    "investigation",
  );
  if (!Array.isArray(baseline.lines)) {
    throw new Error("Baseline artifact lines must be an array");
  }
  if (baseline.summary?.line_count !== baseline.lines.length) {
    throw new Error(
      `Baseline line count mismatch: declared ${baseline.summary?.line_count}, actual ${baseline.lines.length}`,
    );
  }

  const sourceHash = createHash("sha256").update(input.baselineRaw).digest("hex");
  const baselineById = new Map<string, BaselineLine>();
  for (const line of baseline.lines) {
    assertBaselineLine(line);
    if (baselineById.has(line.line_id)) {
      throw new Error(`Duplicate baseline line ID: ${line.line_id}`);
    }
    baselineById.set(line.line_id, line);
  }

  const recovery = investigation.hypotheses?.H7_purchase_cost_recovery;
  if (!recovery || !Array.isArray(recovery.lines)) {
    throw new Error("Investigation artifact is missing H7 purchase-cost lines");
  }
  const selectedIds = recovery.lines.map(line => String(line.line_id || ""));
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error("Investigation artifact contains duplicate selective line IDs");
  }
  if (recovery.exact_line_count !== selectedIds.length) {
    throw new Error(
      `Selective line count mismatch: declared ${recovery.exact_line_count}, actual ${selectedIds.length}`,
    );
  }

  const selectedLines = selectedIds.map(lineId => {
    const line = baselineById.get(lineId);
    if (!line) {
      throw new Error(`Selective recovery line is absent from baseline: ${lineId}`);
    }
    return line;
  });
  const totalDelta = selectedLines.reduce((sum, line) => sum + line.delta, 0);
  if (totalDelta !== recovery.exact_baseline_delta_vnd) {
    throw new Error(
      `Selective delta mismatch: declared ${recovery.exact_baseline_delta_vnd}, actual ${totalDelta}`,
    );
  }

  const locks = [...baseline.lines]
    .sort(compareLineId)
    .map(line => ({
      order_line_id: line.line_id,
      locked_by: "codex@task-3-recovery",
      reason: "MAC drift baseline 2026-07-13",
      source_hash: sourceHash,
      stored_cost_at_sale: line.stored_cost,
      expected_cost_at_sale: line.expected_cost,
      delta_vnd: line.delta,
    }));
  const changes = selectedLines
    .sort(compareLineId)
    .map(line => ({
      line_id: line.line_id,
      order_id: line.order_id,
      order_no: line.order_no,
      old_cost_at_sale: line.stored_cost,
      new_cost_at_sale: line.expected_cost,
      delta_vnd: line.delta,
      classification: line.classification,
    }));

  return {
    run_id: input.runId,
    source_hash: sourceHash,
    baseline_line_count: locks.length,
    selected_line_count: changes.length,
    total_delta_vnd: totalDelta,
    locks,
    changes,
  };
}

export function buildTask3SnapshotSelection(
  plan: Task3RecoveryPlan,
  investigationRaw: string,
): Task3SnapshotSelection {
  const investigation = parseArtifact<InvestigationArtifact>(
    investigationRaw,
    "investigation",
  );
  const replayByLineId = new Map(
    (investigation.line_replays || []).map(replay => [replay.line_id, replay]),
  );
  const itemReferences = new Set<string>();
  for (const change of plan.changes) {
    const replay = replayByLineId.get(change.line_id);
    if (!replay) {
      throw new Error(`Investigation replay is missing for selected line: ${change.line_id}`);
    }
    for (const itemReference of replay.consumed_item_ids || []) {
      if (itemReference) itemReferences.add(itemReference);
    }
  }
  return {
    orderLineIds: plan.changes.map(change => change.line_id).sort(),
    orderIds: [...new Set(plan.changes.map(change => change.order_id))].sort(),
    itemReferences: [...itemReferences].sort(),
  };
}

export function assessTask3BaselineLocks(
  expected: Task3BaselineLock[],
  actual: Array<Partial<Task3BaselineLock>>,
): "EMPTY" | "MATCHED" {
  if (actual.length === 0) return "EMPTY";
  if (actual.length !== expected.length) {
    throw new Error("Existing audit baseline locks do not match the Task 3 plan");
  }
  const actualById = new Map(actual.map(lock => [String(lock.order_line_id || ""), lock]));
  for (const lock of expected) {
    const existing = actualById.get(lock.order_line_id);
    if (
      !existing
      || existing.locked_by !== lock.locked_by
      || existing.reason !== lock.reason
      || existing.source_hash !== lock.source_hash
      || Number(existing.stored_cost_at_sale) !== lock.stored_cost_at_sale
      || Number(existing.expected_cost_at_sale) !== lock.expected_cost_at_sale
      || Number(existing.delta_vnd) !== lock.delta_vnd
    ) {
      throw new Error("Existing audit baseline locks do not match the Task 3 plan");
    }
  }
  return "MATCHED";
}

export function verifyTask3RecoveryState(input: {
  plan: Task3RecoveryPlan;
  liveLines: Array<{ id: string; cost_at_sale: unknown }>;
  mismatchLineIds: string[];
  recoveryRows: Array<{
    run_id: string;
    row_id: string;
    table_name: string;
    column_name: string;
    old_value: unknown;
    new_value: unknown;
    source_hash: string;
    rolled_back_at?: unknown;
  }>;
}): {
  recoveredLineCount: number;
  untouchedLineCount: number;
  mismatchLineCount: number;
  mismatchLineDeltaVnd: number;
} {
  const liveById = new Map(input.liveLines.map(line => [line.id, line]));
  if (liveById.size !== input.plan.baseline_line_count) {
    throw new Error("Live baseline line set is incomplete or contains duplicates");
  }
  const selectedById = new Map(input.plan.changes.map(change => [change.line_id, change]));
  for (const lock of input.plan.locks) {
    const live = liveById.get(lock.order_line_id);
    if (!live) throw new Error(`Live baseline line is missing: ${lock.order_line_id}`);
    const actualCost = Number(live.cost_at_sale);
    const selected = selectedById.get(lock.order_line_id);
    if (selected) {
      if (actualCost !== selected.new_cost_at_sale) {
        throw new Error(`Selected order line was not recovered: ${lock.order_line_id}`);
      }
    } else if (actualCost !== lock.stored_cost_at_sale) {
      throw new Error(`Non-selected order line changed: ${lock.order_line_id}`);
    }
  }

  const expectedMismatchIds = new Set(
    input.plan.locks
      .filter(lock => !selectedById.has(lock.order_line_id) && lock.delta_vnd !== 0)
      .map(lock => lock.order_line_id),
  );
  const actualMismatchIds = new Set(input.mismatchLineIds);
  if (
    actualMismatchIds.size !== expectedMismatchIds.size
    || [...expectedMismatchIds].some(lineId => !actualMismatchIds.has(lineId))
  ) {
    throw new Error("Post-recovery mismatch lines do not match the non-selected baseline set");
  }

  if (input.recoveryRows.length !== input.plan.selected_line_count) {
    throw new Error("Recovery audit row count does not match the selected line count");
  }
  const recoveryByLineId = new Map(input.recoveryRows.map(row => [row.row_id, row]));
  for (const change of input.plan.changes) {
    const row = recoveryByLineId.get(change.line_id);
    if (
      !row
      || row.run_id !== input.plan.run_id
      || row.table_name !== "order_lines_v2"
      || row.column_name !== "cost_at_sale"
      || Number(row.old_value) !== change.old_cost_at_sale
      || Number(row.new_value) !== change.new_cost_at_sale
      || row.source_hash !== input.plan.source_hash
      || row.rolled_back_at != null
    ) {
      throw new Error(`Recovery audit row does not match plan: ${change.line_id}`);
    }
  }

  return {
    recoveredLineCount: input.plan.selected_line_count,
    untouchedLineCount: input.plan.baseline_line_count - input.plan.selected_line_count,
    mismatchLineCount: expectedMismatchIds.size,
    mismatchLineDeltaVnd: input.plan.locks
      .filter(lock => expectedMismatchIds.has(lock.order_line_id))
      .reduce((sum, lock) => sum + lock.delta_vnd, 0),
  };
}

function parseArtifact<T>(raw: string, name: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid ${name} artifact JSON`);
  }
}

function assertBaselineLine(line: BaselineLine): void {
  if (!line?.line_id || !line.order_id || !line.order_no) {
    throw new Error("Baseline line is missing an identity field");
  }
  for (const [field, value] of [
    ["stored_cost", line.stored_cost],
    ["expected_cost", line.expected_cost],
    ["delta", line.delta],
  ] as const) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Baseline line ${line.line_id} has invalid ${field}`);
    }
  }
  if (line.expected_cost - line.stored_cost !== line.delta) {
    throw new Error(`Baseline line ${line.line_id} has an inconsistent delta`);
  }
}

function compareLineId(left: BaselineLine, right: BaselineLine): number {
  return left.line_id.localeCompare(right.line_id);
}

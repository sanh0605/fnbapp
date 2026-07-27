import { createHash } from "node:crypto";

export const BACKDATED_HISTORICAL_GAP_LOCK_REASON =
  "BACKDATED_LEDGER_HISTORICAL_GAP — migration 0014 historical backfill gap, no durable event, see Task 3.8 report 2026-07-16";
export const BACKDATED_HISTORICAL_GAP_LOCKED_BY = "Codex Task 3.9";
export const BACKDATED_HISTORICAL_GAP_INITIAL_LOCK_COUNT = 395;
export const BACKDATED_HISTORICAL_GAP_FINAL_LOCK_COUNT = 436;

export type BackdatedHistoricalGapSourceRecord = {
  line_id: string;
  order_id: string;
  sale_time: string;
  stored_cost_at_sale: number;
  expected_cost_at_sale: number;
  delta_vnd: number;
  historical_causal_ledger_rows: string[];
  durable_coverage: "HISTORICAL_GAP";
};

export type BackdatedHistoricalGapLockRow = {
  order_line_id: string;
  locked_by: string;
  reason: string;
  source_hash: string;
  stored_cost_at_sale: number;
  expected_cost_at_sale: number;
  delta_vnd: number;
};

export type BackdatedHistoricalGapLockPlan = {
  source_hash: string;
  line_count: number;
  total_delta_vnd: number;
  historical_ledger_row_count: number;
  historical_ledger_row_ids: string[];
  records: BackdatedHistoricalGapSourceRecord[];
};

export type BackdatedHistoricalGapLiveLine = {
  id: string;
  order_id: string;
  cost_at_sale: string | number;
};

export type BackdatedHistoricalGapExistingLock = Partial<BackdatedHistoricalGapLockRow> & {
  order_line_id: string;
};

export type BackdatedHistoricalGapValidationError = {
  code:
    | "MISSING_LINE"
    | "ORDER_ID_CHANGED"
    | "COST_AT_SALE_CHANGED"
    | "DELTA_CHANGED"
    | "EXISTING_LOCK_OVERLAP"
    | "BASELINE_LOCK_COUNT";
  line_id?: string;
  message: string;
};

export type BackdatedHistoricalGapLiveAssessment = {
  state: "READY" | "ALREADY_APPLIED" | "INVALID";
  errors: BackdatedHistoricalGapValidationError[];
  locks: BackdatedHistoricalGapLockRow[];
  existing_target_lock_count: number;
  expected_total_after_apply: number;
};

type RawRow = Record<string, unknown>;

export function buildBackdatedHistoricalGapLockPlan(input: {
  task38Raw: string;
}): BackdatedHistoricalGapLockPlan {
  const records = parseArtifact(input.task38Raw)
    .map(normalizeRecord)
    .sort((left, right) => left.line_id.localeCompare(right.line_id));
  const duplicateIds = findDuplicates(records.map(record => record.line_id));
  if (duplicateIds.length > 0) {
    throw new Error(`Task 3.9 source contains duplicate line IDs: ${duplicateIds.join(", ")}`);
  }

  for (const record of records) {
    if (record.expected_cost_at_sale - record.stored_cost_at_sale !== record.delta_vnd) {
      throw new Error(`Line ${record.line_id} has inconsistent signed delta`);
    }
    if (record.durable_coverage !== "HISTORICAL_GAP") {
      throw new Error(`Line ${record.line_id} must have HISTORICAL_GAP durable coverage`);
    }
    if (record.historical_causal_ledger_rows.length < 1
      || record.historical_causal_ledger_rows.length > 3) {
      throw new Error(`Line ${record.line_id} must map to 1-3 historical causal ledger rows`);
    }
  }

  if (records.length !== 41) {
    throw new Error(`Task 3.9 source line count is ${records.length}, expected 41`);
  }
  const totalDelta = sum(records.map(record => record.delta_vnd));
  if (totalDelta !== -43809) {
    throw new Error(`Task 3.9 total delta is ${totalDelta}, expected -43809`);
  }
  const ledgerIds = unique(records.flatMap(record => record.historical_causal_ledger_rows));
  if (ledgerIds.length !== 5) {
    throw new Error(`Task 3.9 historical ledger row count is ${ledgerIds.length}, expected 5`);
  }

  const canonical = JSON.stringify(records.map(record => ({
    line_id: record.line_id,
    order_id: record.order_id,
    sale_time: record.sale_time,
    stored_cost_at_sale: record.stored_cost_at_sale,
    expected_cost_at_sale: record.expected_cost_at_sale,
    delta_vnd: record.delta_vnd,
    historical_causal_ledger_rows: record.historical_causal_ledger_rows,
    durable_coverage: record.durable_coverage,
  })));
  return {
    source_hash: createHash("sha256").update(canonical, "utf8").digest("hex"),
    line_count: records.length,
    total_delta_vnd: totalDelta,
    historical_ledger_row_count: ledgerIds.length,
    historical_ledger_row_ids: ledgerIds,
    records,
  };
}

export function assessBackdatedHistoricalGapLockLiveState(input: {
  plan: BackdatedHistoricalGapLockPlan;
  liveLines: BackdatedHistoricalGapLiveLine[];
  existingTargetLocks: BackdatedHistoricalGapExistingLock[];
  totalExistingLockCount: number;
}): BackdatedHistoricalGapLiveAssessment {
  const errors: BackdatedHistoricalGapValidationError[] = [];
  const liveById = new Map(input.liveLines.map(line => [text(line.id), line]));
  const existingById = new Map(input.existingTargetLocks.map(lock => [text(lock.order_line_id), lock]));
  const preparedLocks: BackdatedHistoricalGapLockRow[] = [];

  for (const record of input.plan.records) {
    const live = liveById.get(record.line_id);
    if (!live) {
      errors.push({
        code: "MISSING_LINE",
        line_id: record.line_id,
        message: `Order line ${record.line_id} is missing`,
      });
      continue;
    }
    if (text(live.order_id) !== record.order_id) {
      errors.push({
        code: "ORDER_ID_CHANGED",
        line_id: record.line_id,
        message: `Order line ${record.line_id} moved from ${record.order_id} to ${text(live.order_id)}`,
      });
    }
    const currentStored = integer(live.cost_at_sale, `Live cost_at_sale ${record.line_id}`);
    if (Math.abs(currentStored - record.stored_cost_at_sale) > 1) {
      errors.push({
        code: "COST_AT_SALE_CHANGED",
        line_id: record.line_id,
        message: `Order line ${record.line_id} cost_at_sale is ${currentStored}, source recorded ${record.stored_cost_at_sale}`,
      });
    }
    const currentDelta = record.expected_cost_at_sale - currentStored;
    if (Math.abs(currentDelta - record.delta_vnd) > 1) {
      errors.push({
        code: "DELTA_CHANGED",
        line_id: record.line_id,
        message: `Order line ${record.line_id} delta is ${currentDelta}, source recorded ${record.delta_vnd}`,
      });
    }
    preparedLocks.push({
      order_line_id: record.line_id,
      locked_by: BACKDATED_HISTORICAL_GAP_LOCKED_BY,
      reason: BACKDATED_HISTORICAL_GAP_LOCK_REASON,
      source_hash: input.plan.source_hash,
      stored_cost_at_sale: currentStored,
      expected_cost_at_sale: record.expected_cost_at_sale,
      delta_vnd: currentDelta,
    });
  }

  if (input.existingTargetLocks.length === 0) {
    if (input.totalExistingLockCount !== BACKDATED_HISTORICAL_GAP_INITIAL_LOCK_COUNT) {
      errors.push({
        code: "BASELINE_LOCK_COUNT",
        message: `Existing lock count is ${input.totalExistingLockCount}, expected ${BACKDATED_HISTORICAL_GAP_INITIAL_LOCK_COUNT} before apply`,
      });
    }
  } else {
    const exactCompleteCohort = existingById.size === input.plan.line_count
      && preparedLocks.every(expected => lockMatches(existingById.get(expected.order_line_id), expected));
    if (!exactCompleteCohort) {
      errors.push({
        code: "EXISTING_LOCK_OVERLAP",
        message: `Found ${existingById.size}/41 target locks, but they do not form the exact approved cohort`,
      });
    } else if (input.totalExistingLockCount !== BACKDATED_HISTORICAL_GAP_FINAL_LOCK_COUNT) {
      errors.push({
        code: "BASELINE_LOCK_COUNT",
        message: `Existing lock count is ${input.totalExistingLockCount}, expected ${BACKDATED_HISTORICAL_GAP_FINAL_LOCK_COUNT} after apply`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      state: "INVALID",
      errors,
      locks: [],
      existing_target_lock_count: existingById.size,
      expected_total_after_apply: BACKDATED_HISTORICAL_GAP_FINAL_LOCK_COUNT,
    };
  }
  if (existingById.size === input.plan.line_count) {
    return {
      state: "ALREADY_APPLIED",
      errors: [],
      locks: [],
      existing_target_lock_count: existingById.size,
      expected_total_after_apply: BACKDATED_HISTORICAL_GAP_FINAL_LOCK_COUNT,
    };
  }
  return {
    state: "READY",
    errors: [],
    locks: preparedLocks.sort((left, right) => left.order_line_id.localeCompare(right.order_line_id)),
    existing_target_lock_count: 0,
    expected_total_after_apply: input.totalExistingLockCount + preparedLocks.length,
  };
}

function parseArtifact(raw: string): RawRow[] {
  const parsed = JSON.parse(raw) as { lines?: unknown };
  if (!Array.isArray(parsed.lines)) throw new Error("Task 3.8 artifact must contain a lines array");
  return parsed.lines as RawRow[];
}

function normalizeRecord(row: RawRow): BackdatedHistoricalGapSourceRecord {
  const coverage = requiredText(row.durable_event_coverage, "Task 3.8 durable_event_coverage");
  if (coverage !== "HISTORICAL_GAP") {
    throw new Error(`Task 3.8 durable coverage must be HISTORICAL_GAP, received ${coverage}`);
  }
  if (!Array.isArray(row.causal_backdated_ledger_ids)) {
    throw new Error("Task 3.8 causal_backdated_ledger_ids must be an array");
  }
  return {
    line_id: requiredText(row.line_id, "Task 3.8 line_id"),
    order_id: requiredText(row.order_id, "Task 3.8 order_id"),
    sale_time: requiredText(row.sale_time, "Task 3.8 sale_time"),
    stored_cost_at_sale: integer(row.stored_cost, "Task 3.8 stored_cost"),
    expected_cost_at_sale: integer(row.expected_cost, "Task 3.8 expected_cost"),
    delta_vnd: integer(row.delta_vnd, "Task 3.8 delta_vnd"),
    historical_causal_ledger_rows: unique(row.causal_backdated_ledger_ids.map(value => requiredText(value, "Task 3.8 causal ledger ID"))),
    durable_coverage: "HISTORICAL_GAP",
  };
}

function lockMatches(
  actual: BackdatedHistoricalGapExistingLock | undefined,
  expected: BackdatedHistoricalGapLockRow,
): boolean {
  return Boolean(actual)
    && text(actual?.locked_by) === expected.locked_by
    && text(actual?.reason) === expected.reason
    && text(actual?.source_hash) === expected.source_hash
    && Number(actual?.stored_cost_at_sale) === expected.stored_cost_at_sale
    && Number(actual?.expected_cost_at_sale) === expected.expected_cost_at_sale
    && Number(actual?.delta_vnd) === expected.delta_vnd;
}

function requiredText(value: unknown, label: string): string {
  const normalized = text(value).trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function integer(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} must be a safe integer`);
  return parsed;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

import { createHash } from "node:crypto";

export const BTP_DRIFT_LOCK_REASON =
  "BTP_RECIPE_REPLAY_DRIFT — temporal asymmetry, stored COGS correct at sale time, see policy doc 2026-07-16";
export const BTP_DRIFT_LOCKED_BY = "Codex Task 3.7";
export const BTP_DRIFT_INITIAL_LOCK_COUNT = 170;
export const BTP_DRIFT_FINAL_LOCK_COUNT = 395;

export type BtpDriftBucket =
  | "PRE_BASELINE_WINDOW"
  | "BASELINE_SELECTION_GAP"
  | "POST_CUTOFF_NEW_DRIFT"
  | "LATE_PO_RECEIPT";

export type BtpDriftSourceRecord = {
  line_id: string;
  order_id: string;
  bucket: BtpDriftBucket;
  stored_cost_at_sale: number;
  expected_cost_at_sale: number;
  delta_vnd: number;
};

export type BtpDriftLockRow = {
  order_line_id: string;
  locked_by: string;
  reason: string;
  source_hash: string;
  stored_cost_at_sale: number;
  expected_cost_at_sale: number;
  delta_vnd: number;
};

export type BtpDriftLockPlan = {
  source_hash: string;
  line_count: number;
  total_delta_vnd: number;
  bucket_summary: Array<{
    bucket: BtpDriftBucket;
    line_count: number;
    delta_vnd: number;
  }>;
  records: BtpDriftSourceRecord[];
};

export type BtpDriftLiveLine = {
  id: string;
  order_id: string;
  cost_at_sale: string | number;
};

export type BtpDriftExistingLock = Partial<BtpDriftLockRow> & {
  order_line_id: string;
};

export type BtpDriftValidationError = {
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

export type BtpDriftLiveAssessment = {
  state: "READY" | "ALREADY_APPLIED" | "INVALID";
  errors: BtpDriftValidationError[];
  locks: BtpDriftLockRow[];
  existing_target_lock_count: number;
  expected_total_after_apply: number;
};

const BUCKET_POLICY: Array<{
  bucket: BtpDriftBucket;
  count: number;
  delta: number;
}> = [
  { bucket: "PRE_BASELINE_WINDOW", count: 90, delta: -107225 },
  { bucket: "BASELINE_SELECTION_GAP", count: 22, delta: -25662 },
  { bucket: "POST_CUTOFF_NEW_DRIFT", count: 71, delta: -67221 },
  { bucket: "LATE_PO_RECEIPT", count: 42, delta: 6809 },
];

type RawRow = Record<string, unknown>;

export function buildBtpDriftLockPlan(input: {
  task34Raw: string;
  task36Raw: string;
}): BtpDriftLockPlan {
  const task34 = parseArtifact(input.task34Raw, "Task 3.4");
  const task36 = parseArtifact(input.task36Raw, "Task 3.6");
  const excludedBackdatedIds = new Set(
    task34.lines
      .filter(row => text(row.classification) === "BACKDATED_LEDGER_LIKE")
      .map(row => requiredText(row.line_id, "Task 3.4 BACKDATED_LEDGER_LIKE line_id")),
  );

  const records: BtpDriftSourceRecord[] = [
    ...task34.lines
      .filter(row => ["PRE_BASELINE_WINDOW", "BASELINE_SELECTION_GAP"].includes(text(row.classification)))
      .map(row => normalizeTask34Record(row)),
    ...task36.lines
      .filter(row => ["FROZEN_71", "NEW_42"].includes(text(row.cohort)))
      .map(row => normalizeTask36Record(row)),
  ].sort((left, right) => left.line_id.localeCompare(right.line_id));

  const duplicateIds = findDuplicates(records.map(row => row.line_id));
  if (duplicateIds.length > 0) {
    throw new Error(`Task 3.7 source contains duplicate line IDs: ${duplicateIds.join(", ")}`);
  }
  const excludedOverlap = records
    .filter(row => excludedBackdatedIds.has(row.line_id))
    .map(row => row.line_id);
  if (excludedOverlap.length > 0) {
    throw new Error(`BACKDATED_LEDGER_LIKE overlap: ${excludedOverlap.join(", ")}`);
  }

  for (const record of records) {
    if (record.expected_cost_at_sale - record.stored_cost_at_sale !== record.delta_vnd) {
      throw new Error(
        `${record.bucket} line ${record.line_id} has inconsistent signed delta`,
      );
    }
  }

  const bucketSummary = BUCKET_POLICY.map(policy => {
    const rows = records.filter(row => row.bucket === policy.bucket);
    const delta = sum(rows.map(row => row.delta_vnd));
    if (rows.length !== policy.count) {
      throw new Error(`${policy.bucket} line count is ${rows.length}, expected ${policy.count}`);
    }
    if (delta !== policy.delta) {
      throw new Error(`${policy.bucket} delta is ${delta}, expected ${policy.delta}`);
    }
    return { bucket: policy.bucket, line_count: rows.length, delta_vnd: delta };
  });
  if (records.length !== 225) {
    throw new Error(`Task 3.7 source line count is ${records.length}, expected 225`);
  }

  const canonical = JSON.stringify(records.map(record => ({
    line_id: record.line_id,
    order_id: record.order_id,
    bucket: record.bucket,
    stored_cost_at_sale: record.stored_cost_at_sale,
    expected_cost_at_sale: record.expected_cost_at_sale,
    delta_vnd: record.delta_vnd,
  })));
  return {
    source_hash: createHash("sha256").update(canonical, "utf8").digest("hex"),
    line_count: records.length,
    total_delta_vnd: sum(records.map(row => row.delta_vnd)),
    bucket_summary: bucketSummary,
    records,
  };
}

export function assessBtpDriftLockLiveState(input: {
  plan: BtpDriftLockPlan;
  liveLines: BtpDriftLiveLine[];
  existingTargetLocks: BtpDriftExistingLock[];
  totalExistingLockCount: number;
}): BtpDriftLiveAssessment {
  const errors: BtpDriftValidationError[] = [];
  const liveById = new Map(input.liveLines.map(row => [text(row.id), row]));
  const existingById = new Map(input.existingTargetLocks.map(row => [text(row.order_line_id), row]));
  const preparedLocks: BtpDriftLockRow[] = [];

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
      locked_by: BTP_DRIFT_LOCKED_BY,
      reason: BTP_DRIFT_LOCK_REASON,
      source_hash: input.plan.source_hash,
      stored_cost_at_sale: currentStored,
      expected_cost_at_sale: record.expected_cost_at_sale,
      delta_vnd: currentDelta,
    });
  }

  if (input.existingTargetLocks.length === 0) {
    if (input.totalExistingLockCount !== BTP_DRIFT_INITIAL_LOCK_COUNT) {
      errors.push({
        code: "BASELINE_LOCK_COUNT",
        message: `Existing lock count is ${input.totalExistingLockCount}, expected ${BTP_DRIFT_INITIAL_LOCK_COUNT} before apply`,
      });
    }
  } else {
    const exactCompleteCohort = existingById.size === input.plan.line_count
      && preparedLocks.every(expected => lockMatches(existingById.get(expected.order_line_id), expected));
    if (!exactCompleteCohort) {
      errors.push({
        code: "EXISTING_LOCK_OVERLAP",
        message: `Found ${existingById.size}/225 target locks, but they do not form the exact approved cohort`,
      });
    } else if (input.totalExistingLockCount !== BTP_DRIFT_FINAL_LOCK_COUNT) {
      errors.push({
        code: "BASELINE_LOCK_COUNT",
        message: `Existing lock count is ${input.totalExistingLockCount}, expected ${BTP_DRIFT_FINAL_LOCK_COUNT} after apply`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      state: "INVALID",
      errors,
      locks: [],
      existing_target_lock_count: existingById.size,
      expected_total_after_apply: BTP_DRIFT_FINAL_LOCK_COUNT,
    };
  }
  if (existingById.size === input.plan.line_count) {
    return {
      state: "ALREADY_APPLIED",
      errors: [],
      locks: [],
      existing_target_lock_count: existingById.size,
      expected_total_after_apply: BTP_DRIFT_FINAL_LOCK_COUNT,
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

function normalizeTask34Record(row: RawRow): BtpDriftSourceRecord {
  const bucket = requiredBucket(row.classification, "Task 3.4 classification");
  return {
    line_id: requiredText(row.line_id, "Task 3.4 line_id"),
    order_id: requiredText(row.order_id, "Task 3.4 order_id"),
    bucket,
    stored_cost_at_sale: integer(row.stored_cost, "Task 3.4 stored_cost"),
    expected_cost_at_sale: integer(row.expected_cost, "Task 3.4 expected_cost"),
    delta_vnd: integer(row.delta_vnd, "Task 3.4 delta_vnd"),
  };
}

function normalizeTask36Record(row: RawRow): BtpDriftSourceRecord {
  const cohort = requiredText(row.cohort, "Task 3.6 cohort");
  const bucket: BtpDriftBucket = cohort === "FROZEN_71"
    ? "POST_CUTOFF_NEW_DRIFT"
    : cohort === "NEW_42" && text(row.mechanism) === "LATE_PO_RECEIPT"
      ? "LATE_PO_RECEIPT"
      : (() => { throw new Error(`Unexpected Task 3.6 cohort/mechanism: ${cohort}/${text(row.mechanism)}`); })();
  return {
    line_id: requiredText(row.line_id, "Task 3.6 line_id"),
    order_id: requiredText(row.order_id, "Task 3.6 order_id"),
    bucket,
    stored_cost_at_sale: integer(row.stored_cost, "Task 3.6 stored_cost"),
    expected_cost_at_sale: integer(row.current_replay_cost, "Task 3.6 current_replay_cost"),
    delta_vnd: integer(row.current_delta_vnd, "Task 3.6 current_delta_vnd"),
  };
}

function parseArtifact(raw: string, label: string): { lines: RawRow[] } {
  const parsed = JSON.parse(raw) as { lines?: unknown };
  if (!Array.isArray(parsed.lines)) throw new Error(`${label} artifact must contain a lines array`);
  return { lines: parsed.lines as RawRow[] };
}

function requiredBucket(value: unknown, label: string): BtpDriftBucket {
  const normalized = requiredText(value, label);
  if (normalized === "PRE_BASELINE_WINDOW" || normalized === "BASELINE_SELECTION_GAP") {
    return normalized;
  }
  throw new Error(`${label} is not an approved Task 3.7 bucket: ${normalized}`);
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

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function lockMatches(actual: BtpDriftExistingLock | undefined, expected: BtpDriftLockRow): boolean {
  return Boolean(actual)
    && text(actual?.locked_by) === expected.locked_by
    && text(actual?.reason) === expected.reason
    && text(actual?.source_hash) === expected.source_hash
    && Number(actual?.stored_cost_at_sale) === expected.stored_cost_at_sale
    && Number(actual?.expected_cost_at_sale) === expected.expected_cost_at_sale
    && Number(actual?.delta_vnd) === expected.delta_vnd;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

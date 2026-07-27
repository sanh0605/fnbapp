import type {
  MacCogsDriftAuditReport,
  MacCogsLineMismatch,
} from "@/lib/mac-cogs-audit";
import { createHash } from "node:crypto";

export type MacDriftOrder = {
  id: string;
  order_no?: string;
  created_at?: string;
  migration_notes?: string;
};

export type MacDriftOrderEvent = {
  order_id?: string;
  event_type?: string;
};

export type MacDriftBaselineLine = MacCogsLineMismatch & {
  isMigratedOrder: boolean;
  hasMigrationNotes: boolean;
  isAfterBaselineDocument: boolean;
};

export type MacDriftBaselineReport = {
  lineCount: number;
  totalDelta: number;
  mismatchedLineDelta: number;
  migratedOrderCount: number;
  nonMigratedOrderCount: number;
  afterBaselineDocumentCount: number;
  afterBaselineDocumentDelta: number;
  byDate: Array<{ date: string; count: number; delta: number }>;
  byClassification: Array<{ classification: string; count: number; delta: number }>;
  byProduct: Array<{ product_id: string; count: number; delta: number }>;
  lines: MacDriftBaselineLine[];
};

export type MacDriftRecoveryChange = {
  line_id: string;
  order_id: string;
  order_no: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
  delta_vnd: number;
  classification: string;
};

export type MacDriftRecoveryPlan = {
  run_id: string;
  source_hash: string;
  changes: MacDriftRecoveryChange[];
};

export const MAC_DRIFT_AUDIT_CATEGORIES = [
  "LOCKED_MATCHED",
  "LOCKED_VIOLATION",
  "KNOWN_NOT_LOCKED",
  "NEW_INVESTIGATION_NEEDED",
] as const;

export type MacDriftAuditCategory = typeof MAC_DRIFT_AUDIT_CATEGORIES[number];

export const LOCKED_VIOLATION_SUBCATEGORIES = [
  "LOCKED_VIOLATION_STORED",
  "LOCKED_VIOLATION_REPLAY",
] as const;

export type LockedViolationSubcategory =
  typeof LOCKED_VIOLATION_SUBCATEGORIES[number];

export type MacDriftBaselineLock = {
  order_line_id: string;
  reason: string;
  source_hash: string | null;
  stored_cost_at_sale: number | null;
  expected_cost_at_sale: number | null;
};

export type KnownMacDriftCohortArtifact = {
  path: string;
  sourceHash: string;
  lineIds: ReadonlySet<string>;
};

export type ClassifiedMacDriftLine = MacCogsLineMismatch & {
  audit_category: MacDriftAuditCategory;
  lock_reason?: string;
  lock_source_hash?: string | null;
  locked_stored_cost_at_sale?: number | null;
  locked_expected_cost_at_sale?: number | null;
  locked_violation_subcategory?: LockedViolationSubcategory;
  violation_fields?: string[];
  known_artifact_path?: string;
  known_artifact_source_hash?: string;
};

export type ClassifiedMacDriftReport = {
  isOperationallyClean: boolean;
  summary: Record<MacDriftAuditCategory, number>;
  lockedViolationSummary: Record<LockedViolationSubcategory, number>;
  cohortBreakdown: Array<{ cohort: string; count: number; delta: number }>;
  lines: ClassifiedMacDriftLine[];
};

export const FROZEN_MAC_DRIFT_BASELINE_PATH =
  "docs/audits/2026-07-09-mac-drift-baseline-lines.json";

export function classifyMacDriftMismatches(input: {
  mismatches: MacCogsLineMismatch[];
  locks: MacDriftBaselineLock[];
  knownCohortArtifacts: KnownMacDriftCohortArtifact[];
}): ClassifiedMacDriftReport {
  const lockByLineId = new Map(input.locks.map(lock => [lock.order_line_id, lock]));
  const summary = Object.fromEntries(
    MAC_DRIFT_AUDIT_CATEGORIES.map(category => [category, 0]),
  ) as Record<MacDriftAuditCategory, number>;
  const lockedViolationSummary = Object.fromEntries(
    LOCKED_VIOLATION_SUBCATEGORIES.map(category => [category, 0]),
  ) as Record<LockedViolationSubcategory, number>;

  const lines = input.mismatches.map(line => {
    const lock = lockByLineId.get(line.line_id);
    let classified: ClassifiedMacDriftLine;

    if (lock) {
      const violationFields: string[] = [];
      if (line.stored_cost !== lock.stored_cost_at_sale) {
        violationFields.push("stored_cost_at_sale");
      }
      if (line.expected_cost !== lock.expected_cost_at_sale) {
        violationFields.push("expected_cost_at_sale");
      }
      const auditCategory: MacDriftAuditCategory = violationFields.length === 0
        ? "LOCKED_MATCHED"
        : "LOCKED_VIOLATION";
      const violationSubcategory: LockedViolationSubcategory | undefined =
        violationFields.includes("stored_cost_at_sale")
          ? "LOCKED_VIOLATION_STORED"
          : violationFields.length > 0
            ? "LOCKED_VIOLATION_REPLAY"
            : undefined;
      classified = {
        ...line,
        audit_category: auditCategory,
        lock_reason: lock.reason,
        lock_source_hash: lock.source_hash,
        locked_stored_cost_at_sale: lock.stored_cost_at_sale,
        locked_expected_cost_at_sale: lock.expected_cost_at_sale,
        ...(violationSubcategory
          ? { locked_violation_subcategory: violationSubcategory }
          : {}),
        ...(violationFields.length > 0 ? { violation_fields: violationFields } : {}),
      };
    } else {
      const artifact = input.knownCohortArtifacts.find(candidate =>
        candidate.lineIds.has(line.line_id),
      );
      classified = artifact
        ? {
            ...line,
            audit_category: "KNOWN_NOT_LOCKED",
            known_artifact_path: artifact.path,
            known_artifact_source_hash: artifact.sourceHash,
          }
        : { ...line, audit_category: "NEW_INVESTIGATION_NEEDED" };
    }

    summary[classified.audit_category] += 1;
    if (classified.locked_violation_subcategory) {
      lockedViolationSummary[classified.locked_violation_subcategory] += 1;
    }
    return classified;
  });

  const cohortMap = new Map<string, { count: number; delta: number }>();
  for (const line of lines) {
    if (line.audit_category !== "LOCKED_MATCHED" || !line.lock_reason) continue;
    const current = cohortMap.get(line.lock_reason) || { count: 0, delta: 0 };
    current.count += 1;
    current.delta += line.delta;
    cohortMap.set(line.lock_reason, current);
  }

  return {
    isOperationallyClean:
      lockedViolationSummary.LOCKED_VIOLATION_STORED === 0 &&
      summary.KNOWN_NOT_LOCKED === 0 &&
      summary.NEW_INVESTIGATION_NEEDED === 0,
    summary,
    lockedViolationSummary,
    cohortBreakdown: Array.from(cohortMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cohort, value]) => ({ cohort, ...value })),
    lines,
  };
}

export function buildMacDriftAuditOutputPath(
  now: Date,
  outputPath?: string,
): string {
  const path = outputPath ||
    `docs/audits/${now.toISOString().slice(0, 10)}-mac-drift-baseline-audit.json`;
  if (normalizePath(path) === normalizePath(FROZEN_MAC_DRIFT_BASELINE_PATH)) {
    throw new Error(`Refusing to overwrite frozen baseline artifact: ${path}`);
  }
  return path;
}

export function getMacDriftAuditExitCode(
  report: Pick<ClassifiedMacDriftReport, "isOperationallyClean">,
): 0 | 1 {
  return report.isOperationallyClean ? 0 : 1;
}

export function buildMacDriftBaselineReport(input: {
  drift: MacCogsDriftAuditReport;
  orders: MacDriftOrder[];
  events: MacDriftOrderEvent[];
  baselineDocumentDate?: string;
}): MacDriftBaselineReport {
  const baselineDocumentMs = new Date(input.baselineDocumentDate || "2026-07-02T23:59:59.999Z").getTime();
  const ordersById = new Map(input.orders.map(order => [order.id, order]));
  const migratedOrderIds = new Set(
    input.events
      .filter(event => event.event_type === "MIGRATED" && event.order_id)
      .map(event => event.order_id as string),
  );

  const lines = input.drift.lineMismatches.map(line => {
    const order = ordersById.get(line.order_id);
    const orderCreatedMs = new Date(order?.created_at || line.created_at || 0).getTime();
    const hasMigrationNotes = Boolean(order?.migration_notes);
    return {
      ...line,
      isMigratedOrder: migratedOrderIds.has(line.order_id) || hasMigrationNotes,
      hasMigrationNotes,
      isAfterBaselineDocument: Number.isFinite(orderCreatedMs) && orderCreatedMs > baselineDocumentMs,
    };
  });

  return {
    lineCount: lines.length,
    totalDelta: input.drift.totalDelta,
    mismatchedLineDelta: sum(lines.map(line => line.delta)),
    migratedOrderCount: lines.filter(line => line.isMigratedOrder).length,
    nonMigratedOrderCount: lines.filter(line => !line.isMigratedOrder).length,
    afterBaselineDocumentCount: lines.filter(line => line.isAfterBaselineDocument).length,
    afterBaselineDocumentDelta: sum(lines.filter(line => line.isAfterBaselineDocument).map(line => line.delta)),
    byDate: summarize(lines, line => dateKey(line.created_at), "date"),
    byClassification: summarize(lines, line => line.classification, "classification"),
    byProduct: summarize(lines, line => line.product_id, "product_id")
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    lines,
  };
}

export function buildMacDriftRecoveryPlan(input: {
  runId: string;
  lines: MacDriftBaselineLine[];
}): MacDriftRecoveryPlan {
  const changes = [...input.lines]
    .sort((a, b) => a.line_id.localeCompare(b.line_id))
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
    source_hash: sha256(JSON.stringify(changes)),
    changes,
  };
}

function summarize<TName extends string>(
  lines: MacDriftBaselineLine[],
  getKey: (line: MacDriftBaselineLine) => string,
  name: TName,
): Array<Record<TName, string> & { count: number; delta: number }> {
  const map = new Map<string, { count: number; delta: number }>();
  for (const line of lines) {
    const key = getKey(line);
    const value = map.get(key) || { count: 0, delta: 0 };
    value.count += 1;
    value.delta += line.delta;
    map.set(key, value);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      [name]: key,
      count: value.count,
      delta: value.delta,
    }) as Record<TName, string> & { count: number; delta: number });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function dateKey(value: string): string {
  if (!value) return "(missing)";
  return new Date(value).toISOString().slice(0, 10);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}

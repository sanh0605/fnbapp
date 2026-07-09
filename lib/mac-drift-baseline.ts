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

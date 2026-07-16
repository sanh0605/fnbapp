/**
 * Task 3.8: surface the historical-event coverage gap for 41 backdated-like lines.
 *
 * Production access is SELECT-only. This script never calls a mutating method or
 * RPC; it writes only local JSON and Markdown audit artifacts.
 */
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import {
  buildBackdatedEventsGapReport,
  type BackdatedGapLine,
  type DurableBackdatedEvent,
  type HistoricalBackdatedLedgerRow,
  type LiveLedgerRow,
  type SourceHeader,
} from "../lib/backdated-ledger/task-3.8-gap-report";

dotenv.config({ path: ".env.local" });

const TASK_34_PATH = "docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.json";
const TASK_32_PATH = "docs/audits/2026-07-09-backdated-ledger-pattern.json";
const OUTPUT_JSON = "docs/audits/2026-07-16-task-3.8-backdated-events-surface.json";
const OUTPUT_MD = "docs/audits/2026-07-16-task-3.8-backdated-events-surface.md";
const EXPECTED_LINE_COUNT = 41;
const EXPECTED_LEDGER_COUNT = 5;
const EXPECTED_DELTA_VND = -43809;

type JsonRow = Record<string, unknown>;

type Task34Artifact = {
  lines: Array<JsonRow & {
    line_id: string;
    order_id: string;
    order_no?: string;
    sale_time: string;
    product_id?: string;
    variant_id?: string;
    stored_cost: number;
    expected_cost: number;
    delta_vnd: number;
    consumed_item_ids: string[];
    causal_backdated_ledger_ids: string[];
    classification: string;
  }>;
};

type Task32Artifact = {
  entries: HistoricalBackdatedLedgerRow[];
};

async function main(): Promise<void> {
  const task34 = readJson<Task34Artifact>(TASK_34_PATH);
  const task32 = readJson<Task32Artifact>(TASK_32_PATH);
  const lines: BackdatedGapLine[] = task34.lines
    .filter(line => line.classification === "BACKDATED_LEDGER_LIKE")
    .map(line => ({
      line_id: line.line_id,
      order_id: line.order_id,
      order_no: line.order_no,
      sale_time: line.sale_time,
      product_id: line.product_id,
      variant_id: line.variant_id,
      stored_cost: numberValue(line.stored_cost),
      expected_cost: numberValue(line.expected_cost),
      delta_vnd: numberValue(line.delta_vnd),
      consumed_item_ids: unique(line.consumed_item_ids || []),
      causal_backdated_ledger_ids: unique(line.causal_backdated_ledger_ids || []),
    }));
  const ledgerIds = unique(lines.flatMap(line => line.causal_backdated_ledger_ids));
  const historicalRows = task32.entries.filter(row => ledgerIds.includes(row.stock_ledger_id));
  const sourceIds = unique(historicalRows.map(row => row.source_id));

  assertEqual(lines.length, EXPECTED_LINE_COUNT, "Task 3.8 line count");
  assertEqual(sum(lines.map(line => line.delta_vnd)), EXPECTED_DELTA_VND, "Task 3.8 unique delta");
  assertEqual(ledgerIds.length, EXPECTED_LEDGER_COUNT, "Task 3.8 causal ledger count");
  assertEqual(historicalRows.length, EXPECTED_LEDGER_COUNT, "Task 3.2 historical row coverage");

  const client = createReadOnlyClient();
  const [eventRows, liveLedgerRows, sourceHeaders] = await Promise.all([
    selectByIds<JsonRow>(client, "backdated_ledger_events", "stock_ledger_id", ledgerIds),
    selectByIds<JsonRow>(client, "stock_ledger", "id", ledgerIds),
    selectByIds<JsonRow>(client, "purchase_orders", "id", sourceIds),
  ]);

  const durableEvents = eventRows.map(normalizeDurableEvent);
  const liveLedgers = liveLedgerRows.map(normalizeLiveLedgerRow);
  const headers = sourceHeaders.map(normalizeSourceHeader);
  const core = buildBackdatedEventsGapReport({
    lines,
    historicalRows,
    durableEvents,
    liveLedgerRows: liveLedgers,
    sourceHeaders: headers,
  });

  assertEqual(core.population.line_count, EXPECTED_LINE_COUNT, "Report line count");
  assertEqual(core.population.unique_delta_vnd, EXPECTED_DELTA_VND, "Report unique delta");
  assertEqual(core.population.historical_ledger_row_count, EXPECTED_LEDGER_COUNT, "Report ledger count");
  if (!core.validation.every_line_has_historical_ledger_row) {
    throw new Error("At least one Task 3.8 line lacks a precise historical ledger-row mapping");
  }
  if (core.validation.unexpected_event_statuses.length > 0) {
    throw new Error(`Unexpected durable event statuses: ${core.validation.unexpected_event_statuses.join(", ")}`);
  }

  const report = {
    task: "3.8",
    generated_at: new Date().toISOString(),
    mode: "READ_ONLY_GAP_REPORT",
    source_artifacts: [TASK_34_PATH, TASK_32_PATH],
    database_tables_read: ["backdated_ledger_events", "stock_ledger", "purchase_orders"],
    database_mutation_methods_used: [],
    finding: {
      verdict: core.population.durable_event_count === 0
        ? "MIGRATION_0014_HISTORICAL_BACKFILL_GAP"
        : "PARTIAL_DURABLE_EVENT_COVERAGE",
      summary: `${core.population.lines_without_durable_event}/${core.population.line_count} lines have no durable event row; ${core.population.historical_ledger_row_count} precise Task 3.2 ledger fingerprints remain available for operator review.`,
      operator_ui_ready: core.population.lines_without_durable_event === 0,
      backfill_performed: false,
    },
    gap_status_breakdown: [{
      status: "HISTORICAL_GAP",
      line_count: core.population.lines_without_durable_event,
      unique_delta_vnd: sum(core.lines.filter(line => line.associated_event_ids.length === 0).map(line => line.delta_vnd)),
    }],
    ...core,
  };

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");
  printSummary(report);
}

function renderMarkdown(report: ReturnType<typeof buildReportShape>): string {
  const ledgerRows = report.ledger_rows.map(row => {
    const lagDays = (row.lag_ms / 86400000).toFixed(2);
    return `| \`${row.stock_ledger_id}\` | ${row.source_id} | ${row.item_reference} | ${row.effective_at} | ${row.created_at} | ${lagDays} d | ${row.affected_line_count} | ${formatVnd(row.affected_line_total_delta_vnd)} | ${row.availability_heuristic} | ${row.operator_decision} |`;
  }).join("\n");
  const lineRows = report.lines.map(line =>
    `| \`${line.line_id}\` | ${line.order_no || line.order_id} | ${line.sale_time} | ${formatVnd(line.delta_vnd)} | ${line.causal_backdated_ledger_ids.map(id => `\`${id}\``).join("<br>")} | ${line.durable_event_coverage} |`,
  ).join("\n");
  const statuses = report.status_breakdown.length > 0
    ? report.status_breakdown.map(row => `| ${row.status} | ${row.event_count} | ${row.affected_line_count} | ${formatVnd(row.affected_line_total_delta_vnd)} |`).join("\n")
    : "| No durable events | 0 | 0 | 0 VND |";

  return `# Task 3.8 — Backdated-events gap report

Date: 2026-07-16
Mode: read-only
Decision state: awaiting Claude review, then operator decision per historical ledger row

## Outcome

The 41 \`BACKDATED_LEDGER_LIKE\` lines map to five precise Task 3.2 historical ledger fingerprints, but **none maps to a durable \`backdated_ledger_events\` row**. This is a migration-0014 historical backfill gap, not a reclassification failure: migration 0014 detects future inserts and did not backfill these older PO receipts.

No backfill, status mutation, recovery, or other production write was performed. The current admin event UI cannot surface these five historical rows until a separate write-capable design is explicitly approved.

| Measure | Result |
|---|---:|
| Lines | ${report.population.line_count} |
| Unique cohort delta | ${formatVnd(report.population.unique_delta_vnd)} |
| Precise historical ledger rows | ${report.population.historical_ledger_row_count} |
| Durable events | ${report.population.durable_event_count} |
| Lines with durable-event coverage | ${report.population.lines_with_durable_event}/${report.population.line_count} |
| Lines mapping to multiple ledger rows | ${report.population.lines_with_multiple_ledger_rows} |

## Per-ledger-row decision input

Here \`created_at\` is the source purchase-order \`created_at\`, which Task 3.2 uses as the visibility timestamp. \`effective_at\` is the stock-ledger effective timestamp. The lag is \`created_at - effective_at\`.

| Ledger row | Source | Item | Effective at | Created at | Lag | Affected lines | Affected-line delta | Availability heuristic | Operator decision |
|---|---|---|---|---|---:|---:|---:|---|---|
${ledgerRows}

The \`LIKELY_AVAILABLE\` label is deliberately narrow and non-authoritative: it requires a positive-cost PO receipt plus mapped sales inside the effective/visibility gap that consume the same item. It is evidence for operator review, **not** an approval or recompute recommendation. Each row remains \`UNSET\`.

The per-ledger affected-line deltas overlap: ${report.population.lines_with_multiple_ledger_rows} lines map to multiple ledger rows. Therefore those five numbers must not be summed; the unique 41-line cohort delta is ${formatVnd(report.population.unique_delta_vnd)}.

## Durable-event status surface

| Status | Events | Affected lines | Affected-line delta |
|---|---:|---:|---:|
${statuses}

All 41 lines are instead reported as \`HISTORICAL_GAP\` (${formatVnd(report.population.unique_delta_vnd)} unique delta). There is no event ID or event status for an operator to approve or reject in the current UI.

## Operator decision protocol

For each of the five ledger rows, the operator should validate source paperwork and physical receipt timing, then record one of: accept historical drift, request a separately reviewed durable-event backfill, or request a separately reviewed recovery plan. This report does not choose among them.

Claude review is required before the operator walk-through. No forward-drift task should be opened from this report until that review.

## Per-line map

| Line | Order | Sale time | Delta | Historical causal ledger rows | Durable coverage |
|---|---|---|---:|---|---|
${lineRows}

## Reproducibility and safety

- Inputs: \`${TASK_34_PATH}\`, \`${TASK_32_PATH}\`.
- Live SELECTs: \`backdated_ledger_events\`, \`stock_ledger\`, \`purchase_orders\`.
- Database mutation methods used: \`[]\`.
- Local structured artifact: \`${OUTPUT_JSON}\`.
- No backfill and no database mutation were performed.
`;
}

// Keeps renderMarkdown's input type tied to the actual report shape without a second interface.
function buildReportShape(core: ReturnType<typeof buildBackdatedEventsGapReport>) {
  return {
    task: "3.8",
    generated_at: "",
    mode: "READ_ONLY_GAP_REPORT",
    source_artifacts: [] as string[],
    database_tables_read: [] as string[],
    database_mutation_methods_used: [] as string[],
    finding: { verdict: "", summary: "", operator_ui_ready: false, backfill_performed: false },
    gap_status_breakdown: [] as Array<{ status: string; line_count: number; unique_delta_vnd: number }>,
    ...core,
  };
}

function createReadOnlyClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service credential");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function selectByIds<T extends JsonRow>(
  client: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client.from(table).select("*").in(column, ids);
  if (error) throw new Error(`SELECT ${table}: ${error.message}`);
  return (data || []) as T[];
}

function normalizeDurableEvent(row: JsonRow): DurableBackdatedEvent {
  return {
    id: stringValue(row.id),
    stock_ledger_id: stringValue(row.stock_ledger_id),
    status: stringValue(row.status),
    source_table: stringValue(row.source_table),
    source_id: stringValue(row.source_id),
    item_reference: stringValue(row.item_reference),
    quantity_change: numberValue(row.quantity_change),
    unit_cost: numberValue(row.unit_cost),
    effective_timestamp: stringValue(row.effective_timestamp),
    visibility_timestamp: stringValue(row.visibility_timestamp),
    detected_at: stringValue(row.detected_at),
    reviewed_by: nullableString(row.reviewed_by),
    reviewed_at: nullableString(row.reviewed_at),
    recompute_run_id: nullableString(row.recompute_run_id),
    notes: nullableString(row.notes),
  };
}

function normalizeLiveLedgerRow(row: JsonRow): LiveLedgerRow {
  return {
    id: stringValue(row.id),
    created_at: nullableString(row.created_at),
    transaction_type: nullableString(row.transaction_type),
    reference_id: nullableString(row.reference_id),
    item_reference: nullableString(row.item_reference),
    quantity_change: numberValue(row.quantity_change),
    unit_cost: numberValue(row.unit_cost),
  };
}

function normalizeSourceHeader(row: JsonRow): SourceHeader {
  return { id: stringValue(row.id), created_at: nullableString(row.created_at) };
}

function printSummary(report: ReturnType<typeof buildReportShape>): void {
  console.log("=== TASK 3.8 BACKDATED EVENTS GAP REPORT (READ ONLY) ===");
  console.log(`Lines:                 ${report.population.line_count}`);
  console.log(`Unique delta:          ${formatVnd(report.population.unique_delta_vnd)}`);
  console.log(`Historical ledger rows:${report.population.historical_ledger_row_count}`);
  console.log(`Durable events:        ${report.population.durable_event_count}`);
  console.log(`Durable coverage:      ${report.population.lines_with_durable_event}/${report.population.line_count}`);
  console.log(`Multi-ledger lines:    ${report.population.lines_with_multiple_ledger_rows}`);
  console.table(report.ledger_rows.map(row => ({
    ledger_id: row.stock_ledger_id,
    source: row.source_id,
    item: row.item_reference,
    lines: row.affected_line_count,
    delta_vnd: row.affected_line_total_delta_vnd,
    heuristic: row.availability_heuristic,
  })));
  console.log(`JSON artifact:         ${OUTPUT_JSON}`);
  console.log(`Markdown artifact:     ${OUTPUT_MD}`);
  console.log("No database rows were written.");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function nullableString(value: unknown): string | null {
  const result = stringValue(value);
  return result || null;
}

function formatVnd(value: number): string {
  return `${value.toLocaleString("en-US")} VND`;
}

function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

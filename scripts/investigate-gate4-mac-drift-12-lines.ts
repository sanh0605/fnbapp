/**
 * Gate 4 addendum: classify the 12 MAC mismatches first observed on 2026-07-18.
 *
 * Database access is SELECT-only. The only write is the local JSON evidence
 * artifact paired with the Gate 4 narrative report.
 */

import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  classifyGate4MacLine,
  type Gate4MacBucket,
  type Gate4MacMechanism,
} from "../lib/gate4-mac-drift-classification";
import { auditMacCogsDrift } from "../lib/mac-cogs-audit";
import {
  computeMacCostForConsumptionRows,
  computeMacCostFromUnitCosts,
  type MacLedgerEntry,
} from "../lib/mac-cogs";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "../lib/inventory-consumption";
import { parseLineRecipeSnapshot } from "../lib/order-types";
import { selectEffectiveRecipe } from "../lib/recipe-selection";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const INPUT_PATH = "docs/audits/2026-07-18-mac-drift-baseline-audit.json";
const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const TASK_36_PATH = "docs/audits/2026-07-15-task-3.6-forward-drift-investigation.json";
const OUTPUT_PATH = "docs/audits/2026-07-19-gate4-mac-drift-12-line-classification.json";
const CUTOFF = "2026-07-02T23:59:59.999Z";
const MATCH_THRESHOLD_VND = 1;
const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;
type InputArtifact = {
  summary: {
    by_category: { NEW_INVESTIGATION_NEEDED: number };
    locked_violation_by_subcategory: { LOCKED_VIOLATION_STORED: number };
  };
  new_investigation_needed: Array<{
    line_id: string;
    classification: string;
  }>;
};
type BaselineArtifact = { lines: Array<{ created_at: string }> };
type Task36Artifact = {
  lines: Array<{
    product_id: string;
    shortfall_btp_ids: string[];
    mechanism: string;
  }>;
};
type OrderRow = Row & { id: string; order_no?: string; created_at?: string };
type LineRow = Row & {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  qty?: string | number;
  cost_at_sale?: string | number;
  recipe_snapshot_json?: string | Row;
  modifiers_snapshot_json?: string | unknown[];
};
type LedgerRow = MacLedgerEntry & Row & {
  id?: string;
  reference_id?: string;
  transaction_type?: string;
  item_reference: string;
  quantity_change: string | number;
  unit_cost?: string | number;
  created_at: string;
};
type RecipeRow = Row & {
  id?: string;
  target_id?: string;
  target_type?: string;
  ingredients_json?: string | unknown[];
  start_date?: string;
  created_at?: string;
};
type SemiProductRow = Row & { id?: string; batch_yield?: string | number };
type BackdatedEventRow = Row & {
  id?: string;
  stock_ledger_id?: string;
  effective_timestamp?: string;
  visibility_timestamp?: string;
  item_reference?: string;
};
type EventRow = Row & {
  id?: string;
  order_id?: string;
  event_type?: string;
  event_at?: string;
};
type EvidenceLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  sale_time: string;
  product_id: string;
  variant_id: string;
  qty: number;
  stored_cost: number;
  current_replay_cost: number;
  delta_vnd: number;
  audit_classification: string;
  consumed_item_ids: string[];
  shortfall_btp_ids: string[];
  causal_backdated_event_ids: string[];
  causal_backdated_events: Array<{
    event_id: string;
    stock_ledger_id: string;
    item_reference: string;
    effective_timestamp: string;
    visibility_timestamp: string;
  }>;
  sale_recipe_replay_cost: number;
  pre_visibility_replay_cost: number;
  compact_replay_cost: number;
  sale_recipe_ids: string[];
  current_recipe_ids: string[];
  prior_task_3_6_fingerprint_count: number;
  bucket: Gate4MacBucket;
  mechanism: Gate4MacMechanism;
  exact_stored_reproduction: boolean;
  errors: string[];
};

async function main(): Promise<void> {
  const input = readJson<InputArtifact>(INPUT_PATH);
  const baseline = readJson<BaselineArtifact>(BASELINE_PATH);
  const task36 = readJson<Task36Artifact>(TASK_36_PATH);
  const targetIds = new Set(input.new_investigation_needed.map(line => line.line_id));
  if (targetIds.size !== 12 || input.summary.by_category.NEW_INVESTIGATION_NEEDED !== 12) {
    throw new Error(`Expected frozen 12-line input, got ${targetIds.size}`);
  }
  if (input.summary.locked_violation_by_subcategory.LOCKED_VIOLATION_STORED !== 0) {
    throw new Error("Stored-value violation present; classification must stop");
  }
  const baselineStart = baseline.lines.map(line => line.created_at).sort()[0];

  const client = createReadOnlyClient();
  const [orders, rawLines, rawLedger, rawRecipes, semiProducts, backdatedEvents, orderEvents] = await Promise.all([
    selectAll<OrderRow>(client, "orders_v2"),
    selectAll<LineRow>(client, "order_lines_v2"),
    selectAll<LedgerRow>(client, "stock_ledger"),
    selectAll<RecipeRow>(client, "recipes"),
    selectAll<SemiProductRow>(client, "semi_products"),
    selectAll<BackdatedEventRow>(client, "backdated_ledger_events"),
    selectAll<EventRow>(client, "order_events"),
  ]);

  const lines = rawLines.map(normalizeLineJson);
  const recipes = rawRecipes.map(normalizeRecipeJson);
  const ledger = [...rawLedger].sort(compareLedger);
  const drift = auditMacCogsDrift({ orders, lines, ledger, recipes, semiProducts });
  const mismatchById = new Map(drift.lineMismatches.map(line => [line.line_id, line]));
  const lineById = new Map(lines.map(line => [line.id, line]));
  const orderById = new Map(orders.map(order => [order.id, order]));
  const eventsByOrder = groupBy(orderEvents, event => stringValue(event.order_id));
  const currentMaps = buildSemiProductRecipeMaps(recipes, semiProducts);

  const evidenceLines = [...targetIds].map(lineId => {
    const mismatch = mismatchById.get(lineId);
    const line = lineById.get(lineId);
    if (!mismatch || !line) throw new Error(`Target is no longer a live mismatch: ${lineId}`);
    const order = orderById.get(line.order_id);
    if (!order) throw new Error(`Missing order for ${lineId}`);
    const inputClassification = input.new_investigation_needed.find(row => row.line_id === lineId);
    if (!inputClassification) throw new Error(`Missing frozen classification for ${lineId}`);
    return buildEvidenceLine({
      mismatch,
      auditClassification: inputClassification.classification,
      line,
      order,
      ledger,
      recipes,
      semiProducts,
      currentMaps,
      backdatedEvents,
      orderEvents: eventsByOrder.get(order.id) || [],
      task36,
      baselineStart,
    });
  }).sort((left, right) => left.sale_time.localeCompare(right.sale_time) || left.line_id.localeCompare(right.line_id));

  const bucketSummary = summarize(evidenceLines, line => line.bucket);
  const mechanismSummary = summarize(evidenceLines, line => line.mechanism);
  const report = {
    generated_at: new Date().toISOString(),
    mode: "READ_ONLY",
    contract: {
      database_tables_read: [
        "Orders_V2",
        "Order_Lines_V2",
        "Stock_Ledger",
        "Recipes",
        "Semi_Products",
        "backdated_ledger_events",
        "Order_Events",
      ],
      database_mutation_methods_used: [],
      frozen_input: INPUT_PATH,
      output_path: OUTPUT_PATH,
    },
    summary: {
      line_count: evidenceLines.length,
      total_delta_vnd: sum(evidenceLines.map(line => line.delta_vnd)),
      stored_violation_count: 0,
      bucket_summary: bucketSummary,
      mechanism_summary: mechanismSummary,
      exact_stored_reproduction_count: evidenceLines.filter(line => line.exact_stored_reproduction).length,
      causal_backdated_line_count: evidenceLines.filter(line => line.causal_backdated_event_ids.length > 0).length,
      unresolved_line_count: evidenceLines.filter(line => line.mechanism === "UNRESOLVED").length,
    },
    lines: evidenceLines,
  };
  if (evidenceLines.length !== 12 || sum(bucketSummary.map(row => row.line_count)) !== 12) {
    throw new Error("12-line classification did not reconcile");
  }
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("=== GATE 4 MAC DRIFT 12-LINE CLASSIFICATION (READ ONLY) ===");
  console.log(`Lines: ${report.summary.line_count}; delta: ${report.summary.total_delta_vnd} VND`);
  console.table(bucketSummary);
  console.table(mechanismSummary);
  console.log(`Exact stored reproduction: ${report.summary.exact_stored_reproduction_count}/12`);
  console.log(`Causal backdated: ${report.summary.causal_backdated_line_count}/12`);
  console.log(`Unresolved: ${report.summary.unresolved_line_count}/12`);
  console.log(`JSON artifact: ${OUTPUT_PATH}`);
  console.log("No database rows were written.");
}

function buildEvidenceLine(input: {
  mismatch: ReturnType<typeof auditMacCogsDrift>["lineMismatches"][number];
  auditClassification: string;
  line: LineRow & { recipe_snapshot_json: string; modifiers_snapshot_json: string };
  order: OrderRow;
  ledger: LedgerRow[];
  recipes: Array<RecipeRow & { ingredients_json: string }>;
  semiProducts: SemiProductRow[];
  currentMaps: ReturnType<typeof buildSemiProductRecipeMaps>;
  backdatedEvents: BackdatedEventRow[];
  orderEvents: EventRow[];
  task36: Task36Artifact;
  baselineStart: string;
}): EvidenceLine {
  const errors: string[] = [];
  const saleTime = stringValue(input.order.created_at) || input.mismatch.created_at;
  const saleMs = timestampMs(saleTime);
  const effectiveLedger = input.ledger.filter(row => (
    timestampMs(row.created_at) <= saleMs
    && stringValue(row.reference_id) !== input.order.id
  ));
  const snapshot = parseLineRecipeSnapshot(input.line.recipe_snapshot_json);
  applyModifierQuantities(snapshot, input.line.modifiers_snapshot_json);
  const balances = buildInventoryBalances(effectiveLedger, saleTime);
  const currentRows = safeConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    balances,
    input.currentMaps,
    errors,
  );
  const currentReplayCost = computeMacCostForConsumptionRows(
    currentRows,
    effectiveLedger,
    saleTime,
    input.currentMaps,
  );
  const saleMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts, saleTime);
  const saleRows = safeConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    balances,
    saleMaps,
    errors,
  );
  const saleRecipeReplayCost = computeMacCostForConsumptionRows(
    saleRows,
    effectiveLedger,
    saleTime,
    saleMaps,
  );
  const compactReplayCost = computeMacCostFromUnitCosts(
    saleRows,
    buildCompactMacUnitCosts(effectiveLedger, saleTime),
    saleMaps,
  );
  const consumedItemIds = unique(currentRows.map(row => row.item_reference));
  const shortfallBtpIds = unique(currentRows.flatMap(row => extractShortfallBtpIds(row.source)));
  const writeVisibilityTime = findWriteVisibilityTime(saleTime, input.orderEvents);
  const causalBackdatedEvents = input.backdatedEvents.filter(event => (
    timestampMs(stringValue(event.effective_timestamp)) <= saleMs
    && saleMs <= timestampMs(stringValue(event.visibility_timestamp))
    && timestampMs(stringValue(event.visibility_timestamp)) > timestampMs(writeVisibilityTime)
    && consumedItemIds.includes(stringValue(event.item_reference))
  )).map(event => ({
    event_id: stringValue(event.id),
    stock_ledger_id: stringValue(event.stock_ledger_id),
    item_reference: stringValue(event.item_reference),
    effective_timestamp: stringValue(event.effective_timestamp),
    visibility_timestamp: stringValue(event.visibility_timestamp),
  })).sort((left, right) => left.event_id.localeCompare(right.event_id));
  const causalBackdatedEventIds = unique(causalBackdatedEvents.map(event => event.event_id));
  const causalBackdatedLedgerIds = new Set(causalBackdatedEvents.map(event => event.stock_ledger_id));
  const preVisibilityLedger = effectiveLedger.filter(row => !causalBackdatedLedgerIds.has(stringValue(row.id)));
  const preVisibilityRows = safeConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    buildInventoryBalances(preVisibilityLedger, saleTime),
    saleMaps,
    errors,
  );
  const preVisibilityReplayCost = computeMacCostForConsumptionRows(
    preVisibilityRows,
    preVisibilityLedger,
    saleTime,
    saleMaps,
  );
  const relevantBtpIds = unique([
    ...extractDirectBtpIds(snapshot),
    ...shortfallBtpIds,
  ]);
  const saleRecipeIds = unique(relevantBtpIds.map(id => (
    stringValue(selectEffectiveRecipe(input.recipes, "SEMI_PRODUCT", id, saleTime)?.id)
  )));
  const currentRecipeIds = unique(relevantBtpIds.map(id => (
    stringValue(selectEffectiveRecipe(input.recipes, "SEMI_PRODUCT", id, new Date().toISOString())?.id)
  )));
  const storedCost = numberValue(input.line.cost_at_sale);
  const result = classifyGate4MacLine({
    saleTime,
    cutoff: CUTOFF,
    baselineStart: input.baselineStart,
    causalBackdatedEventIds,
    auditClassification: input.auditClassification,
    shortfallBtpIds,
    saleRecipeReplayMatchesStored: matches(saleRecipeReplayCost, storedCost),
    currentReplayMatchesStored: matches(currentReplayCost, storedCost),
    compactReplayMatchesStored: matches(compactReplayCost, storedCost),
  });
  const priorFingerprintCount = input.task36.lines.filter(line => (
    line.product_id === input.mismatch.product_id
    && shortfallBtpIds.some(id => line.shortfall_btp_ids.includes(id))
    && line.mechanism !== "UNRESOLVED"
  )).length;
  if (!matches(currentReplayCost, input.mismatch.expected_cost)) {
    errors.push(`Current replay ${currentReplayCost} differs from audit ${input.mismatch.expected_cost}`);
  }
  const reproduced = result.mechanism === "BACKDATED_LEDGER_VISIBILITY"
    ? preVisibilityReplayCost
    : result.mechanism === "KNOWN_RECIPE_TIMING_REPLAY"
      ? saleRecipeReplayCost
      : result.mechanism === "KNOWN_SHORTFALL_FORMULA_REPLAY"
        ? compactReplayCost
        : currentReplayCost;
  return {
    line_id: input.mismatch.line_id,
    order_id: input.mismatch.order_id,
    order_no: input.mismatch.order_no,
    sale_time: saleTime,
    product_id: input.mismatch.product_id,
    variant_id: input.mismatch.variant_id,
    qty: input.mismatch.qty,
    stored_cost: storedCost,
    current_replay_cost: currentReplayCost,
    delta_vnd: input.mismatch.delta,
    audit_classification: input.auditClassification,
    consumed_item_ids: consumedItemIds,
    shortfall_btp_ids: shortfallBtpIds,
    causal_backdated_event_ids: causalBackdatedEventIds,
    causal_backdated_events: causalBackdatedEvents,
    sale_recipe_replay_cost: saleRecipeReplayCost,
    pre_visibility_replay_cost: preVisibilityReplayCost,
    compact_replay_cost: compactReplayCost,
    sale_recipe_ids: saleRecipeIds,
    current_recipe_ids: currentRecipeIds,
    prior_task_3_6_fingerprint_count: priorFingerprintCount,
    bucket: result.bucket,
    mechanism: result.mechanism,
    exact_stored_reproduction: matches(reproduced, storedCost),
    errors,
  };
}

function safeConsumptionRows(
  snapshot: ReturnType<typeof parseLineRecipeSnapshot>,
  qty: number,
  balances: ReturnType<typeof buildInventoryBalances>,
  maps: ReturnType<typeof buildSemiProductRecipeMaps>,
  errors: string[],
): ConsumptionRow[] {
  try {
    return buildLineConsumptionRows(snapshot, qty, new Map(balances), maps);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return [];
  }
}

function applyModifierQuantities(
  snapshot: ReturnType<typeof parseLineRecipeSnapshot>,
  rawModifiers: string,
): void {
  let quantities = new Map<string, number>();
  try {
    const parsed = JSON.parse(rawModifiers) as unknown;
    if (Array.isArray(parsed)) {
      quantities = new Map(parsed.map(value => {
        const row = value as Row;
        return [stringValue(row.id), numberValue(row.qty) || 1] as const;
      }));
    }
  } catch {
    quantities = new Map();
  }
  for (const modifier of snapshot.modifiers) {
    if (!modifier.modifier_qty) {
      modifier.modifier_qty = quantities.get(modifier.modifier_id) || 1;
    }
  }
}

function extractDirectBtpIds(snapshot: ReturnType<typeof parseLineRecipeSnapshot>): string[] {
  return unique([
    ...snapshot.variant.ingredients,
    ...snapshot.modifiers.flatMap(modifier => modifier.recipe.ingredients),
  ].filter(ingredient => ingredient.ingredient_type === "SEMI_PRODUCT")
    .map(ingredient => ingredient.ingredient_id));
}

function extractShortfallBtpIds(source: string): string[] {
  return [...source.matchAll(/BTP_SHORTFALL:([^:]+)/g)].map(match => match[1]);
}

function findWriteVisibilityTime(saleTime: string, events: EventRow[]): string {
  const writeEvents = events.filter(event => (
    ["CREATED", "EDITED", "MIGRATED", "IMPORTED"].includes(stringValue(event.event_type))
    && Number.isFinite(timestampMs(stringValue(event.event_at)))
  ));
  if (writeEvents.length === 0) return saleTime;
  return writeEvents.map(event => stringValue(event.event_at))
    .sort((left, right) => timestampMs(right) - timestampMs(left))[0];
}

function buildCompactMacUnitCosts(ledger: LedgerRow[], saleTime: string): Map<string, number> {
  const quantities = new Map<string, number>();
  const values = new Map<string, number>();
  const unitCosts = new Map<string, number>();
  const saleMs = timestampMs(saleTime);
  for (const row of [...ledger].sort(compareLedger)) {
    if (timestampMs(row.created_at) > saleMs) continue;
    const item = row.item_reference;
    const qty = numberValue(row.quantity_change);
    const unitCost = numberValue(row.unit_cost);
    let macQty = quantities.get(item) || 0;
    let macValue = values.get(item) || 0;
    let latestMac = unitCosts.get(item) || 0;
    if (["PO_RECEIPT", "STOCK_ADJUST", "PRODUCTION_YIELD"].includes(stringValue(row.transaction_type)) && qty > 0 && unitCost > 0) {
      macQty += qty;
      macValue += qty * unitCost;
      latestMac = macValue / macQty;
      quantities.set(item, macQty);
      values.set(item, macValue);
      unitCosts.set(item, latestMac);
    } else if (qty < 0 && macQty > 0) {
      const consumedQty = Math.min(macQty, Math.abs(qty));
      macQty -= consumedQty;
      macValue -= consumedQty * latestMac;
      if (macQty === 0) macValue = 0;
      quantities.set(item, macQty);
      values.set(item, macValue);
    }
  }
  return unitCosts;
}

function createReadOnlyClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service configuration");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function selectAll<T extends Row>(client: SupabaseClient, table: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client.from(table).select("*").order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`SELECT ${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}

function normalizeLineJson(line: LineRow): LineRow & { recipe_snapshot_json: string; modifiers_snapshot_json: string } {
  return {
    ...line,
    recipe_snapshot_json: jsonString(line.recipe_snapshot_json, "{}"),
    modifiers_snapshot_json: jsonString(line.modifiers_snapshot_json, "[]"),
  };
}

function normalizeRecipeJson(recipe: RecipeRow): RecipeRow & { ingredients_json: string } {
  return { ...recipe, ingredients_json: jsonString(recipe.ingredients_json, "[]") };
}

function compareLedger(left: LedgerRow, right: LedgerRow): number {
  return timestampMs(left.created_at) - timestampMs(right.created_at)
    || stringValue(left.id).localeCompare(stringValue(right.id));
}

function summarize<T extends string>(lines: EvidenceLine[], keyOf: (line: EvidenceLine) => T): Array<{ key: T; line_count: number; delta_vnd: number }> {
  const groups = new Map<T, { line_count: number; delta_vnd: number }>();
  for (const line of lines) {
    const key = keyOf(line);
    const group = groups.get(key) || { line_count: 0, delta_vnd: 0 };
    group.line_count += 1;
    group.delta_vnd += line.delta_vnd;
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) || []), row]);
  return groups;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function jsonString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value || fallback;
  return value === null || value === undefined ? fallback : JSON.stringify(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function numberValue(value: unknown): number {
  const valueNumber = Number(value ?? 0);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}

function matches(left: number, right: number): boolean {
  return Math.abs(left - right) <= MATCH_THRESHOLD_VND;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Task 3.6: investigate the active post-cutoff BTP_SHORTFALL drift.
 *
 * Production access is read-only. This script issues SELECT queries only and
 * writes one local JSON audit artifact.
 */

import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditMacCogsDrift, type MacCogsLineMismatch } from "../lib/mac-cogs-audit";
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

const INPUT_PATH = "docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.json";
const OUTPUT_PATH = "docs/audits/2026-07-15-task-3.6-forward-drift-investigation.json";
const PAGE_SIZE = 1000;
const MATCH_THRESHOLD_VND = 1;
const TARGET_BTPS = ["BTP-002", "BTP-009", "BTP-011", "BTP-012"];

type Row = Record<string, unknown>;
type Mechanism =
  | "LATE_PO_RECEIPT"
  | "LATE_PRODUCTION_YIELD"
  | "LATE_STOCK_ADJUST"
  | "RECIPE_OR_BATCH_YIELD_MUTATION"
  | "SHORTFALL_FALLBACK_FORMULA_DRIFT"
  | "UNRESOLVED";

type Task34Artifact = {
  population: { new_outside_lines_after_capture_ids: string[] };
  lines: Array<{
    line_id: string;
    classification: string;
    expected_cost: number;
    delta_vnd: number;
  }>;
};

type OrderRow = Row & {
  id: string;
  order_no?: string;
  created_at?: string;
  created_by_id?: string;
  created_by_name?: string;
};

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
  source?: string;
};

type RecipeRow = Row & {
  id?: string;
  target_id?: string;
  target_type?: string;
  status?: string;
  ingredients_json?: string | unknown[];
  start_date?: string;
  end_date?: string;
  created_at?: string;
};

type SemiProductRow = Row & {
  id?: string;
  name?: string;
  batch_yield?: string | number;
  created_at?: string;
  updated_at?: string;
};

type SourceHeaderRow = Row & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  transaction_date?: string;
  apply_date?: string;
  supplier_id?: string;
};

type EventRow = Row & {
  id?: string;
  order_id?: string;
  event_type?: string;
  event_at?: string;
  actor_id?: string;
  actor_name?: string;
};

type BackdatedEventRow = Row & {
  id?: string;
  stock_ledger_id?: string;
  effective_timestamp?: string;
  visibility_timestamp?: string;
  item_reference?: string;
};

type LateLedgerCandidate = {
  ledger_id: string;
  transaction_type: string;
  item_reference: string;
  reference_id: string;
  effective_at: string;
  visibility_at: string;
  visibility_lag_seconds: number;
};

type InvestigationLine = {
  cohort: "FROZEN_71" | "NEW_42";
  line_id: string;
  order_id: string;
  order_no: string;
  sale_time: string;
  product_id: string;
  variant_id: string;
  qty: number;
  operator_id: string;
  operator_name: string;
  operator_source: "ORDER" | "ORDER_EVENT" | "UNKNOWN";
  stored_cost: number;
  current_replay_cost: number;
  current_delta_vnd: number;
  sale_recipe_replay_cost: number;
  previous_recipe_replay_cost: number;
  sale_visible_ledger_replay_cost: number;
  sale_compact_replay_cost: number;
  shortfall_btp_ids: string[];
  consumed_item_ids: string[];
  current_consumption_rows: ConsumptionRow[];
  sale_recipe_consumption_rows: ConsumptionRow[];
  late_ledger_candidates: LateLedgerCandidate[];
  backdated_event_ids: string[];
  recipe_version_changes: Array<{
    btp_id: string;
    sale_recipe_id: string;
    current_recipe_id: string;
    sale_recipe_created_at: string;
    current_recipe_created_at: string;
  }>;
  previous_recipe_ids: Array<{
    btp_id: string;
    selected_recipe_id: string;
    previous_recipe_id: string;
  }>;
  mechanism: Mechanism;
  mechanism_reason: string;
  exact_write_time_reproduction: boolean;
  errors: string[];
};

async function main(): Promise<void> {
  const source = readJson<Task34Artifact>(INPUT_PATH);
  const frozenIds = source.lines
    .filter(line => line.classification === "POST_CUTOFF_NEW_DRIFT")
    .map(line => line.line_id);
  const newIds = source.population.new_outside_lines_after_capture_ids || [];
  assertEqual(frozenIds.length, 71, "Task 3.4 frozen post-cutoff line count");
  assertEqual(newIds.length, 42, "Task 3.4 newly observed line count");
  const targetIds = new Set([...frozenIds, ...newIds]);
  assertEqual(targetIds.size, 113, "Task 3.6 distinct target line count");

  const client = createReadOnlyQueryClient();
  const [
    orders,
    rawLines,
    rawLedger,
    rawRecipes,
    semiProducts,
    events,
    purchaseOrders,
    productionOrders,
    stockAdjustments,
    backdatedEvents,
  ] = await Promise.all([
    selectAll<OrderRow>(client, "orders_v2"),
    selectAll<LineRow>(client, "order_lines_v2"),
    selectAll<LedgerRow>(client, "stock_ledger"),
    selectAll<RecipeRow>(client, "recipes"),
    selectAll<SemiProductRow>(client, "semi_products"),
    selectAll<EventRow>(client, "order_events"),
    selectAll<SourceHeaderRow>(client, "purchase_orders"),
    selectAll<SourceHeaderRow>(client, "production_orders"),
    selectAll<SourceHeaderRow>(client, "stock_adjustments"),
    selectAll<BackdatedEventRow>(client, "backdated_ledger_events"),
  ]);

  const lines = rawLines.map(normalizeLineJson);
  const ledger = [...rawLedger].sort(compareLedger);
  const recipes = rawRecipes.map(normalizeRecipeJson);
  const drift = auditMacCogsDrift({ orders, lines, ledger, recipes, semiProducts });
  const mismatchByLineId = new Map(drift.lineMismatches.map(line => [line.line_id, line]));
  const missingTargets = [...targetIds].filter(id => !mismatchByLineId.has(id));
  if (missingTargets.length > 0) {
    throw new Error(`Task 3.6 target lines no longer mismatched: ${missingTargets.join(", ")}`);
  }

  const orderById = new Map(orders.map(row => [row.id, row]));
  const lineById = new Map(lines.map(row => [row.id, row]));
  const eventsByOrder = groupBy(events, row => stringValue(row.order_id));
  const sourceVisibilityByLedger = buildSourceVisibilityIndex({
    ledger,
    purchaseOrders,
    productionOrders,
    stockAdjustments,
  });
  const backdatedByLedger = groupBy(backdatedEvents, row => stringValue(row.stock_ledger_id));
  const currentMaps = buildSemiProductRecipeMaps(recipes, semiProducts);
  const currentRecipeByBtp = new Map(TARGET_BTPS.map(btpId => [
    btpId,
    selectEffectiveRecipe(recipes, "SEMI_PRODUCT", btpId, new Date().toISOString()),
  ]));

  const investigationLines = [...targetIds].map(lineId => {
    const line = lineById.get(lineId);
    const mismatch = mismatchByLineId.get(lineId);
    if (!line || !mismatch) throw new Error(`Missing live line or mismatch: ${lineId}`);
    const order = orderById.get(line.order_id);
    if (!order) throw new Error(`Missing order for ${lineId}`);
    return investigateLine({
      cohort: frozenIds.includes(lineId) ? "FROZEN_71" : "NEW_42",
      line,
      order,
      mismatch,
      ledger,
      recipes,
      semiProducts,
      currentMaps,
      currentRecipeByBtp,
      sourceVisibilityByLedger,
      backdatedByLedger,
      events: eventsByOrder.get(order.id) || [],
    });
  }).sort((left, right) => left.sale_time.localeCompare(right.sale_time) || left.line_id.localeCompare(right.line_id));

  const frozenLines = investigationLines.filter(line => line.cohort === "FROZEN_71");
  const operatorSummary = summarize(investigationLines, line => line.operator_name || line.operator_id || "UNKNOWN");
  const frozenOperatorSummary = summarize(frozenLines, line => line.operator_name || line.operator_id || "UNKNOWN");
  const topFrozenOperatorShare = frozenLines.length === 0
    ? 0
    : (frozenOperatorSummary[0]?.line_count || 0) / frozenLines.length;
  const julyOrders = orders.filter(order => {
    const saleTime = timestampMs(stringValue(order.created_at));
    return saleTime >= timestampMs("2026-07-01T00:00:00.000Z")
      && saleTime < timestampMs("2026-07-15T00:00:00.000Z")
      && ["COMPLETED", "SUPERSEDED"].includes(stringValue(order.status));
  });
  const julyOperators = julyOrders.map(order => ({
    order,
    operator: resolveOperator(order, eventsByOrder.get(order.id) || []),
  }));
  const julyOperatorSummary = summarizeOperators(julyOperators.map(row => (
    row.operator.name || row.operator.id || "UNKNOWN"
  )));
  const julyTuyenCount = julyOperators.filter(row => (
    (row.operator.name || row.operator.id).toLowerCase() === "tuyen2612"
  )).length;
  const julyTuyenShare = julyOrders.length === 0 ? 0 : julyTuyenCount / julyOrders.length;
  const operatorConcentrationVerdict = julyTuyenShare > 0.8
    ? "DISMISSED_BASE_RATE_SIMILAR"
    : julyTuyenShare < 0.6
      ? "WORKFLOW_SIGNIFICANCE_STOP_TRIGGER"
      : "INCONCLUSIVE_MIDDLE_BAND";
  const maxAbsDeltaLine = [...investigationLines]
    .sort((left, right) => Math.abs(right.current_delta_vnd) - Math.abs(left.current_delta_vnd))[0];
  const recipeMutationLines = investigationLines.filter(line => line.mechanism === "RECIPE_OR_BATCH_YIELD_MUTATION");
  const lockedReplayContext = {
    before_task_3_recovery_delta_vnd: 120716,
    task_3_4_replay_delta_vnd: 102621,
    shift_vnd: -18095,
    source: "Task 3.4 report; not re-audited in this scoped script",
  };
  const report = {
    task: "3.6",
    generated_at: new Date().toISOString(),
    mode: "READ_ONLY",
    database_access: {
      credential: "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY",
      query_methods_used: ["select"],
      read_only_rpc_methods_used: [],
      database_mutation_methods_used: [],
      local_files_written: [OUTPUT_PATH],
      schema_limit: "stock_ledger.created_at is effective time; source header created_at is used as the independent visibility timestamp when available",
    },
    population: {
      frozen_71_count: frozenLines.length,
      new_42_count: investigationLines.length - frozenLines.length,
      total_count: investigationLines.length,
      total_delta_vnd: sum(investigationLines.map(line => line.current_delta_vnd)),
      frozen_71_delta_vnd: sum(frozenLines.map(line => line.current_delta_vnd)),
      date_range: [investigationLines[0]?.sale_time || "", investigationLines.at(-1)?.sale_time || ""],
      all_currently_mismatched: missingTargets.length === 0,
    },
    mechanism_summary: summarize(investigationLines, line => line.mechanism),
    product_summary: summarize(investigationLines, line => line.product_id),
    shortfall_btp_summary: summarizeExploded(investigationLines, line => line.shortfall_btp_ids),
    operator_summary: operatorSummary,
    operator_denominator: {
      filter: "orders_v2.created_at >= 2026-07-01T00:00:00Z AND < 2026-07-15T00:00:00Z; status IN (COMPLETED, SUPERSEDED)",
      total_orders: julyOrders.length,
      tuyen2612_orders: julyTuyenCount,
      tuyen2612_share: round(julyTuyenShare),
      frozen_drift_tuyen2612_lines: frozenLines.filter(line => line.operator_name.toLowerCase() === "tuyen2612").length,
      frozen_drift_tuyen2612_share: round(
        frozenLines.filter(line => line.operator_name.toLowerCase() === "tuyen2612").length / frozenLines.length,
      ),
      comparison_verdict: operatorConcentrationVerdict,
      all_order_operator_summary: julyOperatorSummary,
    },
    utc_hour_summary: summarize(investigationLines, line => new Date(line.sale_time).getUTCHours().toString().padStart(2, "0")),
    weekday_summary: summarize(investigationLines, line => new Date(line.sale_time).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })),
    source_schema: {
      stock_ledger_time_semantics: "created_at is the effective timestamp used by POS and audit replay",
      independent_visibility_sources: {
        PO_RECEIPT: "purchase_orders.created_at",
        PRODUCTION_YIELD: "production_orders.created_at",
        STOCK_ADJUST: "stock_adjustments.created_at",
      },
      missing_recorded_at_column: true,
    },
    recipe_evidence: {
      target_btp_ids: TARGET_BTPS,
      relevant_recipe_versions: recipes
        .filter(row => row.target_type === "SEMI_PRODUCT" && TARGET_BTPS.includes(stringValue(row.target_id)))
        .map(recipeArtifactRow),
      semi_products: semiProducts
        .filter(row => TARGET_BTPS.includes(stringValue(row.id)))
        .map(row => ({
          id: stringValue(row.id),
          name: stringValue(row.name),
          batch_yield: numberValue(row.batch_yield),
          created_at: stringValue(row.created_at),
          updated_at: stringValue(row.updated_at),
        })),
      recipe_mutation_line_count: recipeMutationLines.length,
      recipe_mutation_exact_reproduction_count: recipeMutationLines.filter(line => line.exact_write_time_reproduction).length,
      visibility_ambiguous_line_count: recipeMutationLines.filter(line => (
        line.previous_recipe_ids.length > 0
        && matches(line.previous_recipe_replay_cost, line.stored_cost)
        && !matches(line.sale_recipe_replay_cost, line.stored_cost)
      )).length,
    },
    formula_evidence: {
      shared_consumption_function: "buildLineConsumptionRows",
      write_cost_function: "computeMacCostFromUnitCosts",
      audit_cost_function: "computeMacCostForConsumptionRows",
      compact_vs_full_divergence_line_count: investigationLines.filter(line => (
        Math.abs(line.sale_compact_replay_cost - line.sale_visible_ledger_replay_cost) > MATCH_THRESHOLD_VND
      )).length,
      compact_matches_stored_line_count: investigationLines.filter(line => matches(line.sale_compact_replay_cost, line.stored_cost)).length,
    },
    hypotheses: buildHypotheses(investigationLines, topFrozenOperatorShare, julyTuyenShare),
    locked_cohort_context: lockedReplayContext,
    code_history_since_cutoff: getRelevantCodeHistory(),
    stop_triggers: {
      material_single_line: Math.abs(maxAbsDeltaLine?.current_delta_vnd || 0) > 10000
        ? { line_id: maxAbsDeltaLine.line_id, delta_vnd: maxAbsDeltaLine.current_delta_vnd }
        : null,
      write_path_engine_bug: null,
      locked_cohort_same_mechanism: null,
      operator_concentration_over_50_percent: topFrozenOperatorShare > 0.5 && julyTuyenShare < 0.6
        ? {
            operator: frozenOperatorSummary[0]?.key || "UNKNOWN",
            drift_share: round(topFrozenOperatorShare),
            all_july_order_share: round(julyTuyenShare),
          }
        : null,
    },
    lines: investigationLines,
  };

  assertEqual(investigationLines.length, 113, "classified Task 3.6 lines");
  assertEqual(sum(report.mechanism_summary.map(row => row.line_count)), 113, "mechanism reconciliation");
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
}

function investigateLine(input: {
  cohort: "FROZEN_71" | "NEW_42";
  line: LineRow & { recipe_snapshot_json: string; modifiers_snapshot_json: string };
  order: OrderRow;
  mismatch: MacCogsLineMismatch;
  ledger: LedgerRow[];
  recipes: Array<RecipeRow & { ingredients_json: string }>;
  semiProducts: SemiProductRow[];
  currentMaps: ReturnType<typeof buildSemiProductRecipeMaps>;
  currentRecipeByBtp: Map<string, ReturnType<typeof selectEffectiveRecipe>>;
  sourceVisibilityByLedger: Map<string, string>;
  backdatedByLedger: Map<string, BackdatedEventRow[]>;
  events: EventRow[];
}): InvestigationLine {
  const errors: string[] = [];
  const saleTime = stringValue(input.order.created_at) || stringValue(input.line.created_at);
  const saleMs = timestampMs(saleTime);
  const orderLedger = input.ledger.filter(row => stringValue(row.reference_id) === input.order.id);
  const effectiveLedger = input.ledger.filter(row => (
    timestampMs(stringValue(row.created_at)) <= saleMs
    && stringValue(row.reference_id) !== input.order.id
  ));
  const snapshot = parseLineRecipeSnapshot(input.line.recipe_snapshot_json);
  applyModifierQuantities(snapshot, input.line);
  const currentBalances = buildInventoryBalances(effectiveLedger, saleTime);
  const currentRows = buildLineConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    new Map(currentBalances),
    input.currentMaps,
  );
  const currentReplayCost = computeMacCostForConsumptionRows(
    currentRows,
    effectiveLedger,
    saleTime,
    input.currentMaps,
  );

  const shortfallBtpIds = unique(currentRows.flatMap(row => extractShortfallBtpIds(row.source)));
  const saleMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts, saleTime);
  const saleRecipeRows = buildLineConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    new Map(currentBalances),
    saleMaps,
  );
  const saleRecipeReplayCost = computeMacCostForConsumptionRows(
    saleRecipeRows,
    effectiveLedger,
    saleTime,
    saleMaps,
  );

  const relevantItems = new Set(unique([
    ...currentRows.map(row => row.item_reference),
    ...saleRecipeRows.map(row => row.item_reference),
    ...shortfallBtpIds,
  ]));
  const lateCandidates = effectiveLedger
    .filter(row => relevantItems.has(stringValue(row.item_reference)))
    .map(row => lateCandidate(row, input.sourceVisibilityByLedger.get(stringValue(row.id)), saleTime))
    .filter((row): row is LateLedgerCandidate => row !== null);
  const lateIds = new Set(lateCandidates.map(row => row.ledger_id));
  const saleVisibleLedger = effectiveLedger.filter(row => !lateIds.has(stringValue(row.id)));
  const saleVisibleBalances = buildInventoryBalances(saleVisibleLedger, saleTime);
  const saleVisibleRows = buildLineConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    new Map(saleVisibleBalances),
    saleMaps,
  );
  const saleVisibleLedgerReplayCost = computeMacCostForConsumptionRows(
    saleVisibleRows,
    saleVisibleLedger,
    saleTime,
    saleMaps,
  );
  const compactUnitCosts = buildCompactMacUnitCosts(saleVisibleLedger, saleTime);
  const saleCompactReplayCost = computeMacCostFromUnitCosts(saleVisibleRows, compactUnitCosts, saleMaps);
  const storedCost = numberValue(input.line.cost_at_sale);

  const directBtpIds = extractDirectBtpIds(snapshot);
  const relevantBtpIds = unique([...directBtpIds, ...shortfallBtpIds]);
  const previousRecipe = buildPreviousRecipeCounterfactual(
    input.recipes,
    input.semiProducts,
    relevantBtpIds,
    saleTime,
  );
  const previousRecipeRows = buildLineConsumptionRows(
    snapshot,
    numberValue(input.line.qty),
    new Map(currentBalances),
    previousRecipe.maps,
  );
  const previousRecipeReplayCost = computeMacCostForConsumptionRows(
    previousRecipeRows,
    effectiveLedger,
    saleTime,
    previousRecipe.maps,
  );
  const recipeVersionChanges = relevantBtpIds.flatMap(btpId => {
    const saleRecipe = selectEffectiveRecipe(input.recipes, "SEMI_PRODUCT", btpId, saleTime);
    const currentRecipe = input.currentRecipeByBtp.get(btpId) || null;
    if (!saleRecipe || !currentRecipe || stringValue(saleRecipe.id) === stringValue(currentRecipe.id)) return [];
    return [{
      btp_id: btpId,
      sale_recipe_id: stringValue(saleRecipe.id),
      current_recipe_id: stringValue(currentRecipe.id),
      sale_recipe_created_at: stringValue(saleRecipe.created_at),
      current_recipe_created_at: stringValue(currentRecipe.created_at),
    }];
  });

  const mechanism = classifyMechanism({
    storedCost,
    currentReplayCost,
    saleRecipeReplayCost,
    previousRecipeReplayCost,
    saleVisibleLedgerReplayCost,
    saleCompactReplayCost,
    recipeVersionChanges,
    previousRecipeIds: previousRecipe.recipeIds,
    lateCandidates,
  });
  const operator = resolveOperator(input.order, input.events);
  const backdatedEventIds = unique(lateCandidates.flatMap(candidate => (
    (input.backdatedByLedger.get(candidate.ledger_id) || []).map(row => stringValue(row.id))
  )));
  const actualConsumptionItems = unique(orderLedger.map(row => stringValue(row.item_reference)));
  if (actualConsumptionItems.length === 0) errors.push("No order stock-ledger rows found");
  if (Math.abs(currentReplayCost - input.mismatch.expected_cost) > MATCH_THRESHOLD_VND) {
    errors.push(`Current replay ${currentReplayCost} differs from audit ${input.mismatch.expected_cost}`);
  }

  return {
    cohort: input.cohort,
    line_id: input.line.id,
    order_id: input.order.id,
    order_no: stringValue(input.order.order_no),
    sale_time: saleTime,
    product_id: stringValue(input.line.product_id),
    variant_id: stringValue(input.line.variant_id),
    qty: numberValue(input.line.qty),
    operator_id: operator.id,
    operator_name: operator.name,
    operator_source: operator.source,
    stored_cost: storedCost,
    current_replay_cost: currentReplayCost,
    current_delta_vnd: currentReplayCost - storedCost,
    sale_recipe_replay_cost: saleRecipeReplayCost,
    previous_recipe_replay_cost: previousRecipeReplayCost,
    sale_visible_ledger_replay_cost: saleVisibleLedgerReplayCost,
    sale_compact_replay_cost: saleCompactReplayCost,
    shortfall_btp_ids: shortfallBtpIds,
    consumed_item_ids: unique(currentRows.map(row => row.item_reference)),
    current_consumption_rows: currentRows,
    sale_recipe_consumption_rows: saleRecipeRows,
    late_ledger_candidates: lateCandidates,
    backdated_event_ids: backdatedEventIds,
    recipe_version_changes: recipeVersionChanges,
    previous_recipe_ids: previousRecipe.recipeIds,
    mechanism: mechanism.value,
    mechanism_reason: mechanism.reason,
    exact_write_time_reproduction: matches(mechanism.reproducedCost, storedCost),
    errors,
  };
}

function classifyMechanism(input: {
  storedCost: number;
  currentReplayCost: number;
  saleRecipeReplayCost: number;
  previousRecipeReplayCost: number;
  saleVisibleLedgerReplayCost: number;
  saleCompactReplayCost: number;
  recipeVersionChanges: InvestigationLine["recipe_version_changes"];
  previousRecipeIds: InvestigationLine["previous_recipe_ids"];
  lateCandidates: LateLedgerCandidate[];
}): { value: Mechanism; reason: string; reproducedCost: number } {
  if (
    input.recipeVersionChanges.length > 0
    && matches(input.saleRecipeReplayCost, input.storedCost)
    && !matches(input.currentReplayCost, input.storedCost)
  ) {
    return {
      value: "RECIPE_OR_BATCH_YIELD_MUTATION",
      reason: "The BTP recipe effective at sale reproduces stored cost while the current effective recipe does not.",
      reproducedCost: input.saleRecipeReplayCost,
    };
  }
  if (
    input.previousRecipeIds.length > 0
    && matches(input.previousRecipeReplayCost, input.storedCost)
    && !matches(input.currentReplayCost, input.storedCost)
  ) {
    return {
      value: "RECIPE_OR_BATCH_YIELD_MUTATION",
      reason: "The immediately previous BTP recipe reproduces stored cost although the recipe effective timestamp says the replacement was active; recorded-at history is absent, so late recipe visibility and stale cache cannot be separated.",
      reproducedCost: input.previousRecipeReplayCost,
    };
  }
  const exactLate = input.lateCandidates.filter(() => matches(input.saleVisibleLedgerReplayCost, input.storedCost));
  for (const type of ["PO_RECEIPT", "PRODUCTION_YIELD", "STOCK_ADJUST"] as const) {
    if (exactLate.some(row => row.transaction_type === type)) {
      const mechanismByType: Record<typeof type, Mechanism> = {
        PO_RECEIPT: "LATE_PO_RECEIPT",
        PRODUCTION_YIELD: "LATE_PRODUCTION_YIELD",
        STOCK_ADJUST: "LATE_STOCK_ADJUST",
      };
      return {
        value: mechanismByType[type],
        reason: `Removing source rows recorded after sale reproduces stored cost; candidate type ${type}.`,
        reproducedCost: input.saleVisibleLedgerReplayCost,
      };
    }
  }
  if (
    matches(input.saleCompactReplayCost, input.storedCost)
    && !matches(input.saleVisibleLedgerReplayCost, input.storedCost)
  ) {
    return {
      value: "SHORTFALL_FALLBACK_FORMULA_DRIFT",
      reason: "The POS compact MAC formula reproduces stored cost but the full-ledger audit formula does not.",
      reproducedCost: input.saleCompactReplayCost,
    };
  }
  return {
    value: "UNRESOLVED",
    reason: input.recipeVersionChanges.length > 0
      ? "A relevant BTP recipe version changed, but the available counterfactual does not exactly reproduce stored cost."
      : "No late source row or formula/recipe counterfactual exactly reproduces stored cost.",
    reproducedCost: input.saleVisibleLedgerReplayCost,
  };
}

function buildPreviousRecipeCounterfactual(
  recipes: Array<RecipeRow & { ingredients_json: string }>,
  semiProducts: SemiProductRow[],
  btpIds: string[],
  saleTime: string,
): {
  maps: ReturnType<typeof buildSemiProductRecipeMaps>;
  recipeIds: InvestigationLine["previous_recipe_ids"];
} {
  const maps = buildSemiProductRecipeMaps(recipes, semiProducts, saleTime);
  const recipeIds: InvestigationLine["previous_recipe_ids"] = [];
  for (const btpId of btpIds) {
    const selected = selectEffectiveRecipe(recipes, "SEMI_PRODUCT", btpId, saleTime);
    if (!selected) continue;
    const selectedTime = timestampMs(stringValue(selected.start_date || selected.created_at));
    const previous = recipes
      .filter(row => row.target_type === "SEMI_PRODUCT" && row.target_id === btpId)
      .filter(row => timestampMs(stringValue(row.start_date || row.created_at)) < selectedTime)
      .sort((left, right) => (
        timestampMs(stringValue(right.start_date || right.created_at))
        - timestampMs(stringValue(left.start_date || left.created_at))
      ))[0];
    if (!previous) continue;
    const parsed = JSON.parse(previous.ingredients_json || "[]") as Array<Record<string, unknown>>;
    maps.semiProductRecipes.set(btpId, parsed.map(row => ({
      ingredient_type: stringValue(row.ingredient_type) === "SEMI_PRODUCT" ? "SEMI_PRODUCT" : "BASE_INGREDIENT",
      ingredient_id: stringValue(row.ingredient_id),
      quantity: numberValue(row.quantity),
      unit_id: stringValue(row.unit_id),
    })));
    recipeIds.push({
      btp_id: btpId,
      selected_recipe_id: stringValue(selected.id),
      previous_recipe_id: stringValue(previous.id),
    });
  }
  return { maps, recipeIds };
}

function buildSourceVisibilityIndex(input: {
  ledger: LedgerRow[];
  purchaseOrders: SourceHeaderRow[];
  productionOrders: SourceHeaderRow[];
  stockAdjustments: SourceHeaderRow[];
}): Map<string, string> {
  const headers: Record<string, Map<string, SourceHeaderRow>> = {
    PO_RECEIPT: new Map(input.purchaseOrders.map(row => [stringValue(row.id), row])),
    PRODUCTION_YIELD: new Map(input.productionOrders.map(row => [stringValue(row.id), row])),
    STOCK_ADJUST: new Map(input.stockAdjustments.map(row => [stringValue(row.id), row])),
  };
  const index = new Map<string, string>();
  for (const row of input.ledger) {
    const type = stringValue(row.transaction_type);
    const header = headers[type]?.get(stringValue(row.reference_id));
    const visibility = stringValue(header?.created_at);
    if (visibility) index.set(stringValue(row.id), visibility);
  }
  return index;
}

function lateCandidate(row: LedgerRow, visibilityAt: string | undefined, saleTime: string): LateLedgerCandidate | null {
  const type = stringValue(row.transaction_type);
  if (!["PO_RECEIPT", "PRODUCTION_YIELD", "STOCK_ADJUST"].includes(type)) return null;
  if (!visibilityAt) return null;
  const saleMs = timestampMs(saleTime);
  const effectiveMs = timestampMs(stringValue(row.created_at));
  const visibilityMs = timestampMs(visibilityAt);
  if (effectiveMs > saleMs || visibilityMs <= saleMs) return null;
  return {
    ledger_id: stringValue(row.id),
    transaction_type: type,
    item_reference: stringValue(row.item_reference),
    reference_id: stringValue(row.reference_id),
    effective_at: stringValue(row.created_at),
    visibility_at: visibilityAt,
    visibility_lag_seconds: round((visibilityMs - effectiveMs) / 1000),
  };
}

function buildCompactMacUnitCosts(ledger: LedgerRow[], saleTime: string): Map<string, number> {
  const quantities = new Map<string, number>();
  const values = new Map<string, number>();
  const unitCosts = new Map<string, number>();
  const saleMs = timestampMs(saleTime);
  for (const row of [...ledger].sort(compareLedger)) {
    if (timestampMs(stringValue(row.created_at)) > saleMs) continue;
    const item = stringValue(row.item_reference);
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
      const consumeQty = Math.min(macQty, Math.abs(qty));
      macQty -= consumeQty;
      macValue -= consumeQty * latestMac;
      if (macQty === 0) macValue = 0;
      quantities.set(item, macQty);
      values.set(item, macValue);
    }
  }
  return unitCosts;
}

function buildHypotheses(
  lines: InvestigationLine[],
  topFrozenOperatorShare: number,
  julyTuyenShare: number,
): Record<string, unknown> {
  const latePo = lines.filter(line => line.late_ledger_candidates.some(row => row.transaction_type === "PO_RECEIPT"));
  const lateYield = lines.filter(line => line.late_ledger_candidates.some(row => row.transaction_type === "PRODUCTION_YIELD"));
  const lateAdjust = lines.filter(line => line.late_ledger_candidates.some(row => row.transaction_type === "STOCK_ADJUST"));
  const recipe = lines.filter(line => line.recipe_version_changes.length > 0);
  const recipeMechanism = lines.filter(line => line.mechanism === "RECIPE_OR_BATCH_YIELD_MUTATION");
  const formula = lines.filter(line => Math.abs(line.sale_compact_replay_cost - line.sale_visible_ledger_replay_cost) > MATCH_THRESHOLD_VND);
  const btp002 = lines.filter(line => line.shortfall_btp_ids.includes("BTP-002"));
  return {
    H1_late_po_receipts: hypothesisVerdict(latePo, "Late PO visibility candidates joined through purchase_orders.created_at."),
    H2_late_production_yields: hypothesisVerdict(lateYield, "Late production visibility candidates joined through production_orders.created_at."),
    H3_shortfall_formula_divergence: {
      verdict: formula.length > 0 ? "SUPPORTED" : "REJECTED",
      matched_line_count: formula.length,
      test: "Compare full-ledger audit MAC with a local reproduction of get_pos_inventory_state compact MAC on identical rows and recipe maps.",
    },
    H4_recipe_or_batch_yield_mutation: {
      verdict: recipeMechanism.length > 0 ? "CONFIRMED" : "REJECTED",
      matched_line_count: recipeMechanism.length,
      effective_version_change_line_count: recipe.length,
      visibility_ambiguous_line_count: recipeMechanism.filter(line => (
        !matches(line.sale_recipe_replay_cost, line.stored_cost)
        && matches(line.previous_recipe_replay_cost, line.stored_cost)
      )).length,
      exact_stored_cost_reproduction_count: recipeMechanism.filter(line => line.exact_write_time_reproduction).length,
      test: "Select BTP recipe effective at sale and current recipe, then replay the same top-level snapshot and sale-time ledger.",
      batch_yield_limit: "semi_products has mutable current batch_yield and no value-history table; batch-yield-only mutation is not independently falsifiable.",
    },
    H5_operator_workflow_concentration: {
      verdict: julyTuyenShare > 0.8
        ? "DISMISSED_BASE_RATE_SIMILAR"
        : julyTuyenShare < 0.6
          ? "WORKFLOW_SIGNIFICANCE_STOP_TRIGGER"
          : "INCONCLUSIVE_MIDDLE_BAND",
      top_frozen_operator_share: round(topFrozenOperatorShare),
      tuyen2612_all_july_order_share: round(julyTuyenShare),
      test: "Prefer orders_v2 creator fields; fall back to CREATE order-event actor.",
    },
    H6_visibility_trigger_threshold_gap: {
      verdict: latePo.length > 0 && latePo.every(line => line.backdated_event_ids.length > 0)
        ? "REJECTED_FOR_OBSERVED_LATE_PO_ROWS"
        : "INCONCLUSIVE",
      candidate_line_count: unique([...latePo, ...lateYield, ...lateAdjust].map(line => line.line_id)).length,
      durable_event_line_count: unique([...latePo, ...lateYield, ...lateAdjust]
        .filter(line => line.backdated_event_ids.length > 0)
        .map(line => line.line_id)).length,
      under_five_minute_candidate_count: lines.filter(line => line.late_ledger_candidates.some(row => row.visibility_lag_seconds > 0 && row.visibility_lag_seconds <= 300)).length,
      limitation: "The trigger threshold can be measured only where a source header retains an independent created_at timestamp.",
    },
    H7_btp_002_stock_state: {
      verdict: btp002.length > 0 ? "SUPPORTED_SHORTFALL_RECURRENCE" : "REJECTED",
      btp_002_line_count: btp002.length,
      sale_visible_state_diff_line_count: lines.filter(line => line.current_consumption_rows.some((row, index) => (
        row.item_reference !== line.sale_recipe_consumption_rows[index]?.item_reference
        || Math.abs(row.quantity - (line.sale_recipe_consumption_rows[index]?.quantity || 0)) > 1e-9
      ))).length,
    },
  };
}

function summarizeOperators(values: string[]): Array<{ operator: string; order_count: number; share: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .map(([operator, order_count]) => ({
      operator,
      order_count,
      share: values.length === 0 ? 0 : round(order_count / values.length),
    }))
    .sort((left, right) => right.order_count - left.order_count || left.operator.localeCompare(right.operator));
}

function hypothesisVerdict(lines: InvestigationLine[], test: string): Record<string, unknown> {
  return {
    verdict: lines.length > 0 ? "SUPPORTED_CANDIDATES" : "REJECTED",
    matched_line_count: lines.length,
    frozen_71_matched_line_count: lines.filter(line => line.cohort === "FROZEN_71").length,
    new_42_matched_line_count: lines.filter(line => line.cohort === "NEW_42").length,
    exact_stored_cost_reproduction_count: lines.filter(line => line.exact_write_time_reproduction).length,
    test,
  };
}

function resolveOperator(order: OrderRow, events: EventRow[]): { id: string; name: string; source: InvestigationLine["operator_source"] } {
  const orderId = stringValue(order.created_by_id);
  const orderName = stringValue(order.created_by_name);
  if (orderId || orderName) return { id: orderId, name: orderName, source: "ORDER" };
  const event = [...events]
    .filter(row => stringValue(row.event_type) === "CREATE")
    .sort((left, right) => timestampMs(stringValue(left.event_at)) - timestampMs(stringValue(right.event_at)))[0];
  const eventId = stringValue(event?.actor_id);
  const eventName = stringValue(event?.actor_name);
  return eventId || eventName
    ? { id: eventId, name: eventName, source: "ORDER_EVENT" }
    : { id: "", name: "UNKNOWN", source: "UNKNOWN" };
}

function createReadOnlyQueryClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service credential");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function selectAll<T extends Row>(client: SupabaseClient, table: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`SELECT ${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
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

function applyModifierQuantities(snapshot: ReturnType<typeof parseLineRecipeSnapshot>, line: LineRow): void {
  let quantities = new Map<string, number>();
  try {
    const parsed = JSON.parse(jsonString(line.modifiers_snapshot_json, "[]"));
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
    if (!modifier.modifier_qty) modifier.modifier_qty = quantities.get(modifier.modifier_id) || 1;
  }
}

function extractDirectBtpIds(snapshot: ReturnType<typeof parseLineRecipeSnapshot>): string[] {
  return unique([
    ...snapshot.variant.ingredients,
    ...snapshot.modifiers.flatMap(modifier => modifier.recipe.ingredients),
  ].filter(row => row.ingredient_type === "SEMI_PRODUCT").map(row => row.ingredient_id));
}

function extractShortfallBtpIds(source: string): string[] {
  return [...source.matchAll(/BTP_SHORTFALL:([^:]+)/g)].map(match => match[1]);
}

function recipeArtifactRow(row: RecipeRow & { ingredients_json: string }): Record<string, unknown> {
  return {
    id: stringValue(row.id),
    target_id: stringValue(row.target_id),
    status: stringValue(row.status),
    start_date: stringValue(row.start_date),
    end_date: stringValue(row.end_date),
    created_at: stringValue(row.created_at),
    ingredients: JSON.parse(row.ingredients_json || "[]"),
  };
}

function getRelevantCodeHistory(): string[] {
  const output = execFileSync("git", [
    "log", "--since=2026-07-02", "--date=iso-strict", "--pretty=format:%h|%ad|%s", "--",
    "lib/mac-cogs.ts", "lib/inventory-consumption.ts", "lib/recipe-selection.ts", "app/pos/actions.ts",
  ], { encoding: "utf8" });
  return output.split(/\r?\n/).filter(Boolean);
}

function summarize<T>(lines: InvestigationLine[], getKey: (line: InvestigationLine) => T): Array<{ key: T; line_count: number; delta_vnd: number }> {
  const groups = new Map<T, { line_count: number; delta_vnd: number }>();
  for (const line of lines) {
    const key = getKey(line);
    const group = groups.get(key) || { line_count: 0, delta_vnd: 0 };
    group.line_count += 1;
    group.delta_vnd += line.current_delta_vnd;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...group }))
    .sort((left, right) => right.line_count - left.line_count || Math.abs(right.delta_vnd) - Math.abs(left.delta_vnd));
}

function summarizeExploded(lines: InvestigationLine[], getKeys: (line: InvestigationLine) => string[]): Array<{ key: string; line_count: number; delta_vnd: number }> {
  const groups = new Map<string, { ids: Set<string>; delta_vnd: number }>();
  for (const line of lines) {
    for (const key of unique(getKeys(line))) {
      const group = groups.get(key) || { ids: new Set<string>(), delta_vnd: 0 };
      if (!group.ids.has(line.line_id)) {
        group.ids.add(line.line_id);
        group.delta_vnd += line.current_delta_vnd;
      }
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, line_count: group.ids.size, delta_vnd: group.delta_vnd }))
    .sort((left, right) => right.line_count - left.line_count || Math.abs(right.delta_vnd) - Math.abs(left.delta_vnd));
}

function printSummary(report: any): void {
  console.log("=== TASK 3.6 FORWARD-DRIFT INVESTIGATION (READ ONLY) ===");
  console.log(`Frozen cohort:       ${report.population.frozen_71_count}`);
  console.log(`New cohort:          ${report.population.new_42_count}`);
  console.log(`Total:               ${report.population.total_count}`);
  console.log(`Delta:               ${report.population.total_delta_vnd.toLocaleString("vi-VN")} VND`);
  console.table(report.mechanism_summary);
  console.log(`BTP-002 lines:       ${report.shortfall_btp_summary.find((row: any) => row.key === "BTP-002")?.line_count || 0}`);
  console.log(`Recipe exact:        ${report.recipe_evidence.recipe_mutation_exact_reproduction_count}`);
  console.log(`Formula divergence:  ${report.formula_evidence.compact_vs_full_divergence_line_count}`);
  console.log(`Stop triggers:       ${JSON.stringify(report.stop_triggers)}`);
  console.log(`JSON artifact:       ${OUTPUT_PATH}`);
  console.log("No database rows were written.");
}

function groupBy<T>(rows: T[], getKey: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function compareLedger(left: LedgerRow, right: LedgerRow): number {
  const time = timestampMs(stringValue(left.created_at)) - timestampMs(stringValue(right.created_at));
  return time || stringValue(left.id).localeCompare(stringValue(right.id));
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
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function matches(left: number, right: number): boolean {
  return Math.abs(left - right) <= MATCH_THRESHOLD_VND;
}

function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

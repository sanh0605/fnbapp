/**
 * Task 3.3: investigate the fixed 170-line MAC drift baseline.
 *
 * READ ONLY for production data. This script only writes a local JSON audit
 * artifact. It never calls a database mutation helper.
 */

import * as dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  computeMacCostForConsumptionRows,
  getMacUnitCostWithRecipeFallback,
} from "../lib/mac-cogs";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
  type SemiProductConsumptionMaps,
} from "../lib/inventory-consumption";
import {
  parseLineRecipeSnapshot,
  type LineRecipeSnapshot,
  type RecipeIngredientSnapshot,
} from "../lib/order-types";
import { selectEffectiveRecipe } from "../lib/recipe-selection";
import { FIFOTracker } from "../lib/fifo-tracker";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const BACKDATED_PATH = "docs/audits/2026-07-09-backdated-ledger-pattern.json";
const PURCHASE_RECOVERY_PATH = "docs/audits/2026-07-02-purchase-cost-recovery-plan.json";
const OUTPUT_PATH = "docs/audits/2026-07-13-task-3.3-drift-investigation.json";
const PEAK_DATE = "2026-06-26";
const MATCH_THRESHOLD_VND = 1;
const VISIBILITY_WINDOWS_MINUTES = [1, 5, 15, 30, 60, 180, 360, 720, 1440];

type Row = Record<string, unknown>;

type BaselineLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  created_at: string;
  product_id: string;
  variant_id: string;
  qty: number;
  stored_cost: number;
  expected_cost: number;
  delta: number;
  classification: string;
};

type BaselineArtifact = {
  generated_at: string;
  summary: { line_count: number; total_delta: number };
  lines: BaselineLine[];
};

type BackdatedArtifact = {
  impact_lines?: Array<{ line_id: string; delta: number }>;
};

type PurchaseRecoveryArtifact = {
  run_id: string;
  changes: Array<{
    ledger_id: string;
    item_reference: string;
    old_unit_cost: number;
    new_unit_cost: number;
  }>;
};

type OrderRow = Row & {
  id: string;
  created_at?: string;
  migration_notes?: string;
};

type LineRow = Row & {
  id: string;
  order_id: string;
  variant_id?: string;
  qty?: string | number;
  cost_at_sale?: string | number;
  recipe_snapshot_json?: string;
  modifiers_snapshot_json?: string;
};

type EventRow = Row & {
  order_id?: string;
  event_type?: string;
};

type LedgerRow = Row & {
  id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  reference_id?: string;
  created_at?: string;
  updated_at?: string;
};

type RecipeRow = Row & {
  id?: string;
  target_type?: string;
  target_id?: string;
  ingredients_json?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SemiProductRow = Row & {
  id?: string;
  batch_yield?: string | number;
  created_at?: string;
  updated_at?: string;
};

type PurchaseOrderRow = Row & {
  id?: string;
  created_at?: string;
};

type LineReplay = {
  line_id: string;
  order_no: string;
  sale_time: string;
  product_id: string;
  stored_cost: number;
  baseline_expected_cost: number;
  baseline_delta: number;
  current_replay_cost: number;
  current_replay_delta: number;
  sale_time_recipe_cost: number;
  sale_time_recipe_delta: number;
  legacy_last_wins_cost: number;
  legacy_last_wins_delta: number;
  pre_purchase_recovery_cost: number;
  pre_purchase_recovery_delta: number;
  current_matches_stored: boolean;
  sale_time_recipe_matches_stored: boolean;
  legacy_last_wins_matches_stored: boolean;
  legacy_fifo_cost: number;
  legacy_fifo_delta: number;
  legacy_fifo_matches_stored: boolean;
  legacy_direct_fifo_cost: number;
  legacy_direct_fifo_delta: number;
  legacy_direct_fifo_matches_stored: boolean;
  pre_purchase_recovery_matches_stored: boolean;
  recent_consumption_exclusion_match_minutes: number | null;
  direct_btp_ids: string[];
  current_shortfall_btp_ids: string[];
  consumed_item_ids: string[];
  current_cost_contributions: Array<{
    item_reference: string;
    quantity: number;
    unit_cost: number;
    cost: number;
    source: string;
  }>;
  snapshot_recipe_changed: boolean;
  semi_product_recipe_changed: boolean;
  errors: string[];
};

async function main(): Promise<void> {
  const baseline = readJson<BaselineArtifact>(BASELINE_PATH);
  const backdated = readJson<BackdatedArtifact>(BACKDATED_PATH);
  const purchaseRecovery = readJson<PurchaseRecoveryArtifact>(PURCHASE_RECOVERY_PATH);
  assertBaseline(baseline);

  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, events, ledger, recipes, semiProducts, purchaseOrders] = await Promise.all([
    findAllNoCache("Orders_V2") as Promise<OrderRow[]>,
    findAllNoCache("Order_Lines_V2") as Promise<LineRow[]>,
    findAllNoCache("Order_Events") as Promise<EventRow[]>,
    findAllNoCache("Stock_Ledger") as Promise<LedgerRow[]>,
    findAllNoCache("Recipes") as Promise<RecipeRow[]>,
    findAllNoCache("Semi_Products") as Promise<SemiProductRow[]>,
    findAllNoCache("Purchase_Orders") as Promise<PurchaseOrderRow[]>,
  ]);

  const generatedAt = new Date().toISOString();
  const orderById = new Map(orders.map(order => [order.id, order]));
  const lineById = new Map(lines.map(line => [line.id, line]));
  const currentMaps = buildSemiProductRecipeMaps(recipes, semiProducts, generatedAt);
  const legacyMaps = buildLegacyLastWinsMaps(recipes, semiProducts);
  const sortedLedger = [...ledger].sort(compareCreatedAt);
  const oldUnitCostByLedgerId = new Map(
    purchaseRecovery.changes.map(change => [change.ledger_id, change.old_unit_cost]),
  );
  const prePurchaseRecoveryLedger = sortedLedger.map(row => (
    oldUnitCostByLedgerId.has(stringValue(row.id))
      ? { ...row, unit_cost: oldUnitCostByLedgerId.get(stringValue(row.id)) }
      : row
  ));
  const legacyFifoCostByLine = buildLegacyFifoCosts({
    baselineLines: baseline.lines,
    allLines: lines,
    orderById,
    ledger: sortedLedger,
    maps: legacyMaps,
  });
  const legacyDirectFifoCostByLine = buildLegacyDirectFifoCosts({
    baselineLines: baseline.lines,
    allLines: lines,
    orderById,
    ledger: sortedLedger,
  });

  const missingLineIds = baseline.lines
    .filter(line => !lineById.has(line.line_id) || !orderById.has(line.order_id))
    .map(line => line.line_id);
  if (missingLineIds.length > 0) {
    throw new Error(`Baseline rows missing from live data: ${missingLineIds.join(", ")}`);
  }

  const replays = baseline.lines.map(baselineLine => replayLine({
    baselineLine,
    line: lineById.get(baselineLine.line_id) as LineRow,
    order: orderById.get(baselineLine.order_id) as OrderRow,
    ledger: sortedLedger,
    prePurchaseRecoveryLedger,
    recipes,
    semiProducts,
    currentMaps,
    legacyMaps,
    legacyFifoCost: legacyFifoCostByLine.get(baselineLine.line_id) ?? 0,
    legacyDirectFifoCost: legacyDirectFifoCostByLine.get(baselineLine.line_id) ?? 0,
    generatedAt,
  }));

  const migratedOrderIds = new Set(
    events
      .filter(event => ["MIGRATED", "IMPORTED"].includes(stringValue(event.event_type)))
      .map(event => stringValue(event.order_id))
      .filter(Boolean),
  );
  const migratedLines = baseline.lines.filter(line => {
    const order = orderById.get(line.order_id);
    return migratedOrderIds.has(line.order_id) || Boolean(stringValue(order?.migration_notes));
  });

  const preciseBackdatedMatches = findPreciseBackdatedMatches({
    baselineLines: baseline.lines,
    replays,
    ledger,
    purchaseOrders,
  });
  const durableBackdatedLineIds = new Set(
    (backdated.impact_lines || []).map(line => line.line_id),
  );
  const baselineBackdatedLines = baseline.lines.filter(line => durableBackdatedLineIds.has(line.line_id));

  const codeHistory = getRelevantCodeHistory();
  const peakLines = baseline.lines.filter(line => dateKey(line.created_at) === PEAK_DATE);
  const peakRecipeRows = recipes.filter(row => (
    dateKey(stringValue(row.created_at)) === PEAK_DATE
    || dateKey(stringValue(row.updated_at)) === PEAK_DATE
  ));
  const peakSemiProductRows = semiProducts.filter(row => (
    dateKey(stringValue(row.created_at)) === PEAK_DATE
    || dateKey(stringValue(row.updated_at)) === PEAK_DATE
  ));
  const peakLedgerRows = ledger.filter(row => dateKey(stringValue(row.created_at)) === PEAK_DATE);

  const rootCauseLines = classifyRootCauseLines(
    baseline.lines,
    replays,
    durableBackdatedLineIds,
    new Set(migratedLines.map(line => line.line_id)),
  );
  const rootCauseSummary = summarizeRootCauses(rootCauseLines);

  const directBtpIds = unique(replays.flatMap(line => line.direct_btp_ids));
  const batchYieldEvidence = directBtpIds.map(id => {
    const semiProduct = semiProducts.find(row => row.id === id);
    return {
      semi_product_id: id,
      batch_yield: numberValue(semiProduct?.batch_yield),
      created_at: stringValue(semiProduct?.created_at),
      updated_at: stringValue(semiProduct?.updated_at),
      history_row_count: semiProducts.filter(row => row.id === id).length,
    };
  });

  const report = {
    generated_at: generatedAt,
    contract: {
      production_data_access: "READ_ONLY",
      database_mutation_helpers_used: [],
      local_artifact_written: OUTPUT_PATH,
      baseline_path: BASELINE_PATH,
      baseline_line_count: baseline.lines.length,
      baseline_total_delta_vnd: baseline.summary.total_delta,
    },
    live_replay_drift: {
      line_count_with_changed_expected_cost: replays.filter(line => (
        line.current_replay_cost !== line.baseline_expected_cost
      )).length,
      current_replay_delta_vnd: sum(replays.map(line => line.current_replay_delta)),
      baseline_delta_vnd: sum(baseline.lines.map(line => line.delta)),
    },
    hypotheses: {
      H1_historical_migration: {
        verdict: migratedLines.length <= 2 ? "REJECTED_AS_PRIMARY_CAUSE" : "PARTIAL",
        matched_line_count: migratedLines.length,
        baseline_delta_vnd: sum(migratedLines.map(line => line.delta)),
        lines: migratedLines.map(compactBaselineLine),
      },
      H2_backdating_beyond_detection: {
        verdict: preciseBackdatedMatches.some(match => match.lag_minutes <= 5)
          ? "PARTIAL"
          : "REJECTED_BEYOND_EXISTING_SCOPE",
        durable_task_3_2_line_count: baselineBackdatedLines.length,
        durable_task_3_2_abs_delta_vnd: sum(baselineBackdatedLines.map(line => Math.abs(line.delta))),
        live_precise_match_line_count: unique(preciseBackdatedMatches.map(match => match.line_id)).length,
        live_matches_at_or_below_5_minutes: preciseBackdatedMatches.filter(match => match.lag_minutes <= 5).length,
        stock_adjust_and_production_yield_limit:
          "No independent durable visibility timestamp exists for historical STOCK_ADJUST or PRODUCTION_YIELD rows.",
        precise_matches: preciseBackdatedMatches,
      },
      H3_line_recipe_snapshot_drift: {
        verdict: "REJECTED_AS_REPLAY_CAUSE",
        rationale:
          "The MAC audit replays each line from recipe_snapshot_json; it does not substitute the current product or modifier recipe.",
        changed_line_count: replays.filter(line => line.snapshot_recipe_changed).length,
        baseline_delta_vnd: sum(replays.filter(line => line.snapshot_recipe_changed).map(line => line.baseline_delta)),
        lines: replays.filter(line => line.snapshot_recipe_changed).map(compactReplay),
      },
      H4_mac_engine_code_drift: {
        verdict: replays.some(line => line.legacy_direct_fifo_matches_stored)
          ? "PARTIAL_NOT_PRIMARY"
          : "REJECTED",
        rationale:
          "Current MAC, sale-time recipe MAC, legacy last-wins MAC, full FIFO, and direct FIFO were replayed. Direct FIFO matches only two lines and does not explain the primary drift.",
        legacy_last_wins_exact_line_count: replays.filter(line => line.legacy_last_wins_matches_stored).length,
        legacy_last_wins_exact_baseline_delta_vnd: sum(
          replays.filter(line => line.legacy_last_wins_matches_stored).map(line => line.baseline_delta),
        ),
        sale_time_recipe_exact_line_count: replays.filter(line => line.sale_time_recipe_matches_stored).length,
        current_exact_line_count: replays.filter(line => line.current_matches_stored).length,
        legacy_fifo_exact_line_count: replays.filter(line => line.legacy_fifo_matches_stored).length,
        legacy_fifo_exact_baseline_delta_vnd: sum(
          replays.filter(line => line.legacy_fifo_matches_stored).map(line => line.baseline_delta),
        ),
        legacy_direct_fifo_exact_line_count: replays.filter(
          line => line.legacy_direct_fifo_matches_stored,
        ).length,
        legacy_direct_fifo_exact_baseline_delta_vnd: sum(
          replays.filter(line => line.legacy_direct_fifo_matches_stored).map(line => line.baseline_delta),
        ),
        recent_consumption_visibility_window_exact_line_count: replays.filter(
          line => line.recent_consumption_exclusion_match_minutes !== null,
        ).length,
        relevant_git_history: codeHistory,
        lines: replays.filter(line => line.legacy_last_wins_matches_stored).map(compactReplay),
      },
      H5_semi_product_recipe_or_yield_change: {
        verdict: replays.some(line => line.semi_product_recipe_changed) ? "PARTIAL" : "INCONCLUSIVE",
        recipe_changed_line_count: replays.filter(line => line.semi_product_recipe_changed).length,
        recipe_changed_baseline_delta_vnd: sum(
          replays.filter(line => line.semi_product_recipe_changed).map(line => line.baseline_delta),
        ),
        sale_time_recipe_exact_line_count: replays.filter(line => line.sale_time_recipe_matches_stored).length,
        batch_yield_history_verdict: batchYieldEvidence.every(row => row.history_row_count === 1)
          ? "INCONCLUSIVE_SINGLE_MUTABLE_ROW"
          : "HISTORY_AVAILABLE",
        batch_yield_evidence: batchYieldEvidence,
        lines: replays.filter(line => line.semi_product_recipe_changed).map(compactReplay),
      },
      H6_peak_date_event: {
        verdict: "REJECTED_AS_STANDALONE_CAUSE",
        peak_date: PEAK_DATE,
        line_count: peakLines.length,
        baseline_delta_vnd: sum(peakLines.map(line => line.delta)),
        ledger_by_transaction_type: countBy(peakLedgerRows, row => stringValue(row.transaction_type)),
        recipe_rows_created_or_updated: peakRecipeRows.map(compactRecipe),
        semi_product_rows_created_or_updated: peakSemiProductRows.map(row => ({
          id: stringValue(row.id),
          batch_yield: numberValue(row.batch_yield),
          created_at: stringValue(row.created_at),
          updated_at: stringValue(row.updated_at),
        })),
        peak_lines: peakLines.map(compactBaselineLine),
      },
      H7_purchase_cost_recovery: {
        verdict: replays.some(line => line.pre_purchase_recovery_matches_stored)
          ? "CONFIRMED"
          : "REJECTED",
        recovery_run_id: purchaseRecovery.run_id,
        changed_ledger_inputs: purchaseRecovery.changes,
        exact_line_count: replays.filter(line => line.pre_purchase_recovery_matches_stored).length,
        exact_baseline_delta_vnd: sum(
          replays.filter(line => line.pre_purchase_recovery_matches_stored).map(line => line.baseline_delta),
        ),
        lines: replays.filter(line => line.pre_purchase_recovery_matches_stored).map(compactReplay),
      },
    },
    root_cause_classification: rootCauseSummary,
    unresolved_provenance: {
      verdict: "INCONCLUSIVE_MISSING_WRITE_TIME_VISIBILITY",
      rationale:
        "The remaining rows have no durable ledger visibility timestamp or write-time ledger snapshot, so the exact input state used to store cost_at_sale cannot be reconstructed.",
      line_count: rootCauseLines.filter(line => (
        line.cause === "UNRESOLVED_WRITE_TIME_PROVENANCE"
      )).length,
      baseline_delta_vnd: sum(rootCauseLines.filter(line => (
        line.cause === "UNRESOLVED_WRITE_TIME_PROVENANCE"
      )).map(line => line.delta)),
      sale_times: replays
        .filter(line => rootCauseLines.some(root => (
          root.line_id === line.line_id && root.cause === "UNRESOLVED_WRITE_TIME_PROVENANCE"
        )))
        .map(line => line.sale_time)
        .sort(),
    },
    line_replays: replays,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
}

function replayLine(input: {
  baselineLine: BaselineLine;
  line: LineRow;
  order: OrderRow;
  ledger: LedgerRow[];
  prePurchaseRecoveryLedger: LedgerRow[];
  recipes: RecipeRow[];
  semiProducts: SemiProductRow[];
  currentMaps: SemiProductConsumptionMaps;
  legacyMaps: SemiProductConsumptionMaps;
  legacyFifoCost: number;
  legacyDirectFifoCost: number;
  generatedAt: string;
}): LineReplay {
  const { baselineLine, line, order } = input;
  const errors: string[] = [];
  const saleTime = stringValue(order.created_at) || baselineLine.created_at;
  const saleMs = timestampMs(saleTime);
  const ledgerBeforeOrder = input.ledger.filter(row => (
    timestampMs(stringValue(row.created_at)) <= saleMs
    && stringValue(row.reference_id) !== order.id
  ));
  const prePurchaseRecoveryLedgerBeforeOrder = input.prePurchaseRecoveryLedger.filter(row => (
    timestampMs(stringValue(row.created_at)) <= saleMs
    && stringValue(row.reference_id) !== order.id
  ));
  const parsed = parseLineRecipeSnapshot(stringValue(line.recipe_snapshot_json) || "{}");
  applyModifierQuantities(parsed, line);
  const saleTimeMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts, saleTime);

  const current = runReplay(parsed, line, saleTime, ledgerBeforeOrder, input.currentMaps, errors, "current");
  const saleTimeRecipe = runReplay(parsed, line, saleTime, ledgerBeforeOrder, saleTimeMaps, errors, "sale-time");
  const legacy = runReplay(parsed, line, saleTime, ledgerBeforeOrder, input.legacyMaps, errors, "legacy");
  const prePurchaseRecovery = runReplay(
    parsed,
    line,
    saleTime,
    prePurchaseRecoveryLedgerBeforeOrder,
    input.currentMaps,
    errors,
    "pre-purchase-recovery",
  );
  const visibilityWindowMatch = findVisibilityWindowMatch({
    recipe: parsed,
    line,
    saleTime,
    ledgerBeforeOrder,
    maps: input.currentMaps,
  });
  const storedCost = numberValue(line.cost_at_sale);
  const directBtpIds = extractDirectBtpIds(parsed);
  const shortfallBtpIds = unique(current.rows.flatMap(row => extractShortfallBtpIds(row.source)));
  const snapshotRecipeChanged = snapshotDiffersFromCurrent(parsed, input.recipes, input.generatedAt);
  const semiProductRecipeChanged = directBtpIds.some(id => (
    canonicalRecipeMapValue(saleTimeMaps.semiProductRecipes.get(id))
    !== canonicalRecipeMapValue(input.currentMaps.semiProductRecipes.get(id))
  ));
  const currentCostContributions = current.rows.map(row => {
    const unitCost = getMacUnitCostWithRecipeFallback(
      row.item_reference,
      ledgerBeforeOrder,
      saleTime,
      input.currentMaps,
    );
    return {
      item_reference: row.item_reference,
      quantity: row.quantity,
      unit_cost: unitCost,
      cost: row.quantity * unitCost,
      source: row.source,
    };
  }).sort((left, right) => Math.abs(right.cost) - Math.abs(left.cost));

  return {
    line_id: baselineLine.line_id,
    order_no: baselineLine.order_no,
    sale_time: saleTime,
    product_id: baselineLine.product_id,
    stored_cost: storedCost,
    baseline_expected_cost: baselineLine.expected_cost,
    baseline_delta: baselineLine.delta,
    current_replay_cost: current.cost,
    current_replay_delta: current.cost - storedCost,
    sale_time_recipe_cost: saleTimeRecipe.cost,
    sale_time_recipe_delta: saleTimeRecipe.cost - storedCost,
    legacy_last_wins_cost: legacy.cost,
    legacy_last_wins_delta: legacy.cost - storedCost,
    pre_purchase_recovery_cost: prePurchaseRecovery.cost,
    pre_purchase_recovery_delta: prePurchaseRecovery.cost - storedCost,
    current_matches_stored: Math.abs(current.cost - storedCost) <= MATCH_THRESHOLD_VND,
    sale_time_recipe_matches_stored: Math.abs(saleTimeRecipe.cost - storedCost) <= MATCH_THRESHOLD_VND,
    legacy_last_wins_matches_stored: Math.abs(legacy.cost - storedCost) <= MATCH_THRESHOLD_VND,
    legacy_fifo_cost: input.legacyFifoCost,
    legacy_fifo_delta: input.legacyFifoCost - storedCost,
    legacy_fifo_matches_stored:
      Math.abs(input.legacyFifoCost - storedCost) <= MATCH_THRESHOLD_VND,
    legacy_direct_fifo_cost: input.legacyDirectFifoCost,
    legacy_direct_fifo_delta: input.legacyDirectFifoCost - storedCost,
    legacy_direct_fifo_matches_stored:
      Math.abs(input.legacyDirectFifoCost - storedCost) <= MATCH_THRESHOLD_VND,
    pre_purchase_recovery_matches_stored:
      Math.abs(prePurchaseRecovery.cost - storedCost) <= MATCH_THRESHOLD_VND,
    recent_consumption_exclusion_match_minutes: visibilityWindowMatch,
    direct_btp_ids: directBtpIds,
    current_shortfall_btp_ids: shortfallBtpIds,
    consumed_item_ids: unique(current.rows.map(row => row.item_reference)),
    current_cost_contributions: currentCostContributions,
    snapshot_recipe_changed: snapshotRecipeChanged,
    semi_product_recipe_changed: semiProductRecipeChanged,
    errors,
  };
}

function runReplay(
  recipe: LineRecipeSnapshot,
  line: LineRow,
  saleTime: string,
  ledgerBeforeOrder: LedgerRow[],
  maps: SemiProductConsumptionMaps,
  errors: string[],
  label: string,
): { cost: number; rows: ConsumptionRow[] } {
  try {
    const balances = buildInventoryBalances(ledgerBeforeOrder, saleTime);
    const rows = buildLineConsumptionRows(recipe, numberValue(line.qty), balances, maps);
    return {
      rows,
      cost: computeMacCostForConsumptionRows(rows, ledgerBeforeOrder, saleTime, maps),
    };
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return { rows: [], cost: 0 };
  }
}

function findVisibilityWindowMatch(input: {
  recipe: LineRecipeSnapshot;
  line: LineRow;
  saleTime: string;
  ledgerBeforeOrder: LedgerRow[];
  maps: SemiProductConsumptionMaps;
}): number | null {
  const storedCost = numberValue(input.line.cost_at_sale);
  const saleMs = timestampMs(input.saleTime);
  for (const minutes of VISIBILITY_WINDOWS_MINUTES) {
    const cutoffMs = saleMs - minutes * 60_000;
    const visibleLedger = input.ledgerBeforeOrder.filter(row => {
      const rowMs = timestampMs(stringValue(row.created_at));
      const isRecentConsumption = numberValue(row.quantity_change) < 0 && rowMs > cutoffMs;
      return !isRecentConsumption;
    });
    const replay = runReplay(
      input.recipe,
      input.line,
      input.saleTime,
      visibleLedger,
      input.maps,
      [],
      `visibility-${minutes}`,
    );
    if (Math.abs(replay.cost - storedCost) <= MATCH_THRESHOLD_VND) return minutes;
  }
  return null;
}

function buildLegacyFifoCosts(input: {
  baselineLines: BaselineLine[];
  allLines: LineRow[];
  orderById: Map<string, OrderRow>;
  ledger: LedgerRow[];
  maps: SemiProductConsumptionMaps;
}): Map<string, number> {
  const baselineLineIds = new Set(input.baselineLines.map(line => line.line_id));
  const baselineOrderIds = unique(input.baselineLines.map(line => line.order_id));
  const costs = new Map<string, number>();

  for (const orderId of baselineOrderIds) {
    const order = input.orderById.get(orderId);
    if (!order?.created_at) continue;
    const saleMs = timestampMs(order.created_at);
    const pastLedger = input.ledger.filter(row => (
      timestampMs(stringValue(row.created_at)) <= saleMs
      && stringValue(row.reference_id) !== orderId
    ));
    const tracker = new FIFOTracker();
    tracker.init(pastLedger as any[]);
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const orderLines = input.allLines
      .filter(line => line.order_id === orderId)
      .sort((left, right) => (
        numberValue(left.line_no) - numberValue(right.line_no)
        || left.id.localeCompare(right.id)
      ));

    for (const line of orderLines) {
      const snapshot = parseLineRecipeSnapshot(stringValue(line.recipe_snapshot_json) || "{}");
      applyModifierQuantities(snapshot, line);
      const rows = buildLineConsumptionRows(snapshot, numberValue(line.qty), balances, input.maps);
      const cost = Math.round(rows.reduce(
        (total, row) => total + tracker.consume(row.item_reference, row.quantity),
        0,
      ));
      if (baselineLineIds.has(line.id)) costs.set(line.id, cost);
    }
  }
  return costs;
}

function buildLegacyDirectFifoCosts(input: {
  baselineLines: BaselineLine[];
  allLines: LineRow[];
  orderById: Map<string, OrderRow>;
  ledger: LedgerRow[];
}): Map<string, number> {
  const baselineLineIds = new Set(input.baselineLines.map(line => line.line_id));
  const costs = new Map<string, number>();

  for (const orderId of unique(input.baselineLines.map(line => line.order_id))) {
    const order = input.orderById.get(orderId);
    if (!order?.created_at) continue;
    const saleMs = timestampMs(order.created_at);
    const pastLedger = input.ledger.filter(row => (
      timestampMs(stringValue(row.created_at)) <= saleMs
      && stringValue(row.reference_id) !== orderId
    ));
    const tracker = new FIFOTracker();
    tracker.init(pastLedger as any[]);
    const orderLines = input.allLines
      .filter(line => line.order_id === orderId)
      .sort((left, right) => (
        numberValue(left.line_no) - numberValue(right.line_no)
        || left.id.localeCompare(right.id)
      ));

    for (const line of orderLines) {
      const snapshot = parseLineRecipeSnapshot(stringValue(line.recipe_snapshot_json) || "{}");
      applyModifierQuantities(snapshot, line);
      const rawRows = [
        ...snapshot.variant.ingredients.map(ingredient => ({
          item_reference: ingredient.ingredient_id,
          quantity: numberValue(ingredient.quantity) * numberValue(line.qty),
        })),
        ...snapshot.modifiers.flatMap(modifier => modifier.recipe.ingredients.map(ingredient => ({
          item_reference: ingredient.ingredient_id,
          quantity: numberValue(ingredient.quantity)
            * numberValue(line.qty)
            * numberValue(modifier.modifier_qty || 1),
        }))),
      ];
      const cost = Math.round(rawRows.reduce(
        (total, row) => total + tracker.consume(row.item_reference, row.quantity),
        0,
      ));
      if (baselineLineIds.has(line.id)) costs.set(line.id, cost);
    }
  }
  return costs;
}

function buildLegacyLastWinsMaps(
  recipes: RecipeRow[],
  semiProducts: SemiProductRow[],
): SemiProductConsumptionMaps {
  const semiProductRecipes = new Map<string, RecipeIngredientSnapshot[]>();
  for (const recipe of recipes) {
    if (recipe.target_type !== "SEMI_PRODUCT" || !recipe.target_id) continue;
    try {
      const parsed = JSON.parse(stringValue(recipe.ingredients_json) || "[]");
      if (Array.isArray(parsed)) {
        semiProductRecipes.set(recipe.target_id, parsed as RecipeIngredientSnapshot[]);
      }
    } catch {
      // This mirrors the pre-d23211f implementation.
    }
  }
  const semiProductYields = new Map<string, number>();
  for (const semiProduct of semiProducts) {
    if (semiProduct.id) {
      semiProductYields.set(semiProduct.id, numberValue(semiProduct.batch_yield) || 1);
    }
  }
  return { semiProductRecipes, semiProductYields };
}

function findPreciseBackdatedMatches(input: {
  baselineLines: BaselineLine[];
  replays: LineReplay[];
  ledger: LedgerRow[];
  purchaseOrders: PurchaseOrderRow[];
}): Array<{
  line_id: string;
  ledger_id: string;
  item_reference: string;
  lag_minutes: number;
}> {
  const purchaseOrderById = new Map(
    input.purchaseOrders.map(order => [stringValue(order.id), order]),
  );
  const replayById = new Map(input.replays.map(replay => [replay.line_id, replay]));
  const matches: Array<{
    line_id: string;
    ledger_id: string;
    item_reference: string;
    lag_minutes: number;
  }> = [];

  for (const row of input.ledger) {
    if (row.transaction_type !== "PO_RECEIPT") continue;
    const purchaseOrder = purchaseOrderById.get(stringValue(row.reference_id));
    const effectiveMs = timestampMs(stringValue(row.created_at));
    const visibleMs = timestampMs(stringValue(purchaseOrder?.created_at));
    if (!Number.isFinite(effectiveMs) || !Number.isFinite(visibleMs) || effectiveMs >= visibleMs) continue;
    const itemReference = stringValue(row.item_reference);

    for (const line of input.baselineLines) {
      const saleMs = timestampMs(line.created_at);
      if (saleMs < effectiveMs || saleMs > visibleMs) continue;
      const replay = replayById.get(line.line_id);
      if (!replay?.consumed_item_ids.includes(itemReference)) continue;
      matches.push({
        line_id: line.line_id,
        ledger_id: stringValue(row.id),
        item_reference: itemReference,
        lag_minutes: Math.round((visibleMs - effectiveMs) / 60000),
      });
    }
  }
  return matches.sort((left, right) => (
    left.line_id.localeCompare(right.line_id) || left.ledger_id.localeCompare(right.ledger_id)
  ));
}

function snapshotDiffersFromCurrent(
  snapshot: LineRecipeSnapshot,
  recipes: RecipeRow[],
  asOf: string,
): boolean {
  const components = [
    snapshot.variant,
    ...snapshot.modifiers.map(modifier => modifier.recipe),
  ];
  return components.some(component => {
    const current = selectEffectiveRecipe(
      recipes,
      component.target_type,
      component.target_id,
      asOf,
    );
    return canonicalIngredients(component.ingredients)
      !== canonicalIngredients(current?.ingredients_json);
  });
}

function extractDirectBtpIds(snapshot: LineRecipeSnapshot): string[] {
  return unique([
    ...snapshot.variant.ingredients,
    ...snapshot.modifiers.flatMap(modifier => modifier.recipe.ingredients),
  ].filter(ingredient => ingredient.ingredient_type === "SEMI_PRODUCT")
    .map(ingredient => ingredient.ingredient_id));
}

function extractShortfallBtpIds(source: string): string[] {
  return [...source.matchAll(/BTP_SHORTFALL:([^:]+)/g)].map(match => match[1]);
}

function applyModifierQuantities(snapshot: LineRecipeSnapshot, line: LineRow): void {
  let quantities = new Map<string, number>();
  try {
    const parsed = JSON.parse(stringValue(line.modifiers_snapshot_json) || "[]");
    if (Array.isArray(parsed)) {
      quantities = new Map(parsed.map(modifier => [
        stringValue((modifier as Row).id),
        numberValue((modifier as Row).qty) || 1,
      ]));
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

function classifyRootCauseLines(
  lines: BaselineLine[],
  replays: LineReplay[],
  backdatedLineIds: Set<string>,
  migratedLineIds: Set<string>,
): Array<{ line_id: string; cause: string; delta: number }> {
  const replayById = new Map(replays.map(replay => [replay.line_id, replay]));
  return lines.map(line => {
    const replay = replayById.get(line.line_id) as LineReplay;
    let cause = "UNRESOLVED_WRITE_TIME_PROVENANCE";
    if (replay.pre_purchase_recovery_matches_stored && !replay.current_matches_stored) {
      cause = "PURCHASE_COST_RECOVERY_2026_07_02";
    } else if (backdatedLineIds.has(line.line_id)) {
      cause = "BACKDATED_LEDGER";
    } else if (migratedLineIds.has(line.line_id)) {
      cause = "MIGRATION_MARKER";
    } else if (replay.current_matches_stored) {
      cause = "LIVE_REPLAY_NOW_MATCHES_STORED";
    }
    return { line_id: line.line_id, cause, delta: line.delta };
  });
}

function summarizeRootCauses(
  lines: Array<{ line_id: string; cause: string; delta: number }>,
): Array<{ cause: string; line_count: number; baseline_delta_vnd: number; abs_delta_vnd: number }> {
  const groups = new Map<string, { line_count: number; baseline_delta_vnd: number; abs_delta_vnd: number }>();
  for (const line of lines) {
    const group = groups.get(line.cause) || { line_count: 0, baseline_delta_vnd: 0, abs_delta_vnd: 0 };
    group.line_count += 1;
    group.baseline_delta_vnd += line.delta;
    group.abs_delta_vnd += Math.abs(line.delta);
    groups.set(line.cause, group);
  }
  return [...groups.entries()]
    .map(([cause, values]) => ({ cause, ...values }))
    .sort((left, right) => right.abs_delta_vnd - left.abs_delta_vnd);
}

function getRelevantCodeHistory(): string[] {
  const output = execFileSync("git", [
    "log",
    "--since=2026-06-20",
    "--until=2026-07-06 23:59:59",
    "--date=iso-strict",
    "--pretty=format:%h|%ad|%s",
    "--",
    "lib/mac-cogs.ts",
    "lib/mac-cogs-audit.ts",
    "lib/inventory-consumption.ts",
    "lib/recipe-selection.ts",
    "app/pos/actions.ts",
    "app/admin/orders/actions.ts",
  ], { encoding: "utf8" });
  return output.split(/\r?\n/).filter(Boolean);
}

function canonicalIngredients(value: unknown): string {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
    if (!Array.isArray(parsed)) return "MISSING_OR_INVALID";
    return JSON.stringify(parsed.map(item => {
      const row = item as Row;
      return {
        ingredient_type: stringValue(row.ingredient_type) || "BASE_INGREDIENT",
        ingredient_id: stringValue(row.ingredient_id),
        quantity: numberValue(row.quantity),
        unit_id: stringValue(row.unit_id),
      };
    }).sort((left, right) => (
      `${left.ingredient_type}:${left.ingredient_id}`
        .localeCompare(`${right.ingredient_type}:${right.ingredient_id}`)
    )));
  } catch {
    return "MISSING_OR_INVALID";
  }
}

function canonicalRecipeMapValue(value: RecipeIngredientSnapshot[] | undefined): string {
  return canonicalIngredients(value || []);
}

function compactBaselineLine(line: BaselineLine): Row {
  return {
    line_id: line.line_id,
    order_no: line.order_no,
    created_at: line.created_at,
    product_id: line.product_id,
    delta: line.delta,
    classification: line.classification,
  };
}

function compactReplay(line: LineReplay): Row {
  return {
    line_id: line.line_id,
    order_no: line.order_no,
    sale_time: line.sale_time,
    product_id: line.product_id,
    baseline_delta: line.baseline_delta,
    current_replay_delta: line.current_replay_delta,
    sale_time_recipe_delta: line.sale_time_recipe_delta,
    legacy_last_wins_delta: line.legacy_last_wins_delta,
    legacy_fifo_delta: line.legacy_fifo_delta,
    legacy_direct_fifo_delta: line.legacy_direct_fifo_delta,
    pre_purchase_recovery_delta: line.pre_purchase_recovery_delta,
    recent_consumption_exclusion_match_minutes: line.recent_consumption_exclusion_match_minutes,
    direct_btp_ids: line.direct_btp_ids,
  };
}

function compactRecipe(row: RecipeRow): Row {
  return {
    id: stringValue(row.id),
    target_type: stringValue(row.target_type),
    target_id: stringValue(row.target_id),
    status: stringValue(row.status),
    created_at: stringValue(row.created_at),
    updated_at: stringValue(row.updated_at),
  };
}

function countBy<T>(rows: T[], getKey: (row: T) => string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row) || "(blank)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function printSummary(report: any): void {
  console.log("=== TASK 3.3 MAC DRIFT INVESTIGATION (READ ONLY) ===");
  console.log(`Baseline lines:             ${report.contract.baseline_line_count}`);
  console.log(`Baseline delta:             ${formatVnd(report.contract.baseline_total_delta_vnd)}`);
  console.log(`Live expected-cost changes: ${report.live_replay_drift.line_count_with_changed_expected_cost}`);
  console.log(`H1 migrated lines:          ${report.hypotheses.H1_historical_migration.matched_line_count}`);
  console.log(`H2 durable backdated lines: ${report.hypotheses.H2_backdating_beyond_detection.durable_task_3_2_line_count}`);
  console.log(`H3 snapshot-changed lines:  ${report.hypotheses.H3_line_recipe_snapshot_drift.changed_line_count}`);
  console.log(`H4 legacy exact matches:    ${report.hypotheses.H4_mac_engine_code_drift.legacy_last_wins_exact_line_count}`);
  console.log(`H5 SP-recipe changes:       ${report.hypotheses.H5_semi_product_recipe_or_yield_change.recipe_changed_line_count}`);
  console.log(`H6 peak-date delta:         ${formatVnd(report.hypotheses.H6_peak_date_event.baseline_delta_vnd)}`);
  console.log(`H7 recovery exact matches: ${report.hypotheses.H7_purchase_cost_recovery.exact_line_count}`);
  console.log("Root-cause classification:");
  console.table(report.root_cause_classification);
  console.log(`JSON artifact:              ${OUTPUT_PATH}`);
  console.log("No database rows were written.");
}

function assertBaseline(baseline: BaselineArtifact): void {
  if (baseline.summary.line_count !== 170 || baseline.lines.length !== 170) {
    throw new Error(
      `Expected fixed 170-line baseline, got summary=${baseline.summary.line_count}, lines=${baseline.lines.length}`,
    );
  }
  const duplicateIds = baseline.lines
    .map(line => line.line_id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate baseline line IDs: ${unique(duplicateIds).join(", ")}`);
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function compareCreatedAt(left: { created_at?: string }, right: { created_at?: string }): number {
  return timestampMs(stringValue(left.created_at)) - timestampMs(stringValue(right.created_at));
}

function dateKey(value: string): string {
  const time = timestampMs(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "";
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

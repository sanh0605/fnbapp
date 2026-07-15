/**
 * Task 3.4: investigate live MAC mismatches outside the fixed 170-line cohort.
 *
 * Production access is read-only. The Supabase client in this script only
 * issues SELECT queries. The only write is the local JSON audit artifact.
 */

import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditMacCogsDrift, type MacCogsLineMismatch } from "../lib/mac-cogs-audit";
import { computeMacCostForConsumptionRows } from "../lib/mac-cogs";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "../lib/inventory-consumption";
import { parseLineRecipeSnapshot } from "../lib/order-types";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const TASK_3_3_PATH = "docs/audits/2026-07-13-task-3.3-drift-investigation.json";
const RECOVERY_PLAN_PATH = "docs/audits/2026-07-13-task-3-recovery-plan.json";
const PURCHASE_RECOVERY_PATH = "docs/audits/2026-07-02-purchase-cost-recovery-plan.json";
const BACKDATED_PATH = "docs/audits/2026-07-09-backdated-ledger-pattern.json";
const VERIFICATION_PATH = "docs/audits/2026-07-13-task-3-recovery-verification.json";
const OUTPUT_PATH = "docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.json";
const CUTOFF = "2026-07-02T23:59:59.999Z";
const PRE_JUNE_CUTOFF = "2026-06-01T00:00:00.000Z";
const EXPECTED_BASELINE_COUNT = 170;
const EXPECTED_LOCKED_MISMATCH_COUNT = 130;
const EXPECTED_OUTSIDE_COUNT = 224;
const MATCH_THRESHOLD_VND = 1;
const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;
type Classification =
  | "PURCHASE_COST_RECOVERY_LIKE"
  | "BACKDATED_LEDGER_LIKE"
  | "UNRESOLVED_WRITE_TIME_PROVENANCE"
  | "POST_CUTOFF_NEW_DRIFT"
  | "PRE_BASELINE_WINDOW"
  | "BASELINE_SELECTION_GAP";

type BaselineArtifact = {
  generated_at: string;
  summary: { line_count: number; total_delta: number };
  lines: Array<MacCogsLineMismatch & { classification: string }>;
};

type Task33Artifact = {
  root_cause_classification: Array<{
    cause: string;
    line_count: number;
    baseline_delta_vnd: number;
  }>;
};

type RecoveryPlan = {
  changes: Array<{ line_id: string }>;
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

type BackdatedArtifact = {
  entries: HistoricalBackdatedEntry[];
  impact_lines: Array<{ line_id: string; matched_backdated_ledger_ids: string[] }>;
};

type VerificationArtifact = {
  mismatchLineDeltaVnd: number;
  checks: {
    current_live_drift: {
      total_mismatches: number;
      total_delta_vnd: number;
      locked_mismatches: number;
      outside_locked_cohort: number;
      outside_after_cutoff: number;
      outside_before_or_at_cutoff: number;
    };
  };
};

type ExistingInvestigationArtifact = {
  lines?: Array<{ line_id?: string }>;
};

type OrderRow = Row & {
  id: string;
  order_no?: string;
  status?: string;
  superseded_by?: string;
  created_at?: string;
  migration_notes?: string;
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

type NormalizedLineRow = Row & {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  qty?: string | number;
  cost_at_sale?: string | number;
  recipe_snapshot_json: string;
  modifiers_snapshot_json: string;
};

type LedgerRow = Row & {
  id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  reference_id?: string;
  created_at?: string;
};

type RecipeRow = Row & {
  target_id?: string;
  target_type?: string;
  ingredients_json?: string | unknown[];
};

type NormalizedRecipeRow = Row & {
  target_id?: string;
  target_type?: string;
  ingredients_json: string;
};

type SemiProductRow = Row & {
  id?: string;
  batch_yield?: string | number;
};

type EventRow = Row & {
  id?: string;
  order_id?: string;
  event_type?: string;
  event_at?: string;
  previous_order_id?: string;
};

type PurchaseOrderRow = Row & {
  id?: string;
  created_at?: string;
};

type BaselineLockRow = Row & {
  order_line_id?: string;
};

type HistoricalBackdatedEntry = {
  stock_ledger_id: string;
  transaction_type: string;
  item_reference: string;
  effective_timestamp: string;
  visibility_timestamp: string;
  detection_method: "SOURCE_CREATED_AT" | "OLDER_THAN_ONE_DAY_PROXY";
};

type LiveBackdatedEvent = Row & {
  id?: string;
  stock_ledger_id?: string;
  effective_timestamp?: string;
  visibility_timestamp?: string;
  item_reference?: string;
  source_table?: string;
  source_id?: string;
  status?: string;
};

type ReplayEvidence = {
  consumed_item_ids: string[];
  direct_btp_ids: string[];
  shortfall_btp_ids: string[];
  has_btp_shortfall: boolean;
  pre_purchase_recovery_cost: number;
  pre_purchase_recovery_matches_stored: boolean;
  purchase_recovery_ledger_ids: string[];
  errors: string[];
};

type InvestigationLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  sale_time: string;
  sale_date_utc: string;
  product_id: string;
  variant_id: string;
  qty: number;
  stored_cost: number;
  expected_cost: number;
  delta_vnd: number;
  delta_sign: "NEGATIVE" | "POSITIVE";
  audit_classification: string;
  direct_btp_ids: string[];
  shortfall_btp_ids: string[];
  has_btp_shortfall: boolean;
  consumed_item_ids: string[];
  purchase_recovery_ledger_ids: string[];
  pre_purchase_recovery_cost: number;
  pre_purchase_recovery_matches_stored: boolean;
  historical_precise_backdated_ledger_ids: string[];
  causal_backdated_ledger_ids: string[];
  legacy_migration_visibility_overlap_ledger_ids: string[];
  historical_proxy_backdated_ledger_ids: string[];
  live_backdated_event_ids: string[];
  edited_event_ids: string[];
  edited_after_sale: boolean;
  is_migrated_order: boolean;
  write_visibility_time: string;
  temporal_group: "POST_CUTOFF" | "PRE_BASELINE_WINDOW" | "BASELINE_WINDOW";
  classification: Classification;
  classification_reason: string;
  errors: string[];
};

async function main(): Promise<void> {
  const baseline = readJson<BaselineArtifact>(BASELINE_PATH);
  const task33 = readJson<Task33Artifact>(TASK_3_3_PATH);
  const recoveryPlan = readJson<RecoveryPlan>(RECOVERY_PLAN_PATH);
  const purchaseRecovery = readJson<PurchaseRecoveryArtifact>(PURCHASE_RECOVERY_PATH);
  const backdated = readJson<BackdatedArtifact>(BACKDATED_PATH);
  const verification = readJson<VerificationArtifact>(VERIFICATION_PATH);
  const existingInvestigation = existsSync(OUTPUT_PATH)
    ? readJson<ExistingInvestigationArtifact>(OUTPUT_PATH)
    : null;
  assertSourceArtifacts(baseline, recoveryPlan, purchaseRecovery);

  const client = createReadOnlyQueryClient();
  const [
    orders,
    rawLines,
    ledger,
    rawRecipes,
    semiProducts,
    events,
    purchaseOrders,
    liveBackdatedEvents,
    baselineLocks,
  ] = await Promise.all([
    selectAll<OrderRow>(client, "orders_v2"),
    selectAll<LineRow>(client, "order_lines_v2"),
    selectAll<LedgerRow>(client, "stock_ledger"),
    selectAll<RecipeRow>(client, "recipes"),
    selectAll<SemiProductRow>(client, "semi_products"),
    selectAll<EventRow>(client, "order_events"),
    selectAll<PurchaseOrderRow>(client, "purchase_orders"),
    selectAll<LiveBackdatedEvent>(client, "backdated_ledger_events"),
    selectAll<BaselineLockRow>(client, "audit_baseline_locks", "order_line_id"),
  ]);

  const lines = rawLines.map(normalizeLineJson);
  const recipes = rawRecipes.map(normalizeRecipeJson);
  const drift = auditMacCogsDrift({ orders, lines, ledger, recipes, semiProducts });
  const baselineIds = new Set(baseline.lines.map(line => line.line_id));
  const lockIds = new Set(baselineLocks.map(row => stringValue(row.order_line_id)).filter(Boolean));
  const currentOutsideMismatches = drift.lineMismatches.filter(line => !lockIds.has(line.line_id));
  const capturedIds = new Set(
    (existingInvestigation?.lines || []).map(line => stringValue(line.line_id)).filter(Boolean),
  );
  const useCapturedCohort = currentOutsideMismatches.length !== EXPECTED_OUTSIDE_COUNT
    && capturedIds.size === EXPECTED_OUTSIDE_COUNT;
  const outsideMismatches = useCapturedCohort
    ? currentOutsideMismatches.filter(line => capturedIds.has(line.line_id))
    : currentOutsideMismatches;
  const newOutsideMismatches = useCapturedCohort
    ? currentOutsideMismatches.filter(line => !capturedIds.has(line.line_id))
    : [];
  const capturedIdsNoLongerMismatched = useCapturedCohort
    ? [...capturedIds].filter(id => !currentOutsideMismatches.some(line => line.line_id === id))
    : [];
  if (capturedIdsNoLongerMismatched.length > 0) {
    throw new Error(
      `Captured Task 3.4 IDs no longer mismatched: ${capturedIdsNoLongerMismatched.join(", ")}`,
    );
  }
  const lockedMismatches = drift.lineMismatches.filter(line => lockIds.has(line.line_id));
  const baselineStart = [...baseline.lines]
    .map(line => line.created_at)
    .sort()[0];
  const overlapIds = outsideMismatches
    .filter(line => baselineIds.has(line.line_id))
    .map(line => line.line_id);
  const locksMissingFromSource = [...lockIds].filter(id => !baselineIds.has(id)).sort();
  const sourceMissingFromLocks = [...baselineIds].filter(id => !lockIds.has(id)).sort();

  assertLivePopulation({
    baseline,
    baselineLocks,
    outsideMismatches,
    lockedMismatches,
    overlapIds,
    locksMissingFromSource,
    sourceMissingFromLocks,
  });

  const orderById = new Map(orders.map(order => [order.id, order]));
  const lineById = new Map(lines.map(line => [line.id, line]));
  const sortedLedger = [...ledger].sort(compareCreatedAt);
  const oldUnitCostByLedgerId = new Map(
    purchaseRecovery.changes.map(change => [change.ledger_id, change.old_unit_cost]),
  );
  const prePurchaseRecoveryLedger = sortedLedger.map(row => (
    oldUnitCostByLedgerId.has(stringValue(row.id))
      ? { ...row, unit_cost: oldUnitCostByLedgerId.get(stringValue(row.id)) }
      : row
  ));
  const purchaseItemByLedgerId = new Map(
    purchaseRecovery.changes.map(change => [change.ledger_id, change.item_reference]),
  );
  const purchaseWindow = getRecoveryWindow(baseline, recoveryPlan);
  const maps = buildSemiProductRecipeMaps(recipes, semiProducts);
  const eventsByOrderId = groupBy(events, event => stringValue(event.order_id));

  const investigationLines = outsideMismatches.map(mismatch => {
    const line = lineById.get(mismatch.line_id);
    const order = orderById.get(mismatch.order_id);
    if (!line || !order) throw new Error(`Missing live row for ${mismatch.line_id}`);
    const replay = buildReplayEvidence({
      mismatch,
      line,
      order,
      ledger: sortedLedger,
      prePurchaseRecoveryLedger,
      purchaseRecovery,
      maps,
    });
    return classifyLine({
      mismatch,
      replay,
      baselineStart,
      purchaseWindow,
      purchaseItemByLedgerId,
      historicalEntries: backdated.entries,
      liveBackdatedEvents,
      order,
      orderEvents: eventsByOrderId.get(mismatch.order_id) || [],
    });
  }).sort((left, right) => (
    timestampMs(left.sale_time) - timestampMs(right.sale_time)
    || left.line_id.localeCompare(right.line_id)
  ));

  const classificationSummary = summarize(investigationLines, line => line.classification);
  if (sum(classificationSummary.map(row => row.line_count)) !== EXPECTED_OUTSIDE_COUNT) {
    throw new Error("Classification buckets do not reconcile to 224 lines");
  }

  const codeHistory = getRelevantCodeHistory();
  const postCutoff = investigationLines.filter(line => line.temporal_group === "POST_CUTOFF");
  const preBaseline = investigationLines.filter(line => line.temporal_group === "PRE_BASELINE_WINDOW");
  const baselineWindow = investigationLines.filter(line => line.temporal_group === "BASELINE_WINDOW");
  const purchaseLike = investigationLines.filter(line => line.classification === "PURCHASE_COST_RECOVERY_LIKE");
  const backdatedLike = investigationLines.filter(line => line.classification === "BACKDATED_LEDGER_LIKE");
  const preciseBackdatedFingerprints = investigationLines.filter(line => (
    line.historical_precise_backdated_ledger_ids.length > 0
  ));
  const legacyMigrationBackdatedCorrelations = preciseBackdatedFingerprints.filter(line => (
    line.legacy_migration_visibility_overlap_ledger_ids.length > 0
    && line.causal_backdated_ledger_ids.length === 0
  ));
  const edited = investigationLines.filter(line => line.edited_after_sale);
  const shortfall = investigationLines.filter(line => line.has_btp_shortfall);
  const livePostCutoffBackdating = postCutoff.filter(line => line.live_backdated_event_ids.length > 0);
  const activePostCutoffShortfall = postCutoff.filter(line => line.has_btp_shortfall);
  const materialPurchaseLike = purchaseLike.filter(line => Math.abs(line.delta_vnd) > 10_000);
  const signSummary = summarize(investigationLines, line => line.delta_sign);
  const productSummary = summarize(investigationLines, line => line.product_id)
    .sort((left, right) => right.abs_delta_vnd - left.abs_delta_vnd);
  const btpSummary = summarizeExploded(investigationLines, line => line.shortfall_btp_ids);
  const dateSummary = summarize(investigationLines, line => line.sale_date_utc);
  const preJune = preBaseline.filter(line => timestampMs(line.sale_time) < timestampMs(PRE_JUNE_CUTOFF));
  const baselineShortfallCount = baseline.lines.filter(line => line.has_btp_shortfall).length;

  const stopTriggers = {
    material_purchase_cost_recovery_like_line_ids: materialPurchaseLike.map(line => line.line_id),
    active_forward_backdating_line_ids: livePostCutoffBackdating.map(line => line.line_id),
    active_forward_btp_shortfall_line_ids: activePostCutoffShortfall.map(line => line.line_id),
    active_forward_drift_detected: activePostCutoffShortfall.length > 0,
    cohort_misclassification_detected:
      overlapIds.length > 0 || locksMissingFromSource.length > 0 || sourceMissingFromLocks.length > 0,
  };

  const report = {
    generated_at: new Date().toISOString(),
    contract: {
      production_data_access: "READ_ONLY_SELECTS_VIA_SERVICE_ROLE",
      rationale:
        "backdated_ledger_events revokes anon/authenticated access; the script uses a service credential but exposes only a local SELECT helper and calls no mutation or RPC methods.",
      database_mutation_methods_used: [],
      local_artifact_written: OUTPUT_PATH,
      source_artifacts: [
        BASELINE_PATH,
        TASK_3_3_PATH,
        RECOVERY_PLAN_PATH,
        PURCHASE_RECOVERY_PATH,
        BACKDATED_PATH,
        VERIFICATION_PATH,
      ],
      cutoff: CUTOFF,
      baseline_window_start_observed: baselineStart,
      cohort_source: useCapturedCohort
        ? "FROZEN_224_LINE_EXISTING_ARTIFACT"
        : "LIVE_OUTSIDE_LOCK_SET",
    },
    population: {
      live_mismatch_count: drift.mismatchedLineCount,
      live_total_delta_vnd: drift.totalDelta,
      live_mismatch_line_delta_vnd: sum(drift.lineMismatches.map(line => line.delta)),
      baseline_source_line_count: baseline.lines.length,
      database_lock_count: baselineLocks.length,
      locked_mismatch_count: lockedMismatches.length,
      locked_mismatch_delta_vnd: sum(lockedMismatches.map(line => line.delta)),
      frozen_locked_delta_vnd: verification.mismatchLineDeltaVnd,
      locked_replay_shift_vnd:
        sum(lockedMismatches.map(line => line.delta)) - verification.mismatchLineDeltaVnd,
      outside_cohort_count: investigationLines.length,
      current_live_outside_discovered_count: currentOutsideMismatches.length,
      new_outside_lines_after_capture_count: newOutsideMismatches.length,
      new_outside_lines_after_capture_ids: newOutsideMismatches.map(line => line.line_id).sort(),
      outside_cohort_delta_vnd: sum(investigationLines.map(line => line.delta_vnd)),
      outside_after_cutoff_count: postCutoff.length,
      outside_before_or_at_cutoff_count: investigationLines.length - postCutoff.length,
      outside_earliest_sale_time: investigationLines[0]?.sale_time || "",
      outside_latest_sale_time: investigationLines.at(-1)?.sale_time || "",
      frozen_verification_reference: verification.checks.current_live_drift,
    },
    source_cross_references: {
      outside_ids_overlapping_baseline: overlapIds,
      locks_missing_from_baseline_source: locksMissingFromSource,
      baseline_source_ids_missing_from_locks: sourceMissingFromLocks,
      reviewed_recovery_plan_overlap_count: investigationLines.filter(line => (
        recoveryPlan.changes.some(change => change.line_id === line.line_id)
      )).length,
      task_3_2_reviewed_impact_overlap_count: investigationLines.filter(line => (
        backdated.impact_lines.some(impact => impact.line_id === line.line_id)
      )).length,
      task_3_3_root_cause_summary: task33.root_cause_classification,
      backdated_fingerprint_clarification: {
        precise_sale_window_fingerprint_line_count: preciseBackdatedFingerprints.length,
        causal_hidden_at_write_time_line_count: backdatedLike.length,
        legacy_migration_correlation_line_count: legacyMigrationBackdatedCorrelations.length,
        migration_marked_fingerprint_line_count: preciseBackdatedFingerprints.filter(line => (
          line.is_migrated_order
        )).length,
        non_migration_fingerprint_line_count: preciseBackdatedFingerprints.filter(line => (
          !line.is_migrated_order
        )).length,
        rationale:
          "A sale-time effective/visibility overlap is only causal when the PO was still invisible when the order line was actually written. Migrated legacy lines written after PO visibility are correlations, not recoverable backdating proof.",
      },
    },
    hypotheses: {
      H1_post_cutoff_live_backdating: {
        verdict: livePostCutoffBackdating.length > 0 ? "CONFIRMED_ACTIVE_MECHANISM" : "NOT_SUPPORTED",
        test:
          "Match consumed items to durable backdated_ledger_events where effective_timestamp <= sale_time <= visibility_timestamp.",
        post_cutoff_line_count: postCutoff.length,
        durable_event_matched_line_count: livePostCutoffBackdating.length,
        precise_historical_match_line_count: postCutoff.filter(line => (
          line.historical_precise_backdated_ledger_ids.length > 0
        )).length,
        line_ids: livePostCutoffBackdating.map(line => line.line_id),
      },
      H2_post_cutoff_engine_drift: {
        verdict: "REJECTED",
        test: "Inspect commits since 2026-07-02 in the four specified write/replay paths.",
        rationale:
          "The only matching commit changes product/variant display-name lookup in an admin read path; it does not change MAC, consumption, or cost_at_sale writes.",
        relevant_commits: codeHistory,
      },
      H3_pre_cutoff_baseline_scope_gap: {
        verdict: "CONFIRMED_AS_FROZEN_SNAPSHOT_GAP_NOT_SELECTION_FILTER",
        test:
          "Compare IDs and selection predicates. The same live audit has no sale-date filter; the frozen artifact is a point-in-time mismatch list.",
        pre_cutoff_outside_count: investigationLines.length - postCutoff.length,
        id_overlap_count: overlapIds.length,
        baseline_window_gap_count: baselineWindow.length,
        predicate_divergence_found: false,
      },
      H4_pre_baseline_window: {
        verdict: preJune.length > 20 ? "MATERIAL_EXTENDED_HISTORY" : "LIMITED",
        test: "Count UTC sale dates before the first date represented in the frozen baseline and before 2026-06-01.",
        baseline_start_observed: baselineStart,
        pre_baseline_line_count: preBaseline.length,
        pre_baseline_delta_vnd: sum(preBaseline.map(line => line.delta_vnd)),
        pre_june_line_count: preJune.length,
        pre_june_delta_vnd: sum(preJune.map(line => line.delta_vnd)),
      },
      H5_sign_asymmetry: {
        verdict: concentrationVerdict(productSummary, investigationLines),
        test: "Split expected-minus-stored delta by sign, product, shortfall BTP, and UTC sale date.",
        sign_semantics:
          "delta_vnd = expected_cost - stored_cost; negative means stored COGS is higher than current replay, not under-stored.",
        by_sign: signSummary,
        top_products: productSummary.slice(0, 15),
        top_shortfall_btps: btpSummary.slice(0, 15),
        by_utc_sale_date: dateSummary,
      },
      H6_btp_shortfall_recurrence: {
        verdict: shortfall.length > investigationLines.length / 2 ? "CONFIRMED_DOMINANT" : "PARTIAL",
        test: "Replay each line at sale time and inspect BTP_SHORTFALL consumption sources.",
        outside_shortfall_line_count: shortfall.length,
        outside_shortfall_rate: ratio(shortfall.length, investigationLines.length),
        outside_shortfall_delta_vnd: sum(shortfall.map(line => line.delta_vnd)),
        fixed_baseline_shortfall_line_count: baselineShortfallCount,
        fixed_baseline_shortfall_rate: ratio(baselineShortfallCount, baseline.lines.length),
      },
      H7_edit_order_side_effects: {
        verdict: edited.length > 0 ? "PARTIAL_CORRELATION_NOT_CAUSAL_PROOF" : "NOT_SUPPORTED",
        test: "Match EDITED events on the current order version with event_at later than the preserved sale timestamp.",
        edited_after_sale_line_count: edited.length,
        edited_after_sale_delta_vnd: sum(edited.map(line => line.delta_vnd)),
        rationale:
          "Current editOrderV2 explicitly recomputes and pins cost_at_sale at original sale time, so an EDITED event alone does not prove an unpinned write.",
        line_ids: edited.map(line => line.line_id),
      },
    },
    classification_summary: classificationSummary,
    recommendations: {
      purchase_cost_recovery_like_review_candidates: purchaseLike.map(line => line.line_id),
      backdated_ledger_review_path_candidates: backdatedLike.map(line => line.line_id),
      forward_detection_line_ids: postCutoff.map(line => line.line_id),
      baseline_scope_gap_line_ids: baselineWindow.map(line => line.line_id),
      pre_baseline_window_line_ids: preBaseline.map(line => line.line_id),
      accepted_audit_drift_line_ids: investigationLines
        .filter(line => line.classification === "UNRESOLVED_WRITE_TIME_PROVENANCE")
        .map(line => line.line_id),
      automatic_recompute_recommended: false,
    },
    stop_triggers: stopTriggers,
    lines: investigationLines,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
}

function buildReplayEvidence(input: {
  mismatch: MacCogsLineMismatch;
  line: LineRow;
  order: OrderRow;
  ledger: LedgerRow[];
  prePurchaseRecoveryLedger: LedgerRow[];
  purchaseRecovery: PurchaseRecoveryArtifact;
  maps: ReturnType<typeof buildSemiProductRecipeMaps>;
}): ReplayEvidence {
  const errors: string[] = [];
  const saleTime = stringValue(input.order.created_at) || input.mismatch.created_at;
  const saleMs = timestampMs(saleTime);
  const ledgerBeforeOrder = input.ledger.filter(row => (
    timestampMs(stringValue(row.created_at)) <= saleMs
    && stringValue(row.reference_id) !== input.order.id
  ));
  const preRecoveryLedgerBeforeOrder = input.prePurchaseRecoveryLedger.filter(row => (
    timestampMs(stringValue(row.created_at)) <= saleMs
    && stringValue(row.reference_id) !== input.order.id
  ));
  const parsed = parseLineRecipeSnapshot(jsonString(input.line.recipe_snapshot_json, "{}"));
  applyModifierQuantities(parsed, input.line);
  const currentRows = runConsumption(parsed, input.line, saleTime, ledgerBeforeOrder, input.maps, errors);
  const preRecoveryRows = runConsumption(
    parsed,
    input.line,
    saleTime,
    preRecoveryLedgerBeforeOrder,
    input.maps,
    errors,
  );
  const prePurchaseRecoveryCost = computeMacCostForConsumptionRows(
    preRecoveryRows,
    preRecoveryLedgerBeforeOrder,
    saleTime,
    input.maps,
  );
  const consumedItemIds = unique(currentRows.map(row => row.item_reference));
  const purchaseLedgerIds = input.purchaseRecovery.changes
    .filter(change => consumedItemIds.includes(change.item_reference))
    .map(change => change.ledger_id)
    .sort();
  return {
    consumed_item_ids: consumedItemIds,
    direct_btp_ids: extractDirectBtpIds(parsed),
    shortfall_btp_ids: unique(currentRows.flatMap(row => extractShortfallBtpIds(row.source))),
    has_btp_shortfall: currentRows.some(row => row.source.includes("BTP_SHORTFALL")),
    pre_purchase_recovery_cost: prePurchaseRecoveryCost,
    pre_purchase_recovery_matches_stored:
      Math.abs(prePurchaseRecoveryCost - input.mismatch.stored_cost) <= MATCH_THRESHOLD_VND,
    purchase_recovery_ledger_ids: purchaseLedgerIds,
    errors,
  };
}

function classifyLine(input: {
  mismatch: MacCogsLineMismatch;
  replay: ReplayEvidence;
  baselineStart: string;
  purchaseWindow: { start: string; end: string };
  purchaseItemByLedgerId: Map<string, string>;
  historicalEntries: HistoricalBackdatedEntry[];
  liveBackdatedEvents: LiveBackdatedEvent[];
  order: OrderRow;
  orderEvents: EventRow[];
}): InvestigationLine {
  const saleMs = timestampMs(input.mismatch.created_at);
  const historicalPrecise = matchVisibilityEvents(
    input.historicalEntries.filter(entry => entry.detection_method === "SOURCE_CREATED_AT"),
    input.mismatch.created_at,
    input.replay.consumed_item_ids,
    entry => entry.stock_ledger_id,
  );
  const historicalProxy = matchVisibilityEvents(
    input.historicalEntries.filter(entry => entry.detection_method === "OLDER_THAN_ONE_DAY_PROXY"),
    input.mismatch.created_at,
    input.replay.consumed_item_ids,
    entry => entry.stock_ledger_id,
  );
  const liveEvents = matchVisibilityEvents(
    input.liveBackdatedEvents,
    input.mismatch.created_at,
    input.replay.consumed_item_ids,
    entry => stringValue(entry.id),
  );
  const editEvents = input.orderEvents.filter(event => (
    stringValue(event.event_type) === "EDITED"
    && timestampMs(stringValue(event.event_at)) > saleMs
  ));
  const isMigratedOrder = input.mismatch.line_id.startsWith("ol-migrated-")
    || Boolean(stringValue(input.order.migration_notes))
    || input.orderEvents.some(event => ["MIGRATED", "IMPORTED"].includes(
      stringValue(event.event_type),
    ));
  const writeVisibilityTime = findWriteVisibilityTime(
    input.mismatch.created_at,
    input.orderEvents,
  );
  const preciseEntryById = new Map(input.historicalEntries.map(entry => [
    entry.stock_ledger_id,
    entry,
  ]));
  const causalBackdatedLedgerIds = historicalPrecise.filter(id => (
    timestampMs(preciseEntryById.get(id)?.visibility_timestamp || "")
      > timestampMs(writeVisibilityTime)
  ));
  const legacyMigrationVisibilityOverlapLedgerIds = historicalPrecise.filter(id => (
    timestampMs(preciseEntryById.get(id)?.visibility_timestamp || "")
      <= timestampMs(writeVisibilityTime)
  ));
  const causalLiveEventIds = liveEvents.filter(id => {
    const event = input.liveBackdatedEvents.find(row => stringValue(row.id) === id);
    return timestampMs(stringValue(event?.visibility_timestamp)) > timestampMs(writeVisibilityTime);
  });
  const isInPurchaseWindow = saleMs >= timestampMs(input.purchaseWindow.start)
    && saleMs <= timestampMs(input.purchaseWindow.end);
  const hasExactPurchaseItems = input.replay.purchase_recovery_ledger_ids.some(id => (
    input.replay.consumed_item_ids.includes(input.purchaseItemByLedgerId.get(id) || "")
  ));
  const purchaseLike = isInPurchaseWindow
    && hasExactPurchaseItems
    && input.replay.pre_purchase_recovery_matches_stored
    && Math.abs(input.mismatch.delta) > MATCH_THRESHOLD_VND;
  const temporalGroup = saleMs > timestampMs(CUTOFF)
    ? "POST_CUTOFF"
    : saleMs < timestampMs(input.baselineStart)
      ? "PRE_BASELINE_WINDOW"
      : "BASELINE_WINDOW";

  let classification: Classification;
  let classificationReason: string;
  if (purchaseLike) {
    classification = "PURCHASE_COST_RECOVERY_LIKE";
    classificationReason = "Exact three-ledger recovery fingerprint and date window; pre-recovery replay matches stored COGS.";
  } else if (causalLiveEventIds.length > 0 || causalBackdatedLedgerIds.length > 0) {
    classification = "BACKDATED_LEDGER_LIKE";
    classificationReason = "Consumed item intersects a precise backdated window whose ledger input was still invisible when the order line was written.";
  } else if (temporalGroup === "POST_CUTOFF") {
    classification = "POST_CUTOFF_NEW_DRIFT";
    classificationReason = "Sale is after the frozen cutoff and has no exact existing recovery fingerprint.";
  } else if (temporalGroup === "PRE_BASELINE_WINDOW") {
    classification = "PRE_BASELINE_WINDOW";
    classificationReason = "Sale predates the earliest mismatch represented in the frozen baseline.";
  } else if (temporalGroup === "BASELINE_WINDOW") {
    classification = "BASELINE_SELECTION_GAP";
    classificationReason = "Sale falls inside the frozen baseline date span but the line was not in the frozen ID list.";
  } else {
    classification = "UNRESOLVED_WRITE_TIME_PROVENANCE";
    classificationReason = "No reconstructable causal or temporal scope fingerprint.";
  }

  return {
    line_id: input.mismatch.line_id,
    order_id: input.mismatch.order_id,
    order_no: input.mismatch.order_no,
    sale_time: input.mismatch.created_at,
    sale_date_utc: dateKey(input.mismatch.created_at),
    product_id: input.mismatch.product_id,
    variant_id: input.mismatch.variant_id,
    qty: input.mismatch.qty,
    stored_cost: input.mismatch.stored_cost,
    expected_cost: input.mismatch.expected_cost,
    delta_vnd: input.mismatch.delta,
    delta_sign: input.mismatch.delta < 0 ? "NEGATIVE" : "POSITIVE",
    audit_classification: input.mismatch.classification,
    direct_btp_ids: input.replay.direct_btp_ids,
    shortfall_btp_ids: input.replay.shortfall_btp_ids,
    has_btp_shortfall: input.replay.has_btp_shortfall,
    consumed_item_ids: input.replay.consumed_item_ids,
    purchase_recovery_ledger_ids: input.replay.purchase_recovery_ledger_ids,
    pre_purchase_recovery_cost: input.replay.pre_purchase_recovery_cost,
    pre_purchase_recovery_matches_stored: input.replay.pre_purchase_recovery_matches_stored,
    historical_precise_backdated_ledger_ids: historicalPrecise,
    causal_backdated_ledger_ids: causalBackdatedLedgerIds,
    legacy_migration_visibility_overlap_ledger_ids: legacyMigrationVisibilityOverlapLedgerIds,
    historical_proxy_backdated_ledger_ids: historicalProxy,
    live_backdated_event_ids: liveEvents,
    edited_event_ids: editEvents.map(event => stringValue(event.id)).filter(Boolean).sort(),
    edited_after_sale: editEvents.length > 0,
    is_migrated_order: isMigratedOrder,
    write_visibility_time: writeVisibilityTime,
    temporal_group: temporalGroup,
    classification,
    classification_reason: classificationReason,
    errors: input.replay.errors,
  };
}

function runConsumption(
  recipe: ReturnType<typeof parseLineRecipeSnapshot>,
  line: LineRow,
  saleTime: string,
  ledgerBeforeOrder: LedgerRow[],
  maps: ReturnType<typeof buildSemiProductRecipeMaps>,
  errors: string[],
): ConsumptionRow[] {
  try {
    const balances = buildInventoryBalances(ledgerBeforeOrder, saleTime);
    return buildLineConsumptionRows(recipe, numberValue(line.qty), balances, maps);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return [];
  }
}

function matchVisibilityEvents<T extends {
  effective_timestamp?: string;
  visibility_timestamp?: string;
  item_reference?: string;
}>(
  entries: T[],
  saleTime: string,
  consumedItemIds: string[],
  idOf: (entry: T) => string,
): string[] {
  const saleMs = timestampMs(saleTime);
  return unique(entries.filter(entry => (
    timestampMs(stringValue(entry.effective_timestamp)) <= saleMs
    && saleMs <= timestampMs(stringValue(entry.visibility_timestamp))
    && consumedItemIds.includes(stringValue(entry.item_reference))
  )).map(idOf));
}

function findWriteVisibilityTime(saleTime: string, events: EventRow[]): string {
  const writeEvents = events.filter(event => [
    "CREATED",
    "EDITED",
    "MIGRATED",
    "IMPORTED",
  ].includes(stringValue(event.event_type)) && Number.isFinite(
    timestampMs(stringValue(event.event_at)),
  ));
  if (writeEvents.length === 0) return saleTime;
  return writeEvents
    .map(event => stringValue(event.event_at))
    .sort((left, right) => timestampMs(right) - timestampMs(left))[0];
}

function getRecoveryWindow(
  baseline: BaselineArtifact,
  recoveryPlan: RecoveryPlan,
): { start: string; end: string } {
  const recoveryIds = new Set(recoveryPlan.changes.map(change => change.line_id));
  const times = baseline.lines
    .filter(line => recoveryIds.has(line.line_id))
    .map(line => line.created_at)
    .sort();
  if (times.length !== recoveryPlan.changes.length) {
    throw new Error("Recovery plan line IDs do not fully resolve in the fixed baseline");
  }
  return { start: times[0], end: times[times.length - 1] };
}

function assertSourceArtifacts(
  baseline: BaselineArtifact,
  recoveryPlan: RecoveryPlan,
  purchaseRecovery: PurchaseRecoveryArtifact,
): void {
  if (baseline.lines.length !== EXPECTED_BASELINE_COUNT || baseline.summary.line_count !== EXPECTED_BASELINE_COUNT) {
    throw new Error(`Expected 170-line baseline, got ${baseline.lines.length}`);
  }
  if (recoveryPlan.changes.length !== 40) {
    throw new Error(`Expected 40-line recovery plan, got ${recoveryPlan.changes.length}`);
  }
  const ledgerIds = purchaseRecovery.changes.map(change => change.ledger_id).sort().join(",");
  if (ledgerIds !== "STK-014,STK-018,STK-019") {
    throw new Error(`Unexpected purchase recovery ledger IDs: ${ledgerIds}`);
  }
}

function assertLivePopulation(input: {
  baseline: BaselineArtifact;
  baselineLocks: BaselineLockRow[];
  outsideMismatches: MacCogsLineMismatch[];
  lockedMismatches: MacCogsLineMismatch[];
  overlapIds: string[];
  locksMissingFromSource: string[];
  sourceMissingFromLocks: string[];
}): void {
  const errors: string[] = [];
  if (input.baselineLocks.length !== EXPECTED_BASELINE_COUNT) {
    errors.push(`database locks=${input.baselineLocks.length}, expected=170`);
  }
  if (input.lockedMismatches.length !== EXPECTED_LOCKED_MISMATCH_COUNT) {
    errors.push(`locked mismatches=${input.lockedMismatches.length}, expected=130`);
  }
  if (input.outsideMismatches.length !== EXPECTED_OUTSIDE_COUNT) {
    errors.push(`outside mismatches=${input.outsideMismatches.length}, expected=224`);
  }
  if (input.overlapIds.length > 0) errors.push(`outside/source overlap=${input.overlapIds.length}`);
  if (input.locksMissingFromSource.length > 0) errors.push(`locks absent from source=${input.locksMissingFromSource.length}`);
  if (input.sourceMissingFromLocks.length > 0) errors.push(`source absent from locks=${input.sourceMissingFromLocks.length}`);
  if (errors.length > 0) throw new Error(`Live population gate failed: ${errors.join("; ")}`);
}

function createReadOnlyQueryClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service configuration");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function selectAll<T extends Row>(
  client: SupabaseClient,
  table: string,
  orderColumn = "id",
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`SELECT ${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function normalizeLineJson(line: LineRow): NormalizedLineRow {
  return {
    ...line,
    recipe_snapshot_json: jsonString(line.recipe_snapshot_json, "{}"),
    modifiers_snapshot_json: jsonString(line.modifiers_snapshot_json, "[]"),
  };
}

function normalizeRecipeJson(recipe: RecipeRow): NormalizedRecipeRow {
  return { ...recipe, ingredients_json: jsonString(recipe.ingredients_json, "[]") };
}

function applyModifierQuantities(
  snapshot: ReturnType<typeof parseLineRecipeSnapshot>,
  line: LineRow,
): void {
  let quantities = new Map<string, number>();
  try {
    const parsed = JSON.parse(jsonString(line.modifiers_snapshot_json, "[]"));
    if (Array.isArray(parsed)) {
      quantities = new Map(parsed.map(modifier => {
        const row = modifier as Row;
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

function getRelevantCodeHistory(): string[] {
  const output = execFileSync("git", [
    "log",
    "--since=2026-07-02",
    "--date=iso-strict",
    "--pretty=format:%h|%ad|%s",
    "--",
    "lib/mac-cogs.ts",
    "lib/inventory-consumption.ts",
    "app/pos/actions.ts",
    "app/admin/orders/actions.ts",
  ], { encoding: "utf8" });
  return output.split(/\r?\n/).filter(Boolean);
}

function summarize<T>(
  lines: InvestigationLine[],
  getKey: (line: InvestigationLine) => T,
): Array<{ key: T; line_count: number; delta_vnd: number; abs_delta_vnd: number }> {
  const groups = new Map<T, { line_count: number; delta_vnd: number; abs_delta_vnd: number }>();
  for (const line of lines) {
    const key = getKey(line);
    const group = groups.get(key) || { line_count: 0, delta_vnd: 0, abs_delta_vnd: 0 };
    group.line_count += 1;
    group.delta_vnd += line.delta_vnd;
    group.abs_delta_vnd += Math.abs(line.delta_vnd);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

function summarizeExploded(
  lines: InvestigationLine[],
  getKeys: (line: InvestigationLine) => string[],
): Array<{ key: string; line_count: number; delta_vnd: number; abs_delta_vnd: number }> {
  const groups = new Map<string, { lineIds: Set<string>; delta_vnd: number; abs_delta_vnd: number }>();
  for (const line of lines) {
    for (const key of unique(getKeys(line))) {
      const group = groups.get(key) || { lineIds: new Set<string>(), delta_vnd: 0, abs_delta_vnd: 0 };
      if (!group.lineIds.has(line.line_id)) {
        group.lineIds.add(line.line_id);
        group.delta_vnd += line.delta_vnd;
        group.abs_delta_vnd += Math.abs(line.delta_vnd);
      }
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      line_count: group.lineIds.size,
      delta_vnd: group.delta_vnd,
      abs_delta_vnd: group.abs_delta_vnd,
    }))
    .sort((left, right) => right.abs_delta_vnd - left.abs_delta_vnd);
}

function concentrationVerdict(
  products: Array<{ abs_delta_vnd: number }>,
  lines: InvestigationLine[],
): string {
  const totalAbs = sum(lines.map(line => Math.abs(line.delta_vnd)));
  const topShare = totalAbs > 0 ? (products[0]?.abs_delta_vnd || 0) / totalAbs : 0;
  return topShare >= 0.5 ? "CONFIRMED_SINGLE_PRODUCT_CONCENTRATION" : "DISTRIBUTED";
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

function printSummary(report: any): void {
  console.log("=== TASK 3.4 OUTSIDE-COHORT INVESTIGATION (READ ONLY) ===");
  console.log(`Live mismatches:          ${report.population.live_mismatch_count}`);
  console.log(`Locked mismatches:        ${report.population.locked_mismatch_count}`);
  console.log(`Outside cohort:           ${report.population.outside_cohort_count}`);
  console.log(`Current outside discovered: ${report.population.current_live_outside_discovered_count}`);
  console.log(`New after cohort capture: ${report.population.new_outside_lines_after_capture_count}`);
  console.log(`Outside delta:            ${formatVnd(report.population.outside_cohort_delta_vnd)}`);
  console.log(`After cutoff:             ${report.population.outside_after_cutoff_count}`);
  console.log("Classification:");
  console.table(report.classification_summary);
  console.log(`H1 live backdating:       ${report.hypotheses.H1_post_cutoff_live_backdating.durable_event_matched_line_count}`);
  console.log(`H6 BTP shortfall:         ${report.hypotheses.H6_btp_shortfall_recurrence.outside_shortfall_line_count}`);
  console.log(`H7 edited after sale:     ${report.hypotheses.H7_edit_order_side_effects.edited_after_sale_line_count}`);
  console.log(`JSON artifact:            ${OUTPUT_PATH}`);
  console.log(`Stop triggers:            ${JSON.stringify(report.stop_triggers)}`);
  console.log("No database rows were written.");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function jsonString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value || fallback;
  if (value === null || value === undefined) return fallback;
  return JSON.stringify(value);
}

function compareCreatedAt(left: LedgerRow, right: LedgerRow): number {
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

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

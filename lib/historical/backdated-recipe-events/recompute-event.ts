import { createHash } from "node:crypto";
import { getSupabaseClient } from "../../supabase";
import { computeSaleTimeCogs } from "../backdated-ledger/compute-sale-time-cogs";
import { buildRepairedSnapshot } from "../recipe-snapshot-repair";
import type {
  BackdatedLedgerOrder,
  BackdatedLedgerOrderLine,
  BackdatedLedgerRecipe,
  BackdatedLedgerSemiProduct,
  BackdatedLedgerStockRow,
} from "../backdated-ledger/find-affected-lines";
import {
  findAffectedRecipeLines,
  type AffectedRecipeOrderLine,
  type BackdatedRecipeEvent,
} from "./find-affected-lines";

export type BackdatedRecipeEventRecoveryChange = {
  line_id: string;
  order_id: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
};

export type BackdatedRecipeEventSnapshotRepair = {
  line_id: string;
  order_id: string;
  old_recipe_snapshot_json: string;
  new_recipe_snapshot_json: string;
};

export type BackdatedRecipeEventRecoveryPlan = {
  event_id: string;
  run_id: string;
  source_hash: string;
  affected_lines: AffectedRecipeOrderLine[];
  changes: BackdatedRecipeEventRecoveryChange[];
  snapshot_repairs: BackdatedRecipeEventSnapshotRepair[];
};

export type BackdatedRecipeEventRecoveryApplyResult = BackdatedRecipeEventRecoveryPlan & {
  apply_result: unknown;
  mark_result: unknown;
};

type RecoveryData = {
  event: BackdatedRecipeEvent;
  orders: BackdatedLedgerOrder[];
  lines: BackdatedLedgerOrderLine[];
  ledger: BackdatedLedgerStockRow[];
  recipes: BackdatedLedgerRecipe[];
  semiProducts: BackdatedLedgerSemiProduct[];
};

export async function recomputeRecipeEventDryRun(eventId: string): Promise<BackdatedRecipeEventRecoveryPlan> {
  const data = await loadRecoveryData(eventId);
  return buildRecoveryPlan(data);
}

export async function recomputeRecipeEventApply(
  eventId: string,
  reviewer: string,
): Promise<BackdatedRecipeEventRecoveryApplyResult> {
  if (!reviewer.trim()) {
    throw new Error("reviewer is required for apply");
  }

  const plan = await recomputeRecipeEventDryRun(eventId);

  // Write the corrected snapshot before the cost recompute -- cost is
  // derived from the snapshot, so recording a new cost against a still-stale
  // snapshot would just recreate Hole 3.
  if (plan.snapshot_repairs.length > 0) {
    const { update } = await import("../../sheets_db");
    for (const repair of plan.snapshot_repairs) {
      await update("Order_Lines_V2", repair.line_id, {
        recipe_snapshot_json: repair.new_recipe_snapshot_json,
      });
    }
  }

  const supabase = getSupabaseClient();
  const { data: applyResult, error: applyError } = await supabase.rpc("apply_backdated_recipe_event_recovery", {
    p_event_id: eventId,
    p_reviewer: reviewer,
    p_changes: plan.changes,
  });
  if (applyError) throw new Error(applyError.message);

  const { data: markResult, error: markError } = await supabase.rpc("mark_backdated_recipe_event_recomputed", {
    p_event_id: eventId,
    p_reviewer: reviewer,
    p_run_id: plan.run_id,
    p_change_count: plan.changes.length,
  });
  if (markError) throw new Error(markError.message);

  return {
    ...plan,
    apply_result: applyResult,
    mark_result: markResult,
  };
}

function buildRecoveryPlan(data: RecoveryData): BackdatedRecipeEventRecoveryPlan {
  const affectedLines = findAffectedRecipeLines({
    event: data.event,
    orders: data.orders,
    lines: data.lines,
  });
  const orderById = new Map(data.orders.map(order => [order.id, order]));
  const lineById = new Map(data.lines.map(line => [line.id, line]));

  const snapshotRepairs: BackdatedRecipeEventSnapshotRepair[] = [];
  const repairedLineById = new Map<string, BackdatedLedgerOrderLine>();

  for (const affectedLine of affectedLines) {
    const order = orderById.get(affectedLine.order_id);
    const line = lineById.get(affectedLine.line_id);
    if (!order || !line) {
      throw new Error(`Affected line ${affectedLine.line_id} is missing source row`);
    }
    const originalSnapshotJson = line.recipe_snapshot_json || "{}";
    // Re-resolve the whole snapshot (variant + every modifier) against what
    // is effective at this line's own sale time -- same resolver Task 3's
    // one-time repair used, reused here rather than re-implemented.
    const repairedSnapshotJson = buildRepairedSnapshot({
      recipeSnapshotJson: originalSnapshotJson,
      variantId: line.variant_id || "",
      saleTime: order.created_at || "",
      recipes: data.recipes,
    });
    if (repairedSnapshotJson !== originalSnapshotJson) {
      snapshotRepairs.push({
        line_id: line.id,
        order_id: line.order_id,
        old_recipe_snapshot_json: originalSnapshotJson,
        new_recipe_snapshot_json: repairedSnapshotJson,
      });
    }
    repairedLineById.set(line.id, { ...line, recipe_snapshot_json: repairedSnapshotJson });
  }

  const changes = affectedLines
    .map(affectedLine => {
      const order = orderById.get(affectedLine.order_id);
      const line = repairedLineById.get(affectedLine.line_id);
      if (!order || !line) {
        throw new Error(`Affected line ${affectedLine.line_id} is missing source row`);
      }
      return computeSaleTimeCogs({
        order,
        line,
        ledger: data.ledger,
        recipes: data.recipes,
        semiProducts: data.semiProducts,
      });
    })
    .filter(change => change.old_cost_at_sale !== change.new_cost_at_sale)
    .sort((a, b) => a.line_id.localeCompare(b.line_id));

  return {
    event_id: data.event.id,
    run_id: `backdated-recipe-${data.event.id}`,
    source_hash: sha256(JSON.stringify(changes)),
    affected_lines: affectedLines,
    changes,
    snapshot_repairs: snapshotRepairs,
  };
}

async function loadRecoveryData(eventId: string): Promise<RecoveryData> {
  const supabase = getSupabaseClient();
  const { data: event, error } = await supabase
    .from("backdated_recipe_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (error) throw new Error(error.message);
  if (!event) throw new Error(`Backdated recipe event not found: ${eventId}`);

  const { findAllNoCache } = await import("../../sheets_db");
  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2") as Promise<BackdatedLedgerOrder[]>,
    findAllNoCache("Order_Lines_V2") as Promise<BackdatedLedgerOrderLine[]>,
    findAllNoCache("Stock_Ledger") as Promise<BackdatedLedgerStockRow[]>,
    findAllNoCache("Recipes") as Promise<BackdatedLedgerRecipe[]>,
    findAllNoCache("Semi_Products") as Promise<BackdatedLedgerSemiProduct[]>,
  ]);

  return {
    event: coerceEvent(event as Record<string, unknown>),
    orders,
    lines,
    ledger,
    recipes,
    semiProducts,
  };
}

function coerceEvent(row: Record<string, unknown>): BackdatedRecipeEvent {
  return {
    id: stringValue(row.id),
    target_type: stringValue(row.target_type),
    target_id: stringValue(row.target_id),
    effective_timestamp: stringValue(row.effective_timestamp),
    visibility_timestamp: stringValue(row.visibility_timestamp),
    status: stringValue(row.status),
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

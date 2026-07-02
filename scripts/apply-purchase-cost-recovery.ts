import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { auditPurchaseLedger } from "../lib/purchase-ledger-audit";
import {
  buildPurchaseCostRecoveryPlan,
  type PurchaseCostRecoveryPlan,
} from "../lib/purchase-cost-recovery";
import { buildPurchaseReceipt } from "../lib/purchase-ledger-rebuild";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const PLAN_PATH = resolve(
  process.cwd(),
  "docs/audits/2026-07-02-purchase-cost-recovery-plan.json",
);

async function buildCurrentPlan(
  runId: string,
): Promise<PurchaseCostRecoveryPlan> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [
    purchaseOrders,
    purchaseOrderLines,
    purchasedItems,
    conversions,
    stockLedger,
  ] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Stock_Ledger"),
  ]);
  const report = auditPurchaseLedger({
    purchaseOrders: purchaseOrders as any[],
    purchaseOrderLines: purchaseOrderLines as any[],
    purchasedItems: purchasedItems as any[],
    conversions: conversions as any[],
    stockLedger: stockLedger as any[],
  });
  const orderMap = new Map(
    (purchaseOrders as any[]).map(order => [order.id, order]),
  );
  const itemMap = new Map(
    (purchasedItems as any[]).map(item => [item.id, item]),
  );
  const expectedReceipts = (purchaseOrderLines as any[])
    .map(line => {
      const poId = line.purchase_order_id || line.po_id || "";
      const po = orderMap.get(poId);
      const item = itemMap.get(line.purchased_item_id);
      if (!po || po.status !== "COMPLETED" || !item) return null;
      const receipt = buildPurchaseReceipt({
        po,
        line,
        item,
        conversions: conversions as any[],
      });
      return {
        po_id: poId,
        item_reference: receipt.item_reference,
        quantity_change: receipt.quantity_change,
        unit_cost: receipt.unit_cost,
      };
    })
    .filter(Boolean) as Array<{
      po_id: string;
      item_reference: string;
      quantity_change: number;
      unit_cost: number;
    }>;
  return buildPurchaseCostRecoveryPlan({
    runId,
    mismatches: report.ledgerMismatches,
    expectedReceipts,
    ledger: stockLedger as any[],
    materialThreshold: 1,
  });
}

function printPlan(plan: PurchaseCostRecoveryPlan): void {
  console.log(`Run: ${plan.run_id}`);
  console.log(`Source SHA-256: ${plan.source_hash}`);
  console.log(`Changes: ${plan.changes.length}`);
  for (const change of plan.changes) {
    console.log(
      `${change.po_id}/${change.item_reference}: ` +
      `${change.old_unit_cost} -> ${change.new_unit_cost} ` +
      `(delta ${change.delta_total_cost} VND)`,
    );
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  if (apply && rollback) {
    throw new Error("Choose either --apply or --rollback.");
  }

  const savedPlan = JSON.parse(
    readFileSync(PLAN_PATH, "utf8"),
  ) as PurchaseCostRecoveryPlan;
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  if (rollback) {
    const { data, error } = await supabase.rpc(
      "rollback_purchase_cost_recovery",
      { p_run_id: savedPlan.run_id },
    );
    if (error) throw new Error(error.message);
    console.log("=== PURCHASE COST RECOVERY ROLLBACK ===");
    console.log(JSON.stringify(data));
    return;
  }

  const { data: existingLog, error: logError } = await supabase
    .from("data_recovery_changes")
    .select("row_id, new_value, rolled_back_at")
    .eq("run_id", savedPlan.run_id);
  if (logError) throw new Error(logError.message);

  if (!existingLog || existingLog.length === 0) {
    const currentPlan = await buildCurrentPlan(savedPlan.run_id);
    if (
      currentPlan.source_hash !== savedPlan.source_hash ||
      JSON.stringify(currentPlan.changes) !== JSON.stringify(savedPlan.changes)
    ) {
      throw new Error(
        "Current data no longer matches the reviewed recovery plan.",
      );
    }
  }

  console.log(
    `=== PURCHASE COST RECOVERY (${apply ? "APPLY" : "DRY RUN"}) ===`,
  );
  printPlan(savedPlan);
  if (!apply) {
    console.log(`Existing recovery log rows: ${existingLog?.length || 0}`);
    console.log("No operational data was changed.");
    return;
  }

  const { data, error } = await supabase.rpc(
    "apply_purchase_cost_recovery",
    {
      p_run_id: savedPlan.run_id,
      p_source_hash: savedPlan.source_hash,
      p_changes: savedPlan.changes,
    },
  );
  if (error) throw new Error(error.message);
  console.log(`Result: ${JSON.stringify(data)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

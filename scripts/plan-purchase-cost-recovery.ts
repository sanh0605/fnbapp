import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { auditPurchaseLedger } from "../lib/purchase-ledger-audit";
import { buildPurchaseCostRecoveryPlan } from "../lib/purchase-cost-recovery";
import { buildPurchaseReceipt } from "../lib/purchase-ledger-rebuild";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const RUN_ID = "PURCHASE-COST-ROUNDING-2026-07-02";
const OUTPUT_PATH = resolve(
  process.cwd(),
  "docs/audits/2026-07-02-purchase-cost-recovery-plan.json",
);

async function main(): Promise<void> {
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
  const plan = buildPurchaseCostRecoveryPlan({
    runId: RUN_ID,
    mismatches: report.ledgerMismatches,
    expectedReceipts,
    ledger: stockLedger as any[],
    materialThreshold: 1,
  });

  console.log("=== PURCHASE COST RECOVERY PLAN (READ ONLY) ===");
  console.log(`Changes: ${plan.changes.length}`);
  console.log(`Source SHA-256: ${plan.source_hash}`);
  for (const change of plan.changes) {
    console.log(
      [
        change.po_id,
        change.item_reference,
        `ledger=${change.ledger_id}`,
        `quantity=${change.quantity_change}`,
        `unit cost ${change.old_unit_cost} -> ${change.new_unit_cost}`,
        `total delta=${change.delta_total_cost} VND`,
      ].join(" | "),
    );
  }

  if (process.argv.includes("--write-plan")) {
    writeFileSync(
      OUTPUT_PATH,
      `${JSON.stringify(plan, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    console.log(`Plan written: ${OUTPUT_PATH}`);
  } else {
    console.log("No plan file or operational data was written.");
  }
  console.log("No operational data was changed.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

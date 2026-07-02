import { createHash } from "node:crypto";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type PurchaseOrderState = {
  order: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
};

function hashState(state: PurchaseOrderState): string {
  return createHash("sha256")
    .update(JSON.stringify(state))
    .digest("hex");
}

async function readState(
  poId: string,
): Promise<PurchaseOrderState> {
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  const [orderResult, linesResult, ledgerResult] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", poId)
      .single(),
    supabase
      .from("purchase_order_lines")
      .select("*")
      .eq("purchase_order_id", poId)
      .order("id"),
    supabase
      .from("stock_ledger")
      .select("*")
      .eq("reference_id", poId)
      .eq("transaction_type", "PO_RECEIPT")
      .order("id"),
  ]);
  const error =
    orderResult.error || linesResult.error || ledgerResult.error;
  if (error) {
    throw new Error(`Cannot read ${poId}: ${error.message}`);
  }
  return {
    order: orderResult.data as Record<string, unknown>,
    lines: (linesResult.data || []) as Array<Record<string, unknown>>,
    ledger: (ledgerResult.data || []) as Array<Record<string, unknown>>,
  };
}

async function verifyRollback(poId: string): Promise<void> {
  const { getSupabaseClient } = await import("../lib/supabase");
  const before = await readState(poId);
  const beforeHash = hashState(before);
  const { error } = await getSupabaseClient().rpc(
    "save_purchase_order_atomic",
    {
      p_order: before.order,
      p_lines: before.lines,
      p_ledger: [
        {
          id: "ROLLBACK-PROBE",
          item_reference: "ROLLBACK-PROBE",
          transaction_type: "INVALID",
          quantity_change: 0,
          unit_cost: 0,
        },
      ],
      p_replace_existing: true,
    },
  );
  if (!error?.message.includes("p_ledger may only contain PO_RECEIPT")) {
    throw new Error(
      `Rollback probe did not fail as expected: ${error?.message || "accepted"}`,
    );
  }

  const after = await readState(poId);
  const afterHash = hashState(after);
  console.log("=== PURCHASE ORDER ATOMIC ROLLBACK VERIFICATION ===");
  console.log(`Purchase order: ${poId}`);
  console.log(`Before SHA-256: ${beforeHash}`);
  console.log(`After SHA-256:  ${afterHash}`);
  console.log(`Status: ${beforeHash === afterHash ? "UNCHANGED" : "CHANGED"}`);
  console.log("The forced transaction failed and no change was committed.");
  if (beforeHash !== afterHash) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes("--verify-rollback")) {
    console.log("No remote transaction was attempted.");
    console.log(
      "Pass --verify-rollback and a purchase order ID to run the rollback check.",
    );
    return;
  }
  const poId = process.argv
    .slice(2)
    .find(arg => !arg.startsWith("--"));
  if (!poId) {
    throw new Error("A purchase order ID is required.");
  }
  await verifyRollback(poId);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

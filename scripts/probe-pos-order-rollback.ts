import crypto from "node:crypto";
import * as dotenv from "dotenv";
import { getSupabaseClient } from "../lib/supabase";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main(): Promise<void> {
  if (!process.argv.includes("--probe")) {
    console.log("=== POS ORDER ROLLBACK PROBE (DRY RUN) ===");
    console.log("Pass --probe to execute an intentionally failing transaction.");
    console.log("No operational data was written.");
    return;
  }

  const supabase = getSupabaseClient();
  const { data: sourceLine, error: sourceError } = await supabase
    .from("order_lines_v2")
    .select("product_id,variant_id")
    .limit(1)
    .single();
  if (sourceError || !sourceLine) {
    throw new Error(`Could not load a source line: ${sourceError?.message}`);
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,code")
    .limit(1)
    .single();
  if (brandError || !brand) {
    throw new Error(`Could not load a brand: ${brandError?.message}`);
  }

  const suffix = crypto.randomUUID();
  const orderId = `rollback-probe-order-${suffix}`;
  const lineId = `rollback-probe-line-${suffix}`;
  const now = new Date().toISOString();
  const { error: rpcError } = await supabase.rpc("create_pos_order_atomic", {
    p_brand_code: brand.code,
    p_order: {
      id: orderId,
      brand_id: brand.id,
      status: "COMPLETED",
      version: 1,
      created_at: now,
      completed_at: now,
      currency: "VND",
      gross_total: 0,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 0,
      applied_promotion_snapshot_json: {},
      pos_snapshot_json: {},
      payment_method: "CASH",
    },
    p_lines: [{
      id: lineId,
      order_id: orderId,
      line_no: 1,
      product_id: sourceLine.product_id,
      product_snapshot_json: {},
      variant_id: sourceLine.variant_id,
      variant_snapshot_json: {},
      qty: 1,
      unit_price: 0,
      modifiers_snapshot_json: [],
      gross_line_total: 0,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 0,
      cost_at_sale: 0,
      recipe_snapshot_json: {},
    }],
    p_event: {
      id: `rollback-probe-event-${suffix}`,
      order_id: orderId,
      event_type: "INTENTIONAL_FAILURE",
      event_at: now,
      to_version: 1,
      delta_json: {},
      reason: "Rollback probe",
    },
    p_ledger: [],
  });
  if (!rpcError) {
    throw new Error("Rollback probe unexpectedly succeeded");
  }

  const [{ count: orderCount }, { count: lineCount }] = await Promise.all([
    supabase
      .from("orders_v2")
      .select("id", { count: "exact", head: true })
      .eq("id", orderId),
    supabase
      .from("order_lines_v2")
      .select("id", { count: "exact", head: true })
      .eq("id", lineId),
  ]);

  console.log("=== POS ORDER ROLLBACK PROBE ===");
  console.log(`Expected database error: ${rpcError.message}`);
  console.log(`Persisted test orders: ${orderCount || 0}`);
  console.log(`Persisted test lines: ${lineCount || 0}`);
  console.log("Operational data remains unchanged.");

  if ((orderCount || 0) !== 0 || (lineCount || 0) !== 0) {
    throw new Error("Atomic rollback failed");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

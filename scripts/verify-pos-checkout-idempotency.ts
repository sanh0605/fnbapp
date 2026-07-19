import crypto from "node:crypto";
import * as dotenv from "dotenv";
import { getSupabaseClient } from "../lib/supabase";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type RpcResult = {
  order_id: string;
  order_no: string;
  line_count: number;
  ledger_count: number;
  idempotent_replay: boolean;
};

async function main(): Promise<void> {
  if (!process.argv.includes("--apply")) {
    console.log("=== POS CHECKOUT IDEMPOTENCY PROBE (DRY RUN) ===");
    console.log("Planned RPC calls: 2 with one shared client request ID.");
    console.log("Transient rows: 1 order, 1 line, 1 event, 1 ledger row.");
    console.log("Order number prefix: G5T (isolated from real brand sequences).");
    console.log("Cleanup: delete all transient rows and verify 0 remain.");
    console.log("Pass --apply to run the production probe.");
    console.log("No operational data was written.");
    return;
  }

  const supabase = getSupabaseClient();
  const suffix = crypto.randomUUID();
  const requestId = `gate5-idempotency-${suffix}`;
  const firstOrderId = `gate5-order-first-${suffix}`;
  const secondOrderId = `gate5-order-retry-${suffix}`;
  let persistedOrderId = "";

  try {
    const [{ data: brand, error: brandError }, { data: sourceLine, error: lineError }, { data: ingredient, error: ingredientError }] = await Promise.all([
      supabase.from("brands").select("id").limit(1).single(),
      supabase
        .from("order_lines_v2")
        .select("product_id,variant_id")
        .limit(1)
        .single(),
      supabase.from("base_ingredients").select("id").limit(1).single(),
    ]);
    if (brandError || !brand) {
      throw new Error(`Could not load a probe brand: ${brandError?.message}`);
    }
    if (lineError || !sourceLine) {
      throw new Error(`Could not load a probe product/variant: ${lineError?.message}`);
    }
    if (ingredientError || !ingredient) {
      throw new Error(`Could not load a probe ingredient: ${ingredientError?.message}`);
    }

    const firstPayload = buildPayload({
      suffix: `first-${suffix}`,
      requestId,
      orderId: firstOrderId,
      brandId: brand.id,
      productId: sourceLine.product_id,
      variantId: sourceLine.variant_id,
      ingredientId: ingredient.id,
    });
    const retryPayload = buildPayload({
      suffix: `retry-${suffix}`,
      requestId,
      orderId: secondOrderId,
      brandId: brand.id,
      productId: sourceLine.product_id,
      variantId: sourceLine.variant_id,
      ingredientId: ingredient.id,
    });

    const first = await callCheckoutRpc(firstPayload);
    persistedOrderId = first.order_id;
    const retry = await callCheckoutRpc(retryPayload);

    if (first.order_id !== retry.order_id || first.order_no !== retry.order_no) {
      throw new Error("Retry returned a different persisted order");
    }
    if (first.idempotent_replay || !retry.idempotent_replay) {
      throw new Error("RPC replay markers do not distinguish create from retry");
    }

    const counts = await loadProbeCounts(
      requestId,
      persistedOrderId,
      retryPayload,
    );
    if (
      counts.orders !== 1
      || counts.lines !== 1
      || counts.events !== 1
      || counts.ledgerRows !== 1
      || counts.retryPayloadRows !== 0
    ) {
      throw new Error(`Unexpected persisted probe counts: ${JSON.stringify(counts)}`);
    }

    console.log("=== POS CHECKOUT IDEMPOTENCY PROBE ===");
    console.log(`Request ID:               ${requestId}`);
    console.log(`First order result:        ${first.order_id} / ${first.order_no}`);
    console.log(`Retry order result:        ${retry.order_id} / ${retry.order_no}`);
    console.log(`Orders with request ID:    ${counts.orders}`);
    console.log(`Persisted order lines:     ${counts.lines}`);
    console.log(`Persisted order events:    ${counts.events}`);
    console.log(`Persisted ledger rows:     ${counts.ledgerRows}`);
    console.log(`Retry payload rows:        ${counts.retryPayloadRows}`);
  } finally {
    const cleanupOrderId = persistedOrderId || firstOrderId;
    const cleanupOrderIds = Array.from(new Set([
      cleanupOrderId,
      firstOrderId,
      secondOrderId,
    ]));
    const { error: ledgerCleanupError } = await supabase
      .from("stock_ledger")
      .delete()
      .in("reference_id", cleanupOrderIds);
    const { error: orderCleanupError } = await supabase
      .from("orders_v2")
      .delete()
      .in("id", cleanupOrderIds);
    if (ledgerCleanupError || orderCleanupError) {
      throw new Error(
        `Probe cleanup failed: ${ledgerCleanupError?.message || orderCleanupError?.message}`,
      );
    }

    const remaining = await loadRemainingProbeRows(requestId, cleanupOrderIds);
    console.log(`Cleanup rows remaining:    ${remaining}`);
    if (remaining !== 0) {
      throw new Error(`Probe cleanup left ${remaining} rows behind`);
    }
    console.log("Probe cleanup verified. No test data remains.");
  }
}

function buildPayload(input: {
  suffix: string;
  requestId: string;
  orderId: string;
  brandId: string;
  productId: string;
  variantId: string;
  ingredientId: string;
}) {
  const now = new Date().toISOString();
  const lineId = `gate5-line-${input.suffix}`;
  const eventId = `gate5-event-${input.suffix}`;
  const ledgerId = `gate5-ledger-${input.suffix}`;
  return {
    p_brand_code: "G5T",
    p_client_request_id: input.requestId,
    p_order: {
      id: input.orderId,
      brand_id: input.brandId,
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
      pos_snapshot_json: { source: "GATE5_IDEMPOTENCY_PROBE" },
      payment_method: "CASH",
    },
    p_lines: [{
      id: lineId,
      order_id: input.orderId,
      line_no: 1,
      product_id: input.productId,
      product_snapshot_json: {},
      variant_id: input.variantId,
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
      id: eventId,
      order_id: input.orderId,
      event_type: "CREATED",
      event_at: now,
      to_version: 1,
      delta_json: { probe: true },
      reason: "Gate 5 idempotency probe",
    },
    p_ledger: [{
      id: ledgerId,
      transaction_type: "SALES_CONSUME",
      reference_id: input.orderId,
      item_reference: input.ingredientId,
      quantity_change: -0.000001,
      unit_cost: 0,
      created_at: now,
      order_event_id: eventId,
      cost_at_sale: 0,
      source: "GATE5_IDEMPOTENCY_PROBE",
      notes: "Transient row; removed before probe returns",
    }],
  };
}

async function callCheckoutRpc(payload: ReturnType<typeof buildPayload>): Promise<RpcResult> {
  const { data, error } = await getSupabaseClient().rpc(
    "create_pos_order_atomic",
    payload,
  );
  if (error) throw new Error(`create_pos_order_atomic: ${error.message}`);
  return data as RpcResult;
}

async function loadProbeCounts(
  requestId: string,
  orderId: string,
  retryPayload: ReturnType<typeof buildPayload>,
) {
  const supabase = getSupabaseClient();
  const [
    orders,
    lines,
    events,
    ledgerRows,
    retryOrders,
    retryLines,
    retryEvents,
    retryLedgerRows,
  ] = await Promise.all([
    countRows(supabase.from("orders_v2").select("id", { count: "exact", head: true }).eq("client_request_id", requestId)),
    countRows(supabase.from("order_lines_v2").select("id", { count: "exact", head: true }).eq("order_id", orderId)),
    countRows(supabase.from("order_events").select("id", { count: "exact", head: true }).eq("order_id", orderId)),
    countRows(supabase.from("stock_ledger").select("id", { count: "exact", head: true }).eq("reference_id", orderId)),
    countRows(supabase.from("orders_v2").select("id", { count: "exact", head: true }).eq("id", retryPayload.p_order.id)),
    countRows(supabase.from("order_lines_v2").select("id", { count: "exact", head: true }).eq("id", retryPayload.p_lines[0].id)),
    countRows(supabase.from("order_events").select("id", { count: "exact", head: true }).eq("id", retryPayload.p_event.id)),
    countRows(supabase.from("stock_ledger").select("id", { count: "exact", head: true }).eq("id", retryPayload.p_ledger[0].id)),
  ]);
  return {
    orders,
    lines,
    events,
    ledgerRows,
    retryPayloadRows: retryOrders + retryLines + retryEvents + retryLedgerRows,
  };
}

async function loadRemainingProbeRows(
  requestId: string,
  orderIds: string[],
): Promise<number> {
  const supabase = getSupabaseClient();
  const counts = await Promise.all([
    countRows(supabase.from("orders_v2").select("id", { count: "exact", head: true }).eq("client_request_id", requestId)),
    countRows(supabase.from("order_lines_v2").select("id", { count: "exact", head: true }).in("order_id", orderIds)),
    countRows(supabase.from("order_events").select("id", { count: "exact", head: true }).in("order_id", orderIds)),
    countRows(supabase.from("stock_ledger").select("id", { count: "exact", head: true }).in("reference_id", orderIds)),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count || 0;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

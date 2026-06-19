/**
 * Fix PHD000522: V1 under-counted promo by 5k for 2-cup line.
 * - line.promo_discount: 5k → 10k
 * - line.net_line_total: 46k → 41k
 * - order.promo_discount_total: 5k → 10k
 * - order.net_total: 46k → 41k
 * - order.manual_order_discount: stays 0
 * - order.migration_notes: append WS-8 correction note
 *
 * Run: npx tsx scripts/fix-phd000522-promo.ts --live
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache, update } = require("../lib/sheets_db");
const { assertOrderInvariants } = require("../lib/order-math");

async function main() {
  const isLive = process.argv.includes("--live");

  const orders = await findAllNoCache("Orders_V2");
  const lines = await findAllNoCache("Order_Lines_V2");
  const order = orders.find((o: any) => o.order_no === "PHD000522");
  if (!order) { console.error("PHD000522 not found"); process.exit(1); }

  const orderLines = lines.filter((l: any) => l.order_id === order.id);
  console.log(`=== PHD000522 before fix ===`);
  console.log(`Order:`, {
    gross_total: order.gross_total,
    promo_discount_total: order.promo_discount_total,
    manual_item_discount_total: order.manual_item_discount_total,
    manual_order_discount: order.manual_order_discount,
    net_total: order.net_total,
  });
  console.log(`Lines:`, orderLines.map((l: any) => ({
    variant_id: l.variant_id,
    qty: l.qty,
    promo_discount: l.promo_discount,
    manual_item_discount: l.manual_item_discount,
    order_discount_allocation: l.order_discount_allocation,
    net_line_total: l.net_line_total,
  })));

  // Compute fix
  const OLD_PROMO = 5000;
  const NEW_PROMO = 10000;
  const PROMO_DELTA = NEW_PROMO - OLD_PROMO; // +5000

  const newOrderPromoTotal = Number(order.promo_discount_total) + PROMO_DELTA;
  const newOrderNetTotal = Number(order.net_total) - PROMO_DELTA;

  const newLines = orderLines.map((l: any) => {
    const newPromo = Number(l.promo_discount) + PROMO_DELTA;
    const newNet = Number(l.net_line_total) - PROMO_DELTA;
    return { ...l, promo_discount: newPromo, net_line_total: newNet };
  });

  // Verify invariants
  const orderV2 = {
    ...order,
    version: Number(order.version) || 1,
    gross_total: Number(order.gross_total) || 0,
    promo_discount_total: newOrderPromoTotal,
    manual_item_discount_total: Number(order.manual_item_discount_total) || 0,
    manual_order_discount: Number(order.manual_order_discount) || 0,
    net_total: newOrderNetTotal,
  };
  const linesV2 = newLines.map((l: any) => ({
    ...l,
    qty: Number(l.qty) || 0,
    unit_price: Number(l.unit_price) || 0,
    gross_line_total: Number(l.gross_line_total) || 0,
    promo_discount: l.promo_discount,
    manual_item_discount: Number(l.manual_item_discount) || 0,
    order_discount_allocation: Number(l.order_discount_allocation) || 0,
    net_line_total: l.net_line_total,
  }));

  console.log(`\n=== PHD000522 after fix (dry) ===`);
  console.log(`Order:`, {
    gross_total: orderV2.gross_total,
    promo_discount_total: orderV2.promo_discount_total,
    manual_item_discount_total: orderV2.manual_item_discount_total,
    manual_order_discount: orderV2.manual_order_discount,
    net_total: orderV2.net_total,
  });
  console.log(`Lines:`, linesV2.map((l: any) => ({
    variant_id: l.variant_id,
    qty: l.qty,
    promo_discount: l.promo_discount,
    manual_item_discount: l.manual_item_discount,
    order_discount_allocation: l.order_discount_allocation,
    net_line_total: l.net_line_total,
  })));

  try {
    assertOrderInvariants(orderV2 as any, linesV2 as any);
    console.log(`\n✓ Invariants pass after fix`);
  } catch (err: any) {
    console.error(`\n✗ Invariants fail:`, err.message);
    process.exit(1);
  }

  // Verify per-cup revenue after fix
  const { allocateLineRevenue } = require("../lib/order-math");
  for (const l of linesV2) {
    const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
    const alloc = allocateLineRevenue({
      unit_price: l.unit_price,
      qty: l.qty,
      modifiers: mods,
      gross_line_total: l.gross_line_total,
      promo_discount: l.promo_discount,
      manual_item_discount: l.manual_item_discount,
      order_discount_allocation: l.order_discount_allocation,
    });
    const perCup = l.qty > 0 ? alloc.variantRevenue / l.qty : 0;
    console.log(`  variant ${l.variant_id} per cup: ${perCup}đ (expected 14500 — 15k promo less 500 manual_item per cup)`);
  }

  if (!isLive) {
    console.log(`\nDry-run complete. Use --live to apply.`);
    return;
  }

  // Apply fix
  const migrationNotes = (order.migration_notes || "") +
    " | WS-8 fix: V1 under-counted promo for 2-cup line (line.line_discount=5000 instead of 10000). promo_discount_total corrected 5000→10000, net_total adjusted 46000→41000 to match promo price customer should have paid.";

  await update("Orders_V2", order.id, {
    promo_discount_total: newOrderPromoTotal,
    net_total: newOrderNetTotal,
    migration_notes: migrationNotes,
  });

  for (const l of orderLines) {
    const newL = newLines.find((nl: any) => nl.id === l.id);
    await update("Order_Lines_V2", l.id, {
      promo_discount: newL.promo_discount,
      net_line_total: newL.net_line_total,
    });
  }

  console.log(`\n✓ Applied fix. Order + ${orderLines.length} line(s) updated.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

/**
 * Fix 2 specific orders per User direction:
 *
 * 1. PHD000522: revert test edit (qty 2→1)
 *    Original sale: 1 × Cà phê sữa đá VAR-002 (20k) + 2 × MOD-001 (3k each = 6k) + 1k manual_item (on topping)
 *    gross 52k→26k, promo 10k→5k, net 41k→20k
 *
 * 2. UCK000161: V1 order discount_amount (12k) was wrong, customer didn't get it
 *    manual_order 12k→0, net 33k→45k, line order_alloc 4k→0 for all 3 lines
 *
 * Run: npx tsx scripts/fix-phd522-and-uck161.ts --live
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache, update } = require("../lib/sheets_db");
const { assertOrderInvariants } = require("../lib/order-math");

async function fixOrder(orderNo: string, orderUpdates: any, lineUpdates: Array<{ lineId: string; updates: any }>, notes: string) {
  const isLive = process.argv.includes("--live");

  const orders = await findAllNoCache("Orders_V2");
  const lines = await findAllNoCache("Order_Lines_V2");
  const order = orders.find((o: any) => o.order_no === orderNo);
  if (!order) { console.error(`${orderNo} not found`); return; }

  const orderLines = lines.filter((l: any) => l.order_id === order.id);

  console.log(`\n=== ${orderNo} ===`);
  console.log(`Before:`, {
    gross: order.gross_total,
    promo: order.promo_discount_total,
    manual_item: order.manual_item_discount_total,
    manual_order: order.manual_order_discount,
    net: order.net_total,
  });
  console.log(`Lines before:`, orderLines.map((l: any) => ({
    line_no: l.line_no,
    variant: l.variant_id,
    qty: l.qty,
    gross_line: l.gross_line_total,
    promo: l.promo_discount,
    order_alloc: l.order_discount_allocation,
    net: l.net_line_total,
  })));

  // Apply line updates
  const updatedLines = orderLines.map((l: any) => {
    const lu = lineUpdates.find(u => u.lineId === l.id);
    return lu ? { ...l, ...lu.updates } : l;
  });

  // Build updated order for invariant check
  const updatedOrder = {
    ...order,
    version: Number(order.version) || 1,
    gross_total: Number(orderUpdates.gross_total ?? order.gross_total),
    promo_discount_total: Number(orderUpdates.promo_discount_total ?? order.promo_discount_total),
    manual_item_discount_total: Number(orderUpdates.manual_item_discount_total ?? order.manual_item_discount_total),
    manual_order_discount: Number(orderUpdates.manual_order_discount ?? order.manual_order_discount),
    net_total: Number(orderUpdates.net_total ?? order.net_total),
  };

  const typedLines = updatedLines.map((l: any) => ({
    ...l,
    qty: Number(l.qty) || 0,
    unit_price: Number(l.unit_price) || 0,
    gross_line_total: Number(l.gross_line_total) || 0,
    promo_discount: Number(l.promo_discount) || 0,
    manual_item_discount: Number(l.manual_item_discount) || 0,
    order_discount_allocation: Number(l.order_discount_allocation) || 0,
    net_line_total: Number(l.net_line_total) || 0,
  }));

  console.log(`\nAfter (dry):`);
  console.log(`  Order:`, {
    gross: updatedOrder.gross_total,
    promo: updatedOrder.promo_discount_total,
    manual_item: updatedOrder.manual_item_discount_total,
    manual_order: updatedOrder.manual_order_discount,
    net: updatedOrder.net_total,
  });
  console.log(`  Lines:`, typedLines.map((l: any) => ({
    line_no: l.line_no,
    variant: l.variant_id,
    qty: l.qty,
    gross_line: l.gross_line_total,
    promo: l.promo_discount,
    order_alloc: l.order_discount_allocation,
    net: l.net_line_total,
  })));

  try {
    assertOrderInvariants(updatedOrder as any, typedLines as any);
    console.log(`  ✓ Invariants pass`);
  } catch (err: any) {
    console.error(`  ✗ Invariants fail:`, err.message);
    throw err;
  }

  if (!isLive) {
    console.log(`  Dry-run only`);
    return;
  }

  // Apply
  const newNotes = (order.migration_notes || "") + ` | ${notes}`;
  await update("Orders_V2", order.id, { ...orderUpdates, migration_notes: newNotes });
  for (const lu of lineUpdates) {
    await update("Order_Lines_V2", lu.lineId, lu.updates);
  }
  console.log(`  ✓ Applied`);
}

async function main() {
  // Fix 1: PHD000522 revert test edit
  // Current state (after my earlier fix):
  //   Line: qty=2, gross_line=52k, promo=10k, manual_item=1k, alloc=0, net=41k
  //   Order: gross=52k, promo=10k, manual_item_total=1k, manual_order=0, net=41k
  //
  // Target (1 cup + 2 toppings × 1 cup = 6k topping):
  //   gross_variant = 20k (1 × 20k)
  //   gross_modifiers = 6k (2 × 3k × 1)
  //   gross_line = 26k
  //   promo = 5k (1 × 5k)
  //   manual_item = 1k (unchanged, semantic = topping discount)
  //   order_alloc = 0
  //   net_line = 26 - 5 - 1 - 0 = 20k
  //
  //   Order: gross=26k, promo=5k, manual_item_total=1k, manual_order=0, net=20k

  const orders = await findAllNoCache("Orders_V2");
  const lines = await findAllNoCache("Order_Lines_V2");
  const phd522 = orders.find((o: any) => o.order_no === "PHD000522");
  const phd522Line = lines.find((l: any) => l.order_id === phd522?.id);

  await fixOrder(
    "PHD000522",
    {
      gross_total: 26000,
      promo_discount_total: 5000,
      manual_item_discount_total: 1000,
      manual_order_discount: 0,
      net_total: 20000,
    },
    [{
      lineId: phd522Line.id,
      updates: {
        qty: 1,
        gross_line_total: 26000,
        promo_discount: 5000,
        manual_item_discount: 1000,
        order_discount_allocation: 0,
        net_line_total: 20000,
      },
    }],
    "WS-9 fix: revert test edit. Original sale was 1 cup + 2 toppings. Test edit changed qty 1→2; reverted to actual sale.",
  );

  // Fix 2: UCK000161 order discount 12k → 0
  // Current: gross=77k, promo=32k, manual_order=12k, net=33k
  //          3 lines each at net=11k (alloc=4k each)
  // Target:  gross=77k, promo=32k, manual_order=0, net=45k
  //          3 lines each at net=15k (alloc=0)
  //          L1: 32-17-0-0=15k, L2: 18-3-0-0=15k, L3: 27-12-0-0=15k ✓

  const uck161 = orders.find((o: any) => o.order_no === "UCK000161");
  const uck161Lines = lines.filter((l: any) => l.order_id === uck161?.id);

  await fixOrder(
    "UCK000161",
    {
      manual_order_discount: 0,
      net_total: 45000,
    },
    uck161Lines.map((l: any) => ({
      lineId: l.id,
      updates: {
        order_discount_allocation: 0,
        net_line_total: Number(l.gross_line_total) - Number(l.promo_discount) - Number(l.manual_item_discount) - 0,
      },
    })),
    "WS-9 fix: V1 discount_amount 12k was wrong (test edit / bug). Customer only got PRM-003 promo, paid 45k.",
  );
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

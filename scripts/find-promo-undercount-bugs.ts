/**
 * Find all V2 orders where stored promo_discount_total doesn't match
 * recomputed promo from snapshot (per-cup promo × qty).
 *
 * Bug pattern (PHD000522): V1 had promo under-counted for multi-cup lines.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [orders, lines, variants, promotions] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Promotions"),
  ]);

  const promoById = new Map<string, any>();
  for (const p of promotions) promoById.set(p.id, p);

  const filteredOrders = orders.filter((o: any) =>
    o.status === "COMPLETED" && !o.superseded_by && o.applied_promotion_id,
  );
  const orderIds = new Set(filteredOrders.map((o: any) => o.id));

  const bugOrders: any[] = [];
  let totalChecked = 0;
  let totalBugs = 0;
  let totalDrift = 0;

  for (const order of filteredOrders) {
    const orderLines = lines.filter((l: any) => l.order_id === order.id);
    const promoId = order.applied_promotion_id;
    const promo = promoById.get(promoId);
    if (!promo || promo.type !== "PRODUCT_DISCOUNT") continue;

    // Parse promo's applicable_products_json
    let applicableMap: any = {};
    try {
      applicableMap = JSON.parse(promo.applicable_products_json || "{}");
    } catch {}

    // Get snapshot from order too (more reliable for FLAT_PRICE per variant)
    let snapshotMap: any = null;
    try {
      const snap = JSON.parse(order.applied_promotion_snapshot_json || "{}");
      if (snap.applicable_products_json) {
        snapshotMap = JSON.parse(snap.applicable_products_json);
      }
    } catch {}

    const applicableSource = snapshotMap || applicableMap;

    let orderHasBug = false;
    const lineChecks = [];

    for (const line of orderLines) {
      const qty = Number(line.qty || 0);
      const unitPrice = Number(line.unit_price || 0);
      const storedPromo = Number(line.promo_discount || 0);

      // Compute expected promo from snapshot
      const targetPrice = applicableSource[line.variant_id];
      if (targetPrice === undefined) continue; // variant not in promo

      let expectedPromo = 0;
      if (promo.discount_type === "FLAT_PRICE") {
        expectedPromo = Math.max(0, unitPrice - Number(targetPrice)) * qty;
      } else if (promo.discount_type === "PERCENT") {
        const gross = unitPrice * qty;
        expectedPromo = gross * (Number(promo.discount_value) / 100);
      } else {
        expectedPromo = Number(promo.discount_value) * qty;
      }
      expectedPromo = Math.round(expectedPromo);

      totalChecked++;
      const drift = storedPromo - expectedPromo;
      if (Math.abs(drift) > 1) {
        orderHasBug = true;
        totalBugs++;
        totalDrift += drift;
        lineChecks.push({
          variant_id: line.variant_id,
          qty,
          unit_price: unitPrice,
          stored_promo: storedPromo,
          expected_promo: expectedPromo,
          drift,
        });
      }
    }

    if (orderHasBug) {
      bugOrders.push({
        order_no: order.order_no,
        order_id: order.id,
        promo_id: promoId,
        line_checks: lineChecks,
      });
    }
  }

  console.log(`Total lines checked: ${totalChecked}`);
  console.log(`Total bug lines: ${totalBugs}`);
  console.log(`Total drift (stored - expected): ${totalDrift}đ`);
  console.log(`Bug orders: ${bugOrders.length}\n`);

  console.log(`=== All bug orders ===`);
  for (const bug of bugOrders) {
    console.log(`\n${bug.order_no} (promo ${bug.promo_id}):`);
    for (const lc of bug.line_checks) {
      console.log(`  variant ${lc.variant_id} qty=${lc.qty} unit=${lc.unit_price} | stored_promo=${lc.stored_promo} expected=${lc.expected_promo} drift=${lc.drift > 0 ? "+" : ""}${lc.drift}`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

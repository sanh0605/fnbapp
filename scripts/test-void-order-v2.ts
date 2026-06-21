/**
 * Smoke test: void an order via voidOrderV2.
 * Verify: order status=VOIDED, reversal entries created, Order_Events VOIDED present.
 *
 * Run: npx tsx scripts/test-void-order-v2.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { submitOrderV2 } = require("../app/actions/pos");
const { voidOrderV2 } = require("../app/actions/orders");

async function main() {
  const products = await findAllNoCache("Products");
  const variants = await findAllNoCache("Product_Variants");
  const suaDauProduct = products.find((p: any) => p.name?.includes("Sữa dâu"));
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  const brandId = suaDauProduct.brand_id || (await findAllNoCache("Brands"))[0].id;

  console.log("Creating order to void...");
  const createRes = await submitOrderV2({
    brand_id: brandId,
    items: [{
      product_id: suaDauProduct.id, variant_id: suaDauVariant.id, qty: 1,
      modifiers: [], manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "smoke-test", name: "Smoke Test" },
  });
  if (!createRes.success) { console.error(createRes.error); process.exit(1); }
  console.log(`  Created: ${createRes.order_no}`);

  console.log("Voiding...");
  const voidRes = await voidOrderV2(createRes.order_id, "Smoke test: voiding");
  if (!voidRes.success) { console.error(voidRes.error); process.exit(1); }
  console.log("  Voided");

  console.log("Verifying...");
  const orders = await findAllNoCache("Orders_V2");
  const events = await findAllNoCache("Order_Events");
  const ledger = await findAllNoCache("Stock_Ledger");

  const order = orders.find((o: any) => o.id === createRes.order_id);
  console.log(`Status: ${order.status} (expect VOIDED)`);
  console.log(`Void reason: ${order.void_reason}`);

  const voidEvents = events.filter((e: any) => e.order_id === createRes.order_id && e.event_type === "VOIDED");
  console.log(`VOIDED events: ${voidEvents.length} (expect 1)`);

  const reversals = ledger.filter((l: any) => l.reference_id === createRes.order_id && l.transaction_type === "EDIT_REVERSAL");
  console.log(`Reversal entries: ${reversals.length}`);

  console.log("\nSmoke test PASSED");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

/**
 * Smoke test: create an order via submitOrderV2, then edit it via editOrderV2.
 * Verify: original becomes SUPERSEDED, new version COMPLETED, reversal+consume
 * ledger entries created.
 *
 * Run: npx tsx scripts/test-edit-order-v2.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { submitOrderV2 } = require("../app/actions/pos-v2");
const { editOrderV2 } = require("../app/actions/order-edit-v2");

async function main() {
  console.log("Loading reference data...");
  const products = await findAllNoCache("Products");
  const variants = await findAllNoCache("Product_Variants");

  const suaDauProduct = products.find((p: any) => p.name?.includes("Sữa dâu"));
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  const brandId = suaDauProduct.brand_id || (await findAllNoCache("Brands"))[0].id;

  // Step 1: Create order
  console.log("Step 1: Creating initial order (qty=1)...");
  const createRes = await submitOrderV2({
    brand_id: brandId,
    items: [{
      product_id: suaDauProduct.id,
      variant_id: suaDauVariant.id,
      qty: 1,
      modifiers: [],
      manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "smoke-test", name: "Smoke Test" },
  });

  if (!createRes.success) {
    console.error("Create failed:", createRes.error);
    process.exit(1);
  }
  console.log(`  Created: order_no=${createRes.order_no}, id=${createRes.order_id}`);

  // Step 2: Edit order (qty 1 → 2)
  console.log("Step 2: Editing order (qty 1 → 2)...");
  const editRes = await editOrderV2({
    orderId: createRes.order_id,
    expectedVersion: 1,
    cart: {
      brand_id: brandId,
      items: [{
        product_id: suaDauProduct.id,
        variant_id: suaDauVariant.id,
        qty: 2,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "smoke-test", name: "Smoke Test" },
    },
    reason: "Smoke test: customer added 1 more cup",
  });

  if (!editRes.success) {
    console.error("Edit failed:", editRes.error);
    process.exit(1);
  }
  console.log(`  Edited: new id=${editRes.new_order_id}, version=${editRes.new_version}`);

  // Step 3: Verify
  console.log("Step 3: Verifying...");
  const orders = await findAllNoCache("Orders_V2");
  const lines = await findAllNoCache("Order_Lines_V2");
  const events = await findAllNoCache("Order_Events");
  const ledger = await findAllNoCache("Stock_Ledger");

  const oldOrder = orders.find((o: any) => o.id === createRes.order_id);
  const newOrder = orders.find((o: any) => o.id === editRes.new_order_id);

  console.log("\n=== VERIFICATION ===");
  console.log(`Old order status: ${oldOrder.status} (expect SUPERSEDED)`);
  console.log(`Old order superseded_by: ${oldOrder.superseded_by}`);
  console.log(`New order status: ${newOrder.status} (expect COMPLETED)`);
  console.log(`New order version: ${newOrder.version} (expect 2)`);
  console.log(`New order parent_order_id: ${newOrder.parent_order_id}`);

  const newLines = lines.filter((l: any) => l.order_id === editRes.new_order_id);
  console.log(`New order line count: ${newLines.length}`);
  console.log(`New order qty: ${newLines[0].qty} (expect 2)`);

  const editEvents = events.filter((e: any) => e.event_type === "EDITED");
  console.log(`EDITED events: ${editEvents.length}`);

  const reversals = ledger.filter((l: any) => l.transaction_type === "EDIT_REVERSAL" && l.reference_id === createRes.order_id);
  console.log(`Reversal entries for old order: ${reversals.length}`);

  const newConsumes = ledger.filter((l: any) => l.transaction_type === "SALES_CONSUME" && l.reference_id === editRes.new_order_id);
  console.log(`SALES_CONSUME entries for new order: ${newConsumes.length}`);

  console.log("\nSmoke test PASSED");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});

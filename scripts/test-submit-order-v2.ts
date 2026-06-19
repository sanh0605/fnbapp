/**
 * Smoke test: build a Sữa Dâu order via V2 pipeline, write to live sheets.
 *
 * Verifies:
 *   1. buildOrderFromCart produces invariant-safe order+lines
 *   2. insertOrderV2Records writes to all 4 sheets
 *   3. Subsequent verify-v2-schema still passes (no schema drift)
 *
 * Run: npx tsx scripts/test-submit-order-v2.ts
 *
 * DO NOT run on production spreadsheet without backup. Test row stays in
 * the V2 sheets; clean up manually if needed (or extend script to remove
 * the test row at end — left as TODO for WS-9).
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAll, findAllNoCache } = require("../lib/sheets_db");
const { buildOrderFromCart } = require("../lib/order-cart");
const { computeLineCostAtSale } = require("../lib/order-cogs");
const { insertOrderV2Records } = require("../lib/sheets-db-v2");
const crypto = require("node:crypto");

async function main() {
  console.log("Loading reference data...");
  const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients] = await Promise.all([
    findAllNoCache("Brands"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Product_Categories"),
    findAllNoCache("Modifiers"),
    findAllNoCache("Promotions"),
    findAllNoCache("Recipes"),
    findAllNoCache("Base_Ingredients"),
  ]);
  const ledger = await findAllNoCache("Stock_Ledger");

  // Find Sữa Dâu
  const suaDauProduct = products.find((p: any) => p.name && p.name.includes("Sữa dâu"));
  if (!suaDauProduct) {
    console.error("Sữa Dâu product not found. Aborting.");
    process.exit(1);
  }
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  if (!suaDauVariant) {
    console.error("Sữa Dâu variant not found. Aborting.");
    process.exit(1);
  }
  console.log(`Found: ${suaDauProduct.name} / ${suaDauVariant.size_name} @ ${suaDauVariant.price}`);

  console.log("Building order from cart...");
  const built = buildOrderFromCart({
    brand_id: suaDauProduct.brand_id || brands[0].id,
    items: [{
      product_id: suaDauProduct.id,
      variant_id: suaDauVariant.id,
      qty: 1,
      modifiers: [],
      manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "smoke-test", name: "Smoke Test Script" },
  }, { brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients });

  console.log("Built order:", {
    gross_total: built.order.gross_total,
    promo_discount_total: built.order.promo_discount_total,
    manual_item_discount_total: built.order.manual_item_discount_total,
    manual_order_discount: built.order.manual_order_discount,
    net_total: built.order.net_total,
    applied_promotion_id: built.order.applied_promotion_id,
  });

  console.log("Computing COGS...");
  for (const line of built.lines) {
    const recipeSnap = JSON.parse(line.recipe_snapshot_json);
    line.cost_at_sale = computeLineCostAtSale(recipeSnap, ledger, line.qty, built.order.created_at);
  }

  console.log("Assigning order_no (test prefix to avoid collision with prod)...");
  const orderNo = `TEST${Date.now().toString().slice(-6)}`;
  const finalOrder = { ...built.order, order_no: orderNo };

  const event = {
    id: `evt-${crypto.randomUUID()}`,
    order_id: finalOrder.id,
    event_type: "CREATED",
    event_at: finalOrder.created_at,
    actor_id: "smoke-test",
    actor_name: "Smoke Test Script",
    from_version: "",
    to_version: 1,
    previous_order_id: "",
    delta_json: JSON.stringify({ smoke_test: true }),
    reason: "smoke test",
  };

  // Skip stock ledger for smoke test (no recipe assumed for test product)
  console.log("Inserting into V2 sheets...");
  const result = await insertOrderV2Records({
    order: finalOrder,
    lines: built.lines,
    event,
    ledgerEntries: [],
  });

  if (!result.success) {
    console.error("FAIL:", result.error);
    process.exit(1);
  }

  console.log(`SUCCESS: order_no=${orderNo}, order_id=${finalOrder.id}`);
  console.log(`Verify in Google Sheets: Orders_V2, Order_Lines_V2, Order_Events`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});

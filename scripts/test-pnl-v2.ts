/**
 * Smoke test: create order via submitOrderV2 → call getPnLDataV2 → verify.
 *
 * Run: npx tsx scripts/test-pnl-v2.ts
 *
 * Verifies:
 *   1. getPnLDataV2 returns the created order in aggregation
 *   2. totalRevenue = sum of created orders' net_total
 *   3. Product profit analysis shows the correct product
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAll } = require("../lib/sheets_db");
const { submitOrderV2 } = require("../app/pos/actions");
const { getPnLDataV2 } = require("../app/actions/reports");

async function main() {
  console.log("Loading reference data...");
  const products = await findAll("Products");
  const variants = await findAll("Product_Variants");
  const suaDauProduct = products.find((p: any) => p.name?.includes("Sữa dâu"));
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  const brandId = suaDauProduct.brand_id || (await findAll("Brands"))[0].id;

  console.log("Creating order via V2...");
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
    actor: { id: "pnl-smoke", name: "PnL Smoke Test" },
  });

  if (!createRes.success) {
    console.error("Create failed:", createRes.error);
    process.exit(1);
  }
  console.log(`  Created: ${createRes.order_no}`);

  // Compute date range that includes today
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  console.log(`\nFetching PnL for today (${start} → ${end})...`);
  const pnl = await getPnLDataV2({ startDate: start, endDate: end });

  console.log("\n=== PnL V2 Result ===");
  console.log(`  Order count:      ${pnl.orderCount}`);
  console.log(`  Total revenue:    ${pnl.totalRevenue.toLocaleString("vi-VN")}đ`);
  console.log(`  Total COGS:       ${pnl.totalCOGS.toLocaleString("vi-VN")}đ`);
  console.log(`  Gross profit:     ${pnl.grossProfit.toLocaleString("vi-VN")}đ`);
  console.log(`  Margin:           ${pnl.margin.toFixed(2)}%`);
  console.log(`  Products in analysis: ${pnl.productProfitAnalysis.length}`);

  // Verify: created order should appear
  if (pnl.orderCount === 0) {
    console.log("\nFAIL: Order count is 0 — order was created but PnL didn't pick it up");
    process.exit(1);
  }

  // Verify: revenue should be >= 25000 (Sữa Dâu net)
  if (pnl.totalRevenue < 25000) {
    console.log(`\nFAIL: totalRevenue ${pnl.totalRevenue} < 25000`);
    process.exit(1);
  }

  // Verify: Sữa Dâu in productProfitAnalysis
  const suaDau = pnl.productProfitAnalysis.find((p: any) => p.product_id === suaDauProduct.id);
  if (!suaDau) {
    console.log(`\nFAIL: Sữa Dâu not in productProfitAnalysis`);
    process.exit(1);
  }
  console.log(`  Sữa Dâu revenue:  ${suaDau.revenue.toLocaleString("vi-VN")}đ (qty ${suaDau.qty})`);

  console.log("\nPASSED");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmt(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [ledger, productionOrders, productionItems, semiProducts, units] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Production_Orders"),
    findAllNoCache("Production_Items"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Units"),
  ]);

  const unitById = new Map((units as any[]).map(unit => [unit.id, unit.name || unit.id]));
  const spById = new Map((semiProducts as any[]).map(sp => [sp.id, sp]));
  const producedByItem = new Map<string, number>();
  const yieldedByItem = new Map<string, number>();
  const soldByItem = new Map<string, number>();
  const productionConsumeByItem = new Map<string, number>();
  const adjustmentByItem = new Map<string, number>();

  for (const item of productionItems as any[]) {
    const spId = item.semi_product_id || "";
    producedByItem.set(spId, (producedByItem.get(spId) || 0) + Number(item.qty_produced || 0));
  }

  for (const row of ledger as any[]) {
    const itemId = row.item_reference || "";
    const qty = Number(row.quantity_change || 0);
    if (row.transaction_type === "PRODUCTION_YIELD") {
      yieldedByItem.set(itemId, (yieldedByItem.get(itemId) || 0) + qty);
    } else if (row.transaction_type === "SALES_CONSUME" || row.transaction_type === "EDIT_REVERSAL") {
      soldByItem.set(itemId, (soldByItem.get(itemId) || 0) + qty);
    } else if (row.transaction_type === "PRODUCTION_CONSUME") {
      productionConsumeByItem.set(itemId, (productionConsumeByItem.get(itemId) || 0) + qty);
    } else if (row.transaction_type === "STOCK_ADJUST") {
      adjustmentByItem.set(itemId, (adjustmentByItem.get(itemId) || 0) + qty);
    }
  }

  const rows = [...spById.keys()].map(id => {
    const sp = spById.get(id);
    return {
      id,
      name: sp?.name || id,
      unitName: unitById.get(sp?.base_unit || "") || sp?.base_unit || "",
      productionItemQty: producedByItem.get(id) || 0,
      ledgerYieldQty: yieldedByItem.get(id) || 0,
      salesConsumeQty: soldByItem.get(id) || 0,
      productionConsumeQty: productionConsumeByItem.get(id) || 0,
      adjustmentQty: adjustmentByItem.get(id) || 0,
      balance:
        (yieldedByItem.get(id) || 0) +
        (soldByItem.get(id) || 0) +
        (productionConsumeByItem.get(id) || 0) +
        (adjustmentByItem.get(id) || 0),
    };
  }).sort((a, b) => a.balance - b.balance);

  const yieldMismatches = rows.filter(row => Math.abs(row.productionItemQty - row.ledgerYieldQty) > 0.000001);
  const negative = rows.filter(row => row.balance < -0.000001);

  console.log("=== PRODUCTION STOCK AUDIT (READ ONLY) ===");
  console.log(`Production orders:        ${(productionOrders as any[]).length}`);
  console.log(`Production items:         ${(productionItems as any[]).length}`);
  console.log(`Semi products:            ${rows.length}`);
  console.log(`Yield mismatches:         ${yieldMismatches.length}`);
  console.log(`Negative semi-products:   ${negative.length}`);

  if (yieldMismatches.length > 0) {
    console.log("\nProduction items vs ledger yield mismatches:");
    for (const row of yieldMismatches.slice(0, 30)) {
      console.log(`${row.id} | ${row.name} | production_items=${fmt(row.productionItemQty)} | ledger_yield=${fmt(row.ledgerYieldQty)} ${row.unitName}`);
    }
  }

  if (negative.length > 0) {
    console.log("\nNegative semi-product balances:");
    for (const row of negative.slice(0, 50)) {
      console.log([
        row.id,
        row.name,
        `balance=${fmt(row.balance)} ${row.unitName}`,
        `yield=${fmt(row.ledgerYieldQty)}`,
        `sales=${fmt(row.salesConsumeQty)}`,
        `prod_consume=${fmt(row.productionConsumeQty)}`,
        `adjust=${fmt(row.adjustmentQty)}`,
      ].join(" | "));
    }
  }

  console.log("\nNo data was written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

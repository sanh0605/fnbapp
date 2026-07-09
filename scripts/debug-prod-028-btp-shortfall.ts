import * as dotenv from "dotenv";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "../lib/inventory-consumption";
import {
  computeMacCostForConsumptionRows,
  computeMacCostFromUnitCosts,
  getMacUnitCost,
  getMacUnitCostWithRecipeFallback,
  type MacLedgerEntry,
} from "../lib/mac-cogs";
import { parseLineRecipeSnapshot } from "../lib/order-types";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TARGET_LINE_IDS = [
  "ol-08bbc0ba-6f00-4aa4-a71c-cec7e96ff08e",
  "ol-35ef2d85-9c6b-42e6-a94b-ca822e384423",
];

const ALL_ACTIVE_LINE_IDS = [
  "ol-35ef2d85-9c6b-42e6-a94b-ca822e384423",
  "ol-08bbc0ba-6f00-4aa4-a71c-cec7e96ff08e",
  "ol-db72a765-56c5-4b29-884c-a522cb51eabe",
  "ol-769255d6-4063-46e8-bdd4-8b45108f57d0",
  "ol-11dbf85d-80dc-4ca3-80c0-f54f64563dfe",
  "ol-91b3ca39-dad8-4a2d-b387-f0ad7e6407f3",
  "ol-be44f399-b097-4ccb-a42c-d69e6ef22637",
  "ol-42cc0fcb-2830-4a64-9207-9fac5f763abf",
];

type Row = Record<string, any>;

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, ledger, recipes, semiProducts, products, variants, purchaseOrders] = await Promise.all([
    findAllNoCache("Orders_V2") as Promise<Row[]>,
    findAllNoCache("Order_Lines_V2") as Promise<Row[]>,
    findAllNoCache("Stock_Ledger") as Promise<Row[]>,
    findAllNoCache("Recipes") as Promise<Row[]>,
    findAllNoCache("Semi_Products") as Promise<Row[]>,
    findAllNoCache("Products") as Promise<Row[]>,
    findAllNoCache("Product_Variants") as Promise<Row[]>,
    findAllNoCache("Purchase_Orders") as Promise<Row[]>,
  ]);

  const product = products.find(row => row.id === "PROD-028");
  const productVariants = variants.filter(row => row.product_id === "PROD-028");
  console.log("=== PROD-028 BTP_SHORTFALL DEBUG (READ ONLY) ===");
  console.log(`Product: ${product?.id} | ${product?.name || ""} | status=${product?.status || ""}`);
  console.log(`Variants: ${productVariants.map(row => `${row.id}:${row.size_name}:${row.status}`).join(", ")}`);

  const activeLines = lines.filter(line => ALL_ACTIVE_LINE_IDS.includes(line.id));
  const activeOrders = activeLines
    .map(line => orders.find(order => order.id === line.order_id))
    .filter(Boolean) as Row[];
  console.log("\nActive drift lines");
  for (const line of activeLines) {
    const order = orders.find(row => row.id === line.order_id);
    console.log(`${order?.order_no} | line=${line.id} | created=${order?.created_at} | qty=${line.qty} | stored=${line.cost_at_sale}`);
  }
  console.log(`Earliest active drift order: ${minDate(activeOrders.map(order => order.created_at))}`);

  const allProd028Lines = lines.filter(line => line.product_id === "PROD-028");
  const allProd028Orders = allProd028Lines
    .map(line => orders.find(order => order.id === line.order_id))
    .filter(Boolean) as Row[];
  console.log(`First PROD-028 sale: ${minDate(allProd028Orders.map(order => order.created_at))}`);
  console.log(`PROD-028 sold lines observed: ${allProd028Lines.length}`);

  const consumptionMaps = buildSemiProductRecipeMaps(recipes, semiProducts);
  console.log("\nCurrent semi-product recipe coverage");
  for (const line of activeLines.slice(0, 1)) {
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    for (const ingredient of recipe.variant.ingredients) {
      if (ingredient.ingredient_type !== "SEMI_PRODUCT") continue;
      const semiProduct = semiProducts.find(row => row.id === ingredient.ingredient_id);
      const recipeRows = consumptionMaps.semiProductRecipes.get(ingredient.ingredient_id) || [];
      console.log(
        `${ingredient.ingredient_id} | ${semiProduct?.name || ""} | lineQty=${ingredient.quantity} | batchYield=${consumptionMaps.semiProductYields.get(ingredient.ingredient_id)} | recipeRows=${recipeRows.length}`,
      );
      for (const row of recipeRows) {
        console.log(`  ${row.ingredient_type} ${row.ingredient_id} qty=${row.quantity}`);
      }
    }
  }

  for (const lineId of TARGET_LINE_IDS) {
    traceLine({
      lineId,
      orders,
      lines,
      ledger,
      recipes,
      semiProducts,
      purchaseOrders,
    });
  }

  console.log("\nNo database rows were written.");
}

function traceLine(input: {
  lineId: string;
  orders: Row[];
  lines: Row[];
  ledger: Row[];
  recipes: Row[];
  semiProducts: Row[];
  purchaseOrders: Row[];
}): void {
  const line = input.lines.find(row => row.id === input.lineId);
  if (!line) throw new Error(`Line not found: ${input.lineId}`);
  const order = input.orders.find(row => row.id === line.order_id);
  if (!order) throw new Error(`Order not found for line: ${input.lineId}`);

  const saleTime = order.created_at || line.created_at;
  const ledgerBeforeOrder = input.ledger
    .filter(row => new Date(row.created_at || 0).getTime() <= new Date(saleTime).getTime())
    .filter(row => row.reference_id !== order.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const actualLedgerRows = input.ledger
    .filter(row => row.reference_id === order.id)
    .sort((a, b) => String(a.item_reference).localeCompare(String(b.item_reference)));
  const consumptionMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts);
  const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
  const balances = buildInventoryBalances(ledgerBeforeOrder, saleTime);
  const replayRows = buildLineConsumptionRows(lineRecipe, Number(line.qty || 0), new Map(balances), consumptionMaps);
  const compactUnitCosts = buildCompactMacUnitCosts(ledgerBeforeOrder, saleTime);

  const stored = Number(line.cost_at_sale || 0);
  const fullReplayCost = computeMacCostForConsumptionRows(
    replayRows,
    ledgerBeforeOrder as MacLedgerEntry[],
    saleTime,
    consumptionMaps,
  );
  const compactReplayCost = computeMacCostFromUnitCosts(
    replayRows,
    compactUnitCosts,
    consumptionMaps,
  );

  console.log(`\n=== Trace ${order.order_no} / ${line.id} ===`);
  console.log(`saleTime=${saleTime} product=${line.product_id} variant=${line.variant_id} qty=${line.qty}`);
  console.log(`stored=${stored} fullLedgerReplay=${fullReplayCost} compactReplay=${compactReplayCost}`);
  console.log(`delta(full-stored)=${fullReplayCost - stored} delta(compact-stored)=${compactReplayCost - stored}`);
  const withoutPo051 = ledgerBeforeOrder.filter(row => row.reference_id !== "PO-051");
  const withoutPo051Rows = buildLineConsumptionRows(
    lineRecipe,
    Number(line.qty || 0),
    buildInventoryBalances(withoutPo051, saleTime),
    consumptionMaps,
  );
  const withoutPo051Cost = computeMacCostForConsumptionRows(
    withoutPo051Rows,
    withoutPo051 as MacLedgerEntry[],
    saleTime,
    consumptionMaps,
  );
  console.log(`replayWithoutPO051=${withoutPo051Cost} delta(withoutPO051-stored)=${withoutPo051Cost - stored}`);

  console.log("\nReplay consumption rows");
  printRows(replayRows, ledgerBeforeOrder as MacLedgerEntry[], saleTime, compactUnitCosts, consumptionMaps);

  console.log("\nActual order stock ledger rows");
  for (const row of actualLedgerRows) {
    console.log(
      `${row.item_reference} | qty=${row.quantity_change} | source=${row.source || ""} | unit_cost=${row.unit_cost || 0} | cost_at_sale=${row.cost_at_sale || 0}`,
    );
  }

  console.log("\nLedger vs replay quantity comparison");
  const actualByKey = aggregateLedger(actualLedgerRows);
  const replayByKey = aggregateReplay(replayRows);
  for (const key of Array.from(new Set([...actualByKey.keys(), ...replayByKey.keys()])).sort()) {
    console.log(`${key} | actual=${actualByKey.get(key) || 0} | replay=${replayByKey.get(key) || 0}`);
  }

  const btpRows = replayRows.filter(row => row.source.includes("BTP_SHORTFALL"));
  console.log("\nBTP shortfall contribution");
  let total = 0;
  for (const row of btpRows) {
    const unitCost = getMacUnitCostWithRecipeFallback(
      row.item_reference,
      ledgerBeforeOrder as MacLedgerEntry[],
      saleTime,
      consumptionMaps,
    );
    const cost = unitCost * row.quantity;
    total += cost;
    console.log(`${row.item_reference} qty=${row.quantity} unitCost=${unitCost} rawCost=${cost}`);
  }
  console.log(`BTP shortfall rounded contribution=${Math.round(total)}`);

  console.log("\nNNL-007 MAC input timeline near sale");
  const relevant = (input.ledger as MacLedgerEntry[])
    .filter(row => row.item_reference === "NNL-007")
    .filter(row => Math.abs(new Date(row.created_at || 0).getTime() - new Date(saleTime).getTime()) <= 14 * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  for (const row of relevant) {
    const marker = new Date(row.created_at || 0).getTime() <= new Date(saleTime).getTime() ? "<=sale" : ">sale";
    console.log(
      `${marker} ${row.created_at} | ${row.transaction_type} | qty=${row.quantity_change} | unit=${row.unit_cost || 0} | ref=${row.reference_id || ""}`,
    );
  }
  const po051 = input.purchaseOrders.find(row => row.id === "PO-051");
  if (po051) {
    console.log(
      `PO-051 metadata: transaction_date=${po051.transaction_date || ""} created_at=${po051.created_at || ""} updated_at=${po051.updated_at || ""} status=${po051.status || ""}`,
    );
  }
}

function printRows(
  rows: ConsumptionRow[],
  ledger: MacLedgerEntry[],
  saleTime: string,
  compactUnitCosts: Map<string, number>,
  consumptionMaps: ReturnType<typeof buildSemiProductRecipeMaps>,
): void {
  for (const row of rows) {
    const fullUnitCost = getMacUnitCostWithRecipeFallback(row.item_reference, ledger, saleTime, consumptionMaps);
    const directUnitCost = getMacUnitCost(ledger, row.item_reference, saleTime);
    const compactUnitCost = compactUnitCosts.get(row.item_reference) || 0;
    console.log(
      `${row.item_reference} | qty=${row.quantity} | source=${row.source} | fullUnit=${fullUnitCost} | directUnit=${directUnitCost} | compactUnit=${compactUnitCost} | fullCost=${fullUnitCost * row.quantity}`,
    );
  }
}

function buildCompactMacUnitCosts(ledger: Row[], saleTime: string): Map<string, number> {
  const asOfMs = new Date(saleTime).getTime();
  const rows = [...ledger].sort((a, b) => {
    const byDate = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    if (byDate !== 0) return byDate;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  const quantities = new Map<string, number>();
  const values = new Map<string, number>();
  const unitCosts = new Map<string, number>();

  for (const row of rows) {
    const at = new Date(row.created_at || 0).getTime();
    if (Number.isFinite(asOfMs) && at > asOfMs) continue;
    const item = String(row.item_reference || "");
    if (!item) continue;
    const qty = Number(row.quantity_change || 0);
    const unitCost = Number(row.unit_cost || 0);
    let macQty = quantities.get(item) || 0;
    let macValue = values.get(item) || 0;
    let latestMac = unitCosts.get(item) || 0;

    if (["PO_RECEIPT", "STOCK_ADJUST", "PRODUCTION_YIELD"].includes(row.transaction_type || "") && qty > 0 && unitCost > 0) {
      macQty += qty;
      macValue += qty * unitCost;
      latestMac = macValue / macQty;
      quantities.set(item, macQty);
      values.set(item, macValue);
      unitCosts.set(item, latestMac);
      continue;
    }

    if (qty < 0 && macQty > 0) {
      const consumeQty = Math.min(macQty, Math.abs(qty));
      macQty -= consumeQty;
      macValue -= consumeQty * latestMac;
      if (macQty === 0) macValue = 0;
      quantities.set(item, macQty);
      values.set(item, macValue);
    }
  }

  return unitCosts;
}

function aggregateLedger(rows: Row[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.item_reference}\u0000${row.source || ""}`;
    map.set(key, (map.get(key) || 0) + Math.abs(Number(row.quantity_change || 0)));
  }
  return map;
}

function aggregateReplay(rows: ConsumptionRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.item_reference}\u0000${row.source || ""}`;
    map.set(key, (map.get(key) || 0) + row.quantity);
  }
  return map;
}

function minDate(values: string[]): string {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || "";
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

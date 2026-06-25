import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const START = "2026-05-31T17:00:00.000Z";
const END = "2026-06-25T16:59:59.999Z";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const activeOrders = (orders as any[]).filter(order => {
    if (order.status !== "COMPLETED" || order.superseded_by) return false;
    const t = new Date(order.created_at || 0).getTime();
    return t >= new Date(START).getTime() && t <= new Date(END).getTime();
  });
  const orderById = new Map(activeOrders.map(order => [order.id, order]));
  const targetLines = (lines as any[]).filter(line => {
    if (!orderById.has(line.order_id)) return false;
    const mods = parseJson(line.modifiers_snapshot_json, []);
    return Array.isArray(mods) && mods.some((mod: any) =>
      String(mod.name || "").toLowerCase().includes("đào miếng"),
    );
  });

  console.log("=== DAO MIENG REPORT COGS AUDIT ===");
  console.log(`Orders in range: ${activeOrders.length}`);
  console.log(`Lines with Đào miếng: ${targetLines.length}`);

  let revenue = 0;
  let storedLineCogs = 0;
  let modifierRecipeCount = 0;
  let modifierIngredientCount = 0;

  for (const line of targetLines) {
    const order = orderById.get(line.order_id);
    const mods = parseJson(line.modifiers_snapshot_json, []);
    const recipe = parseJson(line.recipe_snapshot_json, { modifiers: [] });
    const daoMods = mods.filter((mod: any) =>
      String(mod.name || "").toLowerCase().includes("đào miếng"),
    );
    const daoRecipeMods = Array.isArray(recipe.modifiers)
      ? recipe.modifiers.filter((mod: any) =>
          String(mod.modifier_name || "").toLowerCase().includes("đào miếng") ||
          daoMods.some((snapshot: any) => snapshot.id === mod.modifier_id),
        )
      : [];

    revenue += daoMods.reduce((sum: number, mod: any) => sum + Number(mod.price || 0) * Number(mod.qty || 1) * Number(line.qty || 0), 0);
    storedLineCogs += Number(line.cost_at_sale || 0);
    modifierRecipeCount += daoRecipeMods.length;
    modifierIngredientCount += daoRecipeMods.reduce((sum: number, mod: any) => sum + (mod.recipe?.ingredients?.length || 0), 0);

    console.log(`\n${order?.order_no} | line=${line.id} | line_qty=${line.qty} | line_cogs=${line.cost_at_sale}`);
    console.log(`  modifiers=${daoMods.map((mod: any) => `${mod.id}:${mod.name} x${mod.qty || 1} @${mod.price || 0}`).join("; ")}`);
    console.log(`  recipe_modifiers=${daoRecipeMods.length}`);
    for (const mod of daoRecipeMods) {
      console.log(`    ${mod.modifier_id}:${mod.modifier_name} qty=${mod.modifier_qty || 1}`);
      for (const ing of mod.recipe?.ingredients || []) {
        console.log(`      ing=${ing.ingredient_id} type=${ing.ingredient_type} qty=${ing.quantity}`);
      }
    }
  }

  const daoLedger = (ledger as any[]).filter(row =>
    String(row.item_reference || "").includes("ING-017") ||
    String(row.item_reference || "").includes("ING-018"),
  );

  console.log("\nSummary:");
  console.log(`Revenue from Đào miếng snapshots: ${revenue}`);
  console.log(`Stored line COGS on lines containing Đào miếng: ${storedLineCogs}`);
  console.log(`Modifier recipe entries found: ${modifierRecipeCount}`);
  console.log(`Modifier recipe ingredients found: ${modifierIngredientCount}`);
  console.log(`Sample dao ledger rows by likely IDs: ${daoLedger.length}`);
  console.log("\nNo data was written.");
}

function parseJson(value: string, fallback: any) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});

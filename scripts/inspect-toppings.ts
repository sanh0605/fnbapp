process.env.CLI_MODE = "true";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [recipes, modifiers] = await Promise.all([
    findAllNoCache("Recipes"),
    findAllNoCache("Modifiers"),
  ]);

  console.log(`Recipes total: ${recipes.length}`);
  const byType: Record<string, number> = {};
  for (const r of recipes as any[]) {
    const t = String(r.target_type || "(none)");
    byType[t] = (byType[t] || 0) + 1;
  }
  console.log("By target_type:", byType);

  console.log("\n=== Sample MODIFIER recipe (for MOD-001 if exists) ===");
  const mod1Recipe = (recipes as any[]).find(
    (r) => r.target_type === "MODIFIER" && r.target_id === "MOD-001",
  );
  if (mod1Recipe) {
    console.log(JSON.stringify(mod1Recipe, null, 2));
  } else {
    console.log("No recipe found for MOD-001. Showing any MODIFIER recipe:");
    const anyMod = (recipes as any[]).find((r) => r.target_type === "MODIFIER");
    if (anyMod) console.log(JSON.stringify(anyMod, null, 2));
  }

  console.log("\n=== Sample PRODUCT_VARIANT recipe ===");
  const anyVar = (recipes as any[]).find((r) => r.target_type === "PRODUCT_VARIANT");
  if (anyVar) console.log(JSON.stringify(anyVar, null, 2));

  console.log("\n=== All 7 active target topping modifiers ===");
  const targetMods = ["MOD-001", "MOD-002", "MOD-003", "MOD-004", "MOD-005", "MOD-006", "MOD-008"];
  for (const mid of targetMods) {
    const m = (modifiers as any[]).find((x) => String(x.id) === mid);
    const r = (recipes as any[]).find(
      (x) => x.target_type === "MODIFIER" && String(x.target_id) === mid,
    );
    console.log(`  ${mid} | ${m?.name || "(missing)"} | price=${m?.price} | recipe=${r ? "yes" : "NO"}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

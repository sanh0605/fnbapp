import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only: maps item codes (base ingredient / semi-product ids) to their
 * human-readable names, so mismatch reports can be read without needing to
 * look up each code manually.
 */

async function main() {
  const codes = process.argv.slice(2);
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [baseIngredients, semiProducts] = await Promise.all([
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  if (codes.length === 0) {
    console.log("Base_Ingredients sample:", JSON.stringify(baseIngredients[0]));
    console.log("Semi_Products sample:", JSON.stringify(semiProducts[0]));
    return;
  }

  for (const code of codes) {
    const bi = (baseIngredients as any[]).find(i => i.id === code);
    const sp = (semiProducts as any[]).find(i => i.id === code);
    if (bi) console.log(`${code} -> [Base Ingredient] ${bi.name}`);
    else if (sp) console.log(`${code} -> [Semi Product] ${sp.name}`);
    else console.log(`${code} -> (not found)`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

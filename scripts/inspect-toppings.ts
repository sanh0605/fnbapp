process.env.CLI_MODE = "true";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [products, categories, brands] = await Promise.all([
    findAllNoCache("Products"),
    findAllNoCache("Product_Categories"),
    findAllNoCache("Brands"),
  ]);

  console.log("=== Brands ===");
  for (const b of brands as any[]) {
    console.log(`  ${b.id} | ${b.code} | ${b.name}`);
  }

  console.log("\n=== Product Categories ===");
  for (const c of categories as any[]) {
    console.log(`  ${c.id} | ${c.name} | brand=${c.brand_id || "(none)"} | status=${c.status}`);
  }

  console.log("\n=== Products (first 30) ===");
  for (const p of (products as any[]).slice(0, 30)) {
    console.log(`  ${p.id} | ${p.name} | cat=${p.category_id} | brand=${p.brand_id || "(none)"} | status=${p.status}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

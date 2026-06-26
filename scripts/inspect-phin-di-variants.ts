import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [brands, products, variants] = await Promise.all([
    findAllNoCache("Brands"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
  ]);

  console.log("=== Brands ===");
  for (const b of brands as any[]) {
    console.log(`  ${b.id} | code=${b.code} | name=${b.name}`);
  }

  const variantIds = ["VAR-036", "VAR-037"];
  console.log();
  console.log("=== Target variants ===");
  for (const vid of variantIds) {
    const v = (variants as any[]).find((x) => String(x.id) === vid);
    if (!v) {
      console.log(`  ${vid}: NOT FOUND`);
      continue;
    }
    const p = (products as any[]).find((x) => String(x.id) === String(v.product_id));
    const b = p ? (brands as any[]).find((x) => String(x.id) === String(p.brand_id)) : null;
    console.log(`  ${vid}: variant_size=${v.size_name}, variant_price=${v.price}`);
    console.log(`    product_id=${v.product_id}, product_name=${p?.name}, product_brand_id=${p?.brand_id}`);
    console.log(`    brand=${b ? `${b.code} / ${b.name}` : "(not found)"}`);
  }

  console.log();
  console.log("=== Raw product objects ===");
  for (const vid of variantIds) {
    const v = (variants as any[]).find((x) => String(x.id) === vid);
    if (!v) continue;
    const p = (products as any[]).find((x) => String(x.id) === String(v.product_id));
    console.log(`${vid} ->`, JSON.stringify(p, null, 2));
  }
  console.log();
  console.log("=== Raw variant objects ===");
  for (const vid of variantIds) {
    const v = (variants as any[]).find((x) => String(x.id) === vid);
    console.log(`${vid} ->`, JSON.stringify(v, null, 2));
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

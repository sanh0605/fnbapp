/**
 * Setup standalone topping sales.
 *
 * For each of 7 active topping Modifiers, create a corresponding
 * Product + Variant + Recipe so the topping can be sold standalone
 * in POS (no drink required).
 *
 * Approach A per docs/superpowers/specs/2026-06-27-topping-standalone-design.md:
 *   - New category CAT-007 "Topping"
 *   - 1 Product per topping (PROD-029..035)
 *   - 1 Variant per product (VAR-038..044), size_name="1 phần"
 *   - 1 Recipe per variant (copy of modifier's recipe)
 *
 * Idempotency: detect existing setup via Product.name + category_id=CAT-007.
 * Re-running is safe; toggling a Product's status (via admin UI) does NOT
 * trigger re-creation.
 *
 * Usage:
 *   vite-node scripts/setup-topping-standalone.ts            # dry-run (default)
 *   vite-node scripts/setup-topping-standalone.ts --apply    # write to Google Sheets
 *
 * Risk boundary: engine/data write. Codex review required before --apply.
 */

if (typeof window === "undefined") {
  process.env.TZ = "Asia/Ho_Chi_Minh";
}
process.env.CLI_MODE = "true";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import crypto from "node:crypto";

const TARGET_MOD_IDS = ["MOD-001", "MOD-002", "MOD-003", "MOD-004", "MOD-005", "MOD-006", "MOD-008"];
const TOPPING_CATEGORY_ID = "CAT-007";
const TOPPING_CATEGORY_NAME = "Topping";
const SIZE_NAME = "1 phần";
const IDEMPOTENCY_TAG_PREFIX = "topping-standalone::";

interface Plan {
  categoryNeeded: boolean;
  categoryId: string;
  categoryName: string;
  toppings: Array<{
    modifier: any;
    recipe: any | null;
    product: any;
    variant: any;
    newRecipe: any;
    alreadyExists: boolean;
    existingProductId?: string;
  }>;
}

function padNum(prefix: string, n: number, width: number): string {
  return `${prefix}${n.toString().padStart(width, "0")}`;
}

/**
 * Allocator that tracks in-memory state so successive calls return
 * successive IDs (the sheet-level max+1 approach would return the
 * same id for every call within a single script run).
 */
class IdAllocator {
  private counters: Map<string, number> = new Map();
  constructor(initial: Map<string, number>) {
    for (const [k, v] of initial) this.counters.set(k, v);
  }
  next(prefix: string, width: number): string {
    const cur = this.counters.get(prefix) || 0;
    const next = cur + 1;
    this.counters.set(prefix, next);
    return padNum(prefix, next, width);
  }
}

function buildAllocator(
  rows: { id: string }[],
  prefixes: { prefix: string; width: number }[],
): IdAllocator {
  const maxByPrefix = new Map<string, number>();
  for (const { prefix } of prefixes) maxByPrefix.set(prefix, 0);
  for (const row of rows) {
    const id = String(row.id || "");
    for (const { prefix } of prefixes) {
      if (!id.startsWith(prefix)) continue;
      const num = parseInt(id.replace(prefix, ""), 10);
      if (!isNaN(num) && num > (maxByPrefix.get(prefix) || 0)) {
        maxByPrefix.set(prefix, num);
      }
    }
  }
  return new IdAllocator(maxByPrefix);
}

async function main() {
  const applyMode = process.argv.includes("--apply");
  console.log(`=== Setup Topping Standalone ===`);
  console.log(`Mode: ${applyMode ? "APPLY (will write to Google Sheets)" : "DRY-RUN (read-only)"}`);
  console.log();

  const { findAllNoCache, insert } = await import("../lib/sheets_db");
  const [categories, products, variants, recipes, modifiers] = await Promise.all([
    findAllNoCache("Product_Categories"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Recipes"),
    findAllNoCache("Modifiers"),
  ]);

  // Validate target modifiers exist + capture their recipes
  console.log("Target modifiers:");
  const targets: Array<{ modifier: any; recipe: any | null }> = [];
  for (const mid of TARGET_MOD_IDS) {
    const m = (modifiers as any[]).find((x) => String(x.id) === mid);
    if (!m) {
      console.error(`FAIL: Modifier ${mid} not found.`);
      process.exit(1);
    }
    const r = (recipes as any[])
      .filter((x) => x.target_type === "MODIFIER" && String(x.target_id) === mid)
      .sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )[0];
    targets.push({ modifier: m, recipe: r || null });
    console.log(`  ${mid} | ${m.name} | price=${m.price} | recipe=${r ? r.id : "(none)"}`);
  }

  // Check / plan category
  const existingCat = (categories as any[]).find(
    (c) => String(c.id) === TOPPING_CATEGORY_ID || String(c.name).toLowerCase() === TOPPING_CATEGORY_NAME.toLowerCase(),
  );
  const categoryId = String(existingCat?.id || TOPPING_CATEGORY_ID);
  const categoryNeeded = !existingCat;
  console.log();
  console.log(`Category: ${TOPPING_CATEGORY_NAME} (id=${categoryId})`);
  console.log(`  ${existingCat ? `exists, status=${existingCat.status}` : "WILL CREATE"}`);

  // Plan each topping
  console.log();
  console.log(`Planning ${targets.length} standalone toppings...`);
  const productAlloc = buildAllocator(products as any[], [{ prefix: "PROD-", width: 3 }]);
  const variantAlloc = buildAllocator(variants as any[], [{ prefix: "VAR-", width: 3 }]);
  const recipeAlloc = buildAllocator(recipes as any[], [
    { prefix: "REC-", width: 3 },
    { prefix: "RC-", width: 3 },
  ]);
  const plan: Plan["toppings"] = [];
  for (let i = 0; i < targets.length; i++) {
    const { modifier, recipe } = targets[i];
    const modId = String(modifier.id);
    const expectedName = String(modifier.name);

    // Idempotency: check by name + category
    const existing = (products as any[]).find(
      (p) => String(p.category_id) === categoryId && String(p.name) === expectedName,
    );

    if (existing) {
      // Find variant + recipe for completeness
      const existingVariant = (variants as any[]).find(
        (v) => String(v.product_id) === String(existing.id),
      );
      const existingRecipe = (recipes as any[]).find(
        (r) => r.target_type === "PRODUCT_VARIANT" &&
          String(r.target_id) === String(existingVariant?.id || ""),
      );
      plan.push({
        modifier,
        recipe,
        product: existing,
        variant: existingVariant,
        newRecipe: existingRecipe,
        alreadyExists: true,
        existingProductId: String(existing.id),
      });
      console.log(`  ${modId} → ${expectedName}: EXISTS (PROD=${existing.id}, status=${existing.status})`);
      continue;
    }

    // Plan creation
    const newProductId = productAlloc.next("PROD-", 3);
    const newVariantId = variantAlloc.next("VAR-", 3);
    const newRecipeId = recipeAlloc.next("REC-", 3);

    const now = new Date().toISOString();
    const newProduct = {
      id: newProductId,
      category_id: categoryId,
      name: expectedName,
      image_url: "",
      status: "ACTIVE",
      created_at: now,
      color: "",
      brand_id: "",
      migration_notes: `${IDEMPOTENCY_TAG_PREFIX}mod_id=${modId}`,
    };
    const newVariant = {
      id: newVariantId,
      product_id: newProductId,
      size_name: SIZE_NAME,
      price: String(modifier.price),
      status: "ACTIVE",
      created_at: now,
    };
    const newRecipe = {
      id: newRecipeId,
      target_type: "PRODUCT_VARIANT",
      target_id: newVariantId,
      ingredients_json: recipe?.ingredients_json || "[]",
      created_at: now,
      end_date: "",
    };

    plan.push({
      modifier,
      recipe,
      product: newProduct,
      variant: newVariant,
      newRecipe,
      alreadyExists: false,
    });
    console.log(
      `  ${modId} → ${expectedName}: WILL CREATE ${newProductId} / ${newVariantId} / ${newRecipeId} (price=${modifier.price})`,
    );
  }

  const toCreate = plan.filter((p) => !p.alreadyExists);
  console.log();
  console.log(`=== Plan Summary ===`);
  console.log(`Category: ${categoryNeeded ? "CREATE" : "exists"}`);
  console.log(`Toppings to create: ${toCreate.length}/${plan.length}`);
  console.log(`Toppings already set up: ${plan.length - toCreate.length}`);

  if (toCreate.length === 0 && !categoryNeeded) {
    console.log();
    console.log("Nothing to do. All target toppings already set up.");
    return;
  }

  if (!applyMode) {
    console.log();
    console.log(`DRY-RUN complete. To apply, run with --apply flag.`);
    return;
  }

  // APPLY
  console.log();
  console.log(`=== APPLY ===`);
  if (categoryNeeded) {
    const now = new Date().toISOString();
    const newCategory = {
      id: categoryId,
      name: TOPPING_CATEGORY_NAME,
      brand_id: "",
      status: "ACTIVE",
      created_at: now,
    };
    console.log(`Creating category ${categoryId} (${TOPPING_CATEGORY_NAME})...`);
    await insert("Product_Categories", newCategory);
  }

  let inserted = 0;
  for (const p of plan) {
    if (p.alreadyExists) continue;
    console.log(
      `  Inserting ${p.product.id} (${p.product.name}) + variant + recipe...`,
    );
    await insert("Products", p.product);
    await insert("Product_Variants", p.variant);
    await insert("Recipes", p.newRecipe);
    inserted++;
  }

  console.log();
  console.log(`Done. Inserted ${inserted} standalone toppings.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

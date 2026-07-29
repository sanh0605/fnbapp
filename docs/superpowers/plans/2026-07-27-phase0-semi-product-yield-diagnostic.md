# Phase 0 — Semi-Product Batch-Yield Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a read-only diagnostic that confirms or kills the hypothesis
that wrong `semi_products.batch_yield` values are causing negative raw-ingredient
stock and inflated COGS.

**Architecture:** Follows the established repo split — a pure, fully testable
analysis module in `lib/`, plus a thin I/O wrapper in `scripts/` that loads data
and prints an owner-readable report. Mirrors the existing
`lib/*-audit.ts` + `scripts/audit-*.ts` pairs (`mac-cogs-audit`,
`cogs-drift-audit`, `inventory-balance-audit`).

**Tech Stack:** TypeScript, Vitest (`npm test` → `vitest run`), Supabase read
access via the existing `lib/sheets_db.ts` `findAllNoCache` helper.

**Spec:** `docs/superpowers/specs/2026-07-27-inventory-transparency-design.md`,
section 1.3 (primary candidate) and section 7 (Phase 0).

**Implementer:** Claude Sonnet 5.

## Global Constraints

- **Zero database writes.** No insert, update, upsert, delete, or RPC that
  mutates. The only write permitted is the dated JSON artifact under
  `docs/audits/`, matching existing audit-script convention.
- **No schema changes, no data corrections.** This phase only reports. Fixing
  whatever it finds is a separate spec with separate owner approval.
- **No new dependencies.** Note: the global `CLAUDE.md` prefers Lodash, but
  Lodash is **not** installed in this project (`package.json` dependencies are
  supabase-js, bcryptjs, date-fns, lucide-react, next, next-auth, react,
  react-datepicker, react-dom). Use plain TypeScript. Do not add Lodash for a
  diagnostic.
- **Owner-facing output uses real names, never codes** (`CLAUDE.md` section 7).
  The console report must resolve every ingredient and semi-product id to its
  `name`. Ids may appear only in the JSON artifact.
- **Comments and code in English**; owner-facing console strings in Vietnamese.
- Verification bar: `npx tsc --noEmit` clean, full suite green (804 tests as of
  2026-07-29), before the final commit.

## Domain background the implementer needs

When a sale needs a semi-product that is not in stock, the engine performs
"implicit production" and consumes raw ingredients as:

```
consumed = (cooking_recipe_quantity / batch_yield) * shortfall_quantity
```

(`lib/inventory-consumption.ts:122` and `:130`.)

`batch_yield` comes from `semi_products.batch_yield` — `numeric(12,3) not null
default 1` (migration `0001_init_schema.sql:163`) — with a further `|| 1`
fallback at `lib/inventory-consumption.ts:205`.

`batch_yield` carries **no unit**. It is implicitly expressed in the
semi-product's `base_unit`. Recipe ingredient entries carry only
`ingredient_id`, `ingredient_type`, `quantity` — also **no unit**, implicitly the
ingredient's own base unit. Nothing validates that these implicit units agree.

Consequence: a tea base whose cooking recipe is "40g leaf plus 2000ml water
yields 2000ml of base" must have `batch_yield = 2000`. Entered as `2` (thinking
in litres), every consumption over-consumes raw ingredients by 1000x, silently.

**The decisive signal available without replaying history:** for a beverage base,
the output volume is roughly comparable to the input liquid volume. A recipe
whose largest input quantity is 2000 while `batch_yield` is 2 is a 1000x
mismatch visible from the recipe row alone.

### Relevant table shapes

`semi_products` (migration 0001, line 159): `id text`, `name text`,
`base_unit text references units(id)`, `batch_yield numeric(12,3) not null
default 1`, `status text` in ACTIVE/INACTIVE/DELETED.

`recipes` (migration 0001, line 117): `id text`, `target_type text` in
PRODUCT_VARIANT/SEMI_PRODUCT/MODIFIER, `target_id text`, `ingredients_json jsonb
not null default '[]'`, `start_date timestamptz`, `end_date timestamptz`,
`status text`.

A semi-product's **cooking recipe** is the row with
`target_type = 'SEMI_PRODUCT'` and `target_id = <semi_product.id>`.
Its **consumers** are rows of any target type whose `ingredients_json` contains
an entry with `ingredient_type = 'SEMI_PRODUCT'` and
`ingredient_id = <semi_product.id>`.

## File Structure

| File | Responsibility |
|---|---|
| `lib/semi-product-yield-audit.ts` (create) | Pure analysis. Takes plain arrays in, returns findings out. No I/O, no Supabase, no console. |
| `lib/semi-product-yield-audit.test.ts` (create) | Vitest unit tests for every flag and the implied-consumption arithmetic. |
| `scripts/audit-semi-product-yield.ts` (create) | Thin wrapper: loads tables, calls the analysis, prints a Vietnamese report with real names, writes the JSON artifact. |

---

### Task 1: Analysis module — parsing and the data model

**Files:**
- Create: `lib/semi-product-yield-audit.ts`
- Test: `lib/semi-product-yield-audit.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `parseRecipeIngredients(recipe: RecipeInput): RecipeIngredientInput[]`
  and all exported types below, used by Task 2 and Task 3.

- [ ] **Step 1: Write the failing test**

Create `lib/semi-product-yield-audit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRecipeIngredients } from "./semi-product-yield-audit";

describe("parseRecipeIngredients", () => {
  it("reads an ingredients_json array", () => {
    const result = parseRecipeIngredients({
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      ingredients_json: [{ ingredient_id: "NNL-001", ingredient_type: "BASE_INGREDIENT", quantity: 40 }],
    });
    expect(result).toEqual([
      { ingredient_id: "NNL-001", ingredient_type: "BASE_INGREDIENT", quantity: 40 },
    ]);
  });

  it("reads ingredients_json delivered as a JSON string", () => {
    const result = parseRecipeIngredients({
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      ingredients_json: '[{"ingredient_id":"NNL-001","ingredient_type":"BASE_INGREDIENT","quantity":40}]',
    });
    expect(result).toHaveLength(1);
    expect(result[0].ingredient_id).toBe("NNL-001");
  });

  it("returns an empty array for malformed JSON instead of throwing", () => {
    const result = parseRecipeIngredients({
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      ingredients_json: "not json",
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/semi-product-yield-audit.test.ts`
Expected: FAIL — cannot resolve `./semi-product-yield-audit`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/semi-product-yield-audit.ts`:

```typescript
/**
 * Read-only diagnostic for the semi-product batch-yield hypothesis
 * (docs/superpowers/specs/2026-07-27-inventory-transparency-design.md).
 *
 * batch_yield carries no unit and is only implicitly expressed in the
 * semi-product's base_unit, while recipe quantities are implicitly in each
 * ingredient's own base unit. Nothing in the system validates that these
 * implicit units agree, so a yield entered in the wrong unit silently scales
 * every implicit-production consumption by a power of ten.
 *
 * Pure module: no I/O, no Supabase, no console. Never mutates its inputs.
 */

export interface SemiProductInput {
  id?: string;
  name?: string;
  base_unit?: string | null;
  batch_yield?: string | number | null;
  status?: string | null;
}

export interface RecipeIngredientInput {
  ingredient_id?: string;
  ingredient_type?: string;
  quantity?: string | number;
}

export interface RecipeInput {
  target_type?: string;
  target_id?: string;
  ingredients_json?: RecipeIngredientInput[] | string | null;
  status?: string | null;
}

export function parseRecipeIngredients(recipe: RecipeInput): RecipeIngredientInput[] {
  const raw = recipe.ingredients_json;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Malformed rows must not abort a whole-table diagnostic.
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/semi-product-yield-audit.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/semi-product-yield-audit.ts lib/semi-product-yield-audit.test.ts
git commit -m "Claude-Sonnet feat: semi-product yield audit module scaffold"
```

---

### Task 2: Flag classification and implied-consumption arithmetic

**Files:**
- Modify: `lib/semi-product-yield-audit.ts`
- Test: `lib/semi-product-yield-audit.test.ts`

**Interfaces:**
- Consumes: `parseRecipeIngredients`, `SemiProductInput`, `RecipeInput`,
  `RecipeIngredientInput` from Task 1.
- Produces: `auditSemiProductYields(input: YieldAuditInput): SemiProductYieldFinding[]`,
  the type `YieldFlag`, and the constant `SCALE_SUSPECT_RATIO`, all consumed by
  Task 3.

**Flag definitions.** Evaluated in this precedence order, first match wins:

| Flag | Rule |
|---|---|
| `NO_COOKING_RECIPE` | The semi-product is consumed by at least one recipe but has no `target_type = 'SEMI_PRODUCT'` recipe of its own. The engine then falls into the `recipe.length === 0` branch (`lib/inventory-consumption.ts:101`) and drives the semi-product's own balance negative directly. |
| `YIELD_DEFAULT_1` | `batch_yield` is exactly 1 while the cooking recipe's largest input quantity is greater than 1. Strongly suggests the field was never configured and took its column default. |
| `YIELD_SCALE_SUSPECT` | `largestInputQuantity / batchYield >= SCALE_SUSPECT_RATIO` (100). A power-of-ten unit mismatch. |
| `OK` | None of the above. |

- [ ] **Step 1: Write the failing test**

Append to `lib/semi-product-yield-audit.test.ts`:

```typescript
import { auditSemiProductYields } from "./semi-product-yield-audit";

const teaBase = { id: "BTP-001", name: "Hồng trà", base_unit: "ml", batch_yield: 2000, status: "ACTIVE" };

const cookingRecipe = (yieldTargetId: string) => ({
  target_type: "SEMI_PRODUCT",
  target_id: yieldTargetId,
  status: "ACTIVE",
  ingredients_json: [
    { ingredient_id: "NNL-001", ingredient_type: "BASE_INGREDIENT", quantity: 40 },
    { ingredient_id: "NNL-002", ingredient_type: "BASE_INGREDIENT", quantity: 2000 },
  ],
});

const drinkRecipe = (semiId: string, qty: number) => ({
  target_type: "PRODUCT_VARIANT",
  target_id: "SP-001",
  status: "ACTIVE",
  ingredients_json: [{ ingredient_id: semiId, ingredient_type: "SEMI_PRODUCT", quantity: qty }],
});

describe("auditSemiProductYields", () => {
  it("flags a correctly configured yield as OK", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("OK");
    expect(finding.scaleRatio).toBe(1);
  });

  it("flags an unconfigured yield of exactly 1 as YIELD_DEFAULT_1", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [{ ...teaBase, batch_yield: 1 }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("YIELD_DEFAULT_1");
  });

  it("flags a litres-vs-millilitres mismatch as YIELD_SCALE_SUSPECT", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [{ ...teaBase, batch_yield: 2 }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("YIELD_SCALE_SUSPECT");
    expect(finding.scaleRatio).toBe(1000);
  });

  it("flags a consumed semi-product with no cooking recipe", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("NO_COOKING_RECIPE");
  });

  it("computes implied raw consumption per serving", () => {
    // yield 2 instead of 2000: 40 / 2 * 200 = 4000 units of leaf per drink.
    const [finding] = auditSemiProductYields({
      semiProducts: [{ ...teaBase, batch_yield: 2 }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    const leaf = finding.impliedRawPerServing.find(row => row.ingredientId === "NNL-001");
    expect(leaf?.quantity).toBe(4000);
  });

  it("uses the median consumed quantity when consumers disagree", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [
        cookingRecipe("BTP-001"),
        drinkRecipe("BTP-001", 100),
        drinkRecipe("BTP-001", 200),
        drinkRecipe("BTP-001", 900),
      ],
    });
    expect(finding.typicalConsumedQuantity).toBe(200);
  });

  it("skips semi-products that nothing consumes", () => {
    const findings = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [cookingRecipe("BTP-001")],
    });
    expect(findings).toEqual([]);
  });

  it("ignores DELETED semi-products and non-ACTIVE recipes", () => {
    const findings = auditSemiProductYields({
      semiProducts: [{ ...teaBase, status: "DELETED" }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(findings).toEqual([]);
  });

  it("never mutates its inputs", () => {
    const semiProducts = [Object.freeze({ ...teaBase })];
    const recipes = [Object.freeze(cookingRecipe("BTP-001")), Object.freeze(drinkRecipe("BTP-001", 200))];
    expect(() => auditSemiProductYields({ semiProducts, recipes } as never)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/semi-product-yield-audit.test.ts`
Expected: FAIL — `auditSemiProductYields` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/semi-product-yield-audit.ts`:

```typescript
export type YieldFlag = "NO_COOKING_RECIPE" | "YIELD_DEFAULT_1" | "YIELD_SCALE_SUSPECT" | "OK";

/** A ratio at or above this between largest recipe input and batch yield reads as a unit-scale error. */
export const SCALE_SUSPECT_RATIO = 100;

export interface YieldAuditInput {
  semiProducts: SemiProductInput[];
  recipes: RecipeInput[];
}

export interface SemiProductYieldFinding {
  semiProductId: string;
  semiProductName: string;
  baseUnit: string;
  batchYield: number;
  cookingInputs: Array<{ ingredientId: string; quantity: number }>;
  largestInputQuantity: number;
  scaleRatio: number;
  consumerRecipeCount: number;
  typicalConsumedQuantity: number;
  impliedRawPerServing: Array<{ ingredientId: string; quantity: number }>;
  flag: YieldFlag;
}

function isActive(status: string | null | undefined): boolean {
  return (status || "ACTIVE") === "ACTIVE";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function auditSemiProductYields(input: YieldAuditInput): SemiProductYieldFinding[] {
  const activeRecipes = input.recipes.filter(recipe => isActive(recipe.status));

  const cookingByTarget = new Map<string, RecipeInput>();
  for (const recipe of activeRecipes) {
    if (recipe.target_type === "SEMI_PRODUCT" && recipe.target_id) {
      cookingByTarget.set(recipe.target_id, recipe);
    }
  }

  // Every quantity at which some recipe consumes a given semi-product.
  const consumedQuantities = new Map<string, number[]>();
  for (const recipe of activeRecipes) {
    for (const ingredient of parseRecipeIngredients(recipe)) {
      if (ingredient.ingredient_type !== "SEMI_PRODUCT" || !ingredient.ingredient_id) continue;
      const quantity = Number(ingredient.quantity || 0);
      if (quantity <= 0) continue;
      const bucket = consumedQuantities.get(ingredient.ingredient_id) || [];
      bucket.push(quantity);
      consumedQuantities.set(ingredient.ingredient_id, bucket);
    }
  }

  const findings: SemiProductYieldFinding[] = [];

  for (const semiProduct of input.semiProducts) {
    if (!semiProduct.id || !isActive(semiProduct.status)) continue;

    const quantities = consumedQuantities.get(semiProduct.id);
    // A semi-product nothing consumes cannot trigger implicit production.
    if (!quantities || quantities.length === 0) continue;

    const batchYield = Number(semiProduct.batch_yield) || 1;
    const typicalConsumedQuantity = median(quantities);

    const cookingRecipe = cookingByTarget.get(semiProduct.id);
    const cookingInputs = cookingRecipe
      ? parseRecipeIngredients(cookingRecipe)
          .filter(ingredient => ingredient.ingredient_id && Number(ingredient.quantity || 0) > 0)
          .map(ingredient => ({
            ingredientId: String(ingredient.ingredient_id),
            quantity: Number(ingredient.quantity),
          }))
      : [];

    const largestInputQuantity = cookingInputs.reduce(
      (largest, row) => Math.max(largest, row.quantity),
      0,
    );
    const scaleRatio = batchYield > 0 ? largestInputQuantity / batchYield : 0;

    const impliedRawPerServing = cookingInputs.map(row => ({
      ingredientId: row.ingredientId,
      quantity: (row.quantity / batchYield) * typicalConsumedQuantity,
    }));

    let flag: YieldFlag = "OK";
    if (!cookingRecipe) {
      flag = "NO_COOKING_RECIPE";
    } else if (batchYield === 1 && largestInputQuantity > 1) {
      flag = "YIELD_DEFAULT_1";
    } else if (scaleRatio >= SCALE_SUSPECT_RATIO) {
      flag = "YIELD_SCALE_SUSPECT";
    }

    findings.push({
      semiProductId: semiProduct.id,
      semiProductName: semiProduct.name || semiProduct.id,
      baseUnit: semiProduct.base_unit || "",
      batchYield,
      cookingInputs,
      largestInputQuantity,
      scaleRatio,
      consumerRecipeCount: quantities.length,
      typicalConsumedQuantity,
      impliedRawPerServing,
      flag,
    });
  }

  // Most suspicious first, so the owner reads the real problems at the top.
  const order: Record<YieldFlag, number> = {
    NO_COOKING_RECIPE: 0,
    YIELD_DEFAULT_1: 1,
    YIELD_SCALE_SUSPECT: 2,
    OK: 3,
  };
  return findings.sort(
    (a, b) => order[a.flag] - order[b.flag] || b.scaleRatio - a.scaleRatio,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/semi-product-yield-audit.test.ts`
Expected: PASS, 12 tests total.

- [ ] **Step 5: Verify types and full suite**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all green, count increased by 12 from the 804 baseline.

- [ ] **Step 6: Commit**

```bash
git add lib/semi-product-yield-audit.ts lib/semi-product-yield-audit.test.ts
git commit -m "Claude-Sonnet feat: classify semi-product batch-yield scale errors"
```

---

### Task 3: Read-only script wrapper and owner report

**Files:**
- Create: `scripts/audit-semi-product-yield.ts`

**Interfaces:**
- Consumes: `auditSemiProductYields`, `SemiProductYieldFinding`, `YieldFlag`
  from Task 2.
- Produces: a console report plus
  `docs/audits/YYYY-MM-DD-semi-product-yield-diagnostic.json`.

Model the wrapper on `scripts/audit-full-history-recompute.ts`: `dotenv` first,
`process.env.CLI_MODE = "true"`, then dynamic `await import` of `lib/` modules
inside `main()`.

- [ ] **Step 1: Write the script**

Create `scripts/audit-semi-product-yield.ts`:

```typescript
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 0 of the inventory transparency plan
 * (docs/superpowers/specs/2026-07-27-inventory-transparency-design.md).
 *
 * Read-only. Confirms or kills the hypothesis that wrong
 * semi_products.batch_yield values are driving raw-ingredient stock negative
 * and inflating COGS. Performs no database writes; the only output artifact is
 * a dated JSON file under docs/audits/, per existing audit-script convention.
 */

const FLAG_LABELS: Record<string, string> = {
  NO_COOKING_RECIPE: "Chưa có công thức nấu",
  YIELD_DEFAULT_1: "Định mức mẻ chưa khai (đang là 1)",
  YIELD_SCALE_SUSPECT: "Nghi sai đơn vị định mức mẻ",
  OK: "Bình thường",
};

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { auditSemiProductYields } = await import("../lib/semi-product-yield-audit");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Đang tải dữ liệu...");
  const [semiProducts, recipes, baseIngredients] = await Promise.all([
    findAllNoCache("Semi_Products"),
    findAllNoCache("Recipes"),
    findAllNoCache("Base_Ingredients"),
  ]);

  // CLAUDE.md section 7: the owner-facing report must use real names, never ids.
  const ingredientNames = new Map<string, string>();
  for (const ingredient of baseIngredients as Array<Record<string, unknown>>) {
    const id = String(ingredient.id || "");
    if (id) ingredientNames.set(id, String(ingredient.name || id));
  }
  for (const semiProduct of semiProducts as Array<Record<string, unknown>>) {
    const id = String(semiProduct.id || "");
    if (id) ingredientNames.set(id, String(semiProduct.name || id));
  }
  const nameOf = (id: string) => ingredientNames.get(id) || id;

  const findings = auditSemiProductYields({
    semiProducts: semiProducts as never,
    recipes: recipes as never,
  });

  const suspicious = findings.filter(finding => finding.flag !== "OK");

  console.log("");
  console.log("=== KIỂM TRA ĐỊNH MỨC MẺ BÁN THÀNH PHẨM ===");
  console.log(`Đã kiểm: ${findings.length} bán thành phẩm đang được dùng trong công thức`);
  console.log(`Nghi có vấn đề: ${suspicious.length}`);
  console.log("");

  for (const finding of findings) {
    const marker = finding.flag === "OK" ? "   " : ">> ";
    console.log(`${marker}${finding.semiProductName} (${FLAG_LABELS[finding.flag]})`);
    console.log(`      Đơn vị gốc: ${finding.baseUnit || "chưa khai"} | Định mức mẻ đang khai: ${finding.batchYield}`);

    if (finding.cookingInputs.length > 0) {
      const inputs = finding.cookingInputs
        .map(row => `${nameOf(row.ingredientId)} ${row.quantity}`)
        .join(", ");
      console.log(`      Công thức nấu một mẻ: ${inputs}`);
      console.log(`      Lượng vào lớn nhất / định mức mẻ = ${finding.scaleRatio.toFixed(2)}`);
    } else {
      console.log("      Không tìm thấy công thức nấu cho bán thành phẩm này");
    }

    console.log(`      Mỗi ly dùng khoảng ${finding.typicalConsumedQuantity} ${finding.baseUnit || ""}`.trimEnd());

    if (finding.impliedRawPerServing.length > 0) {
      const implied = finding.impliedRawPerServing
        .map(row => `${nameOf(row.ingredientId)} ${row.quantity.toFixed(2)}`)
        .join(", ");
      console.log(`      => Hệ thống đang trừ mỗi ly: ${implied}`);
    }
    console.log("");
  }

  if (suspicious.length === 0) {
    console.log("Không phát hiện định mức mẻ bất thường. Giả thuyết này bị loại;");
    console.log("chuyển sang Chức năng 2 trong spec để tìm nguyên nhân khác.");
  } else {
    console.log("Đọc dòng '=> Hệ thống đang trừ mỗi ly' của các mục đánh dấu >>.");
    console.log("Nếu con số đó lớn hơn thực tế một cách phi lý, giả thuyết được xác nhận.");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outputPath = path.join("docs", "audits", `${stamp}-semi-product-yield-diagnostic.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));
  console.log("");
  console.log(`Đã ghi chi tiết: ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script contains no write paths**

Run: `npx tsc --noEmit`
Expected: no output.

Then confirm by inspection that the script calls only `findAllNoCache` and
`fs.writeFileSync` to `docs/audits/`. Grep to be sure:

```bash
grep -nE "insert|update|upsert|delete|\.rpc\(" scripts/audit-semi-product-yield.ts
```

Expected: no matches.

- [ ] **Step 3: Run the diagnostic against live data**

Run: `npx vite-node scripts/audit-semi-product-yield.ts`

`vite-node` is this repo's script runner (`devDependencies`). `tsx` appears in
older tracking entries but is **not** installed — do not use it.

Expected: a report listing every semi-product used in recipes, suspicious ones
first, plus the JSON artifact.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-semi-product-yield.ts docs/audits/*-semi-product-yield-diagnostic.json
git commit -m "Claude-Sonnet audit: semi-product batch-yield diagnostic (Phase 0)"
```

---

### Task 4: Report to the owner and update tracking

**Files:**
- Modify: `DEVELOPMENT-TRACKING.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Summarise the finding for the owner**

Write a short summary in Vietnamese using **real product and ingredient names,
never ids** (`CLAUDE.md` section 7). It must answer three questions:

1. How many semi-products carry a suspicious batch yield, and which ones.
2. For each, how much raw ingredient the system currently deducts per drink,
   next to a plainly stated real-world expectation, so the owner can judge.
3. Whether the hypothesis is confirmed, partly confirmed, or dead.

State plainly if the hypothesis is dead. A negative result is a real result: it
eliminates the leading candidate and redirects to Feature 2 of the spec.

- [ ] **Step 2: Append a DEVELOPMENT-TRACKING.md entry**

Follow the existing chronicle format. Record: the trigger (owner-reported
inventory fog, 2026-07-27), what was built, what the live run found, and the
explicit statement that nothing was written to the database.

- [ ] **Step 3: Add the roadmap row**

Add a row for this diagnostic under the current phase in `docs/ROADMAP.md`,
linking both the spec and this plan, with status reflecting the live-run outcome.

- [ ] **Step 4: Commit**

```bash
git add DEVELOPMENT-TRACKING.md docs/ROADMAP.md
git commit -m "Claude-Sonnet docs: log Phase 0 batch-yield diagnostic findings"
```

- [ ] **Step 5: Stop**

Do not correct any yield value, recipe, or ledger row. Corrections require a
separate spec and separate owner approval, per the Global Constraints.

---

## What happens after this plan

- **Hypothesis confirmed** → write the correction spec: fix the wrong yields, add
  a validation rule tying `batch_yield` to `base_unit`, then recompute affected
  history. Every step rewrites financial records and needs owner approval and a
  rollback path.
- **Hypothesis dead** → proceed to Feature 2 of the spec (owner-run
  reconciliation with negative-cause classification), which is the fallback route
  to the real cause.

Either way, Features 1 and 2 of the spec remain worth building: they are what
lets the owner verify these numbers himself instead of taking an agent's word
for it, which is the underlying problem this whole line of work exists to solve.

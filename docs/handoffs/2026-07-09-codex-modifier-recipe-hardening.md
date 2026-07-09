# Codex Prompt — Modifier recipe save hardening (Phase 1.5)

Date: 2026-07-09
Owner: Codex (Engine Lead)
Priority: 1 (per Codex roadmap)
Estimated effort: ~1-2 hours

## Goal

Apply the same recipe-selection hardening from product recipe save (commit `b0cf0b7`) to the **modifier** recipe save path. Currently modifier saves use unsorted `Array.find` — same bug pattern that was fixed for products.

## Background

Product recipe save was hardened in commit `b0cf0b7` using:
- `findLatestActiveRecipe` helper (`lib/recipe-selection.ts`)
- `planRecipeSave` pure helper
- `canonicalizeIngredients` for stable comparison

The Phase 1 spec (`docs/superpowers/specs/2026-07-04-recipe-selection-hardening-design.md`) explicitly noted:

> "Modifier recipe save and delete paths also contain unsorted open-recipe selection. They require a separate reviewed change because this phase is limited to product-variant recipe selection and audit."

This is that follow-up (Phase 1.5).

## Bug location

`app/admin/products/modifiers/actions.ts:115-122`:

```ts
const allRecipes = await findAll(RECIPE_SHEET);
const existingActive = allRecipes.find(
  (r: DBRecipe) =>
    r.target_type === "MODIFIER" &&
    r.target_id === finalId &&
    (!r.end_date || r.end_date === "")
);
```

**Issue:** `Array.find` returns the FIRST match in iteration order, not the latest by `created_at`. If multiple open recipes exist (data corruption, manual inserts, race conditions), the wrong one is selected — same risk as product recipe bug.

## Fix

Replace the unsorted `find` with the deterministic helpers from `lib/recipe-selection.ts`:

```ts
import {
  findLatestActiveRecipe,
  planRecipeSave,
} from "@/lib/recipe-selection";

// ...

const allRecipes = (await findAll(RECIPE_SHEET)) as DBRecipe[];
const targetRecipes = allRecipes.filter(
  (r) => r.target_type === "MODIFIER" && r.target_id === finalId,
);

const decision = planRecipeSave({
  target_type: "MODIFIER",
  target_id: finalId,
  recipes: targetRecipes,
  submittedIngredients: parsedIngredients, // pass the parsed/normalized modifier ingredients
});

// decision returns: { decision: "CREATE_INITIAL" | "UNCHANGED" | "CREATE_VERSION", activeRecipe, newRecipeCount }
```

Then handle each decision branch:

```ts
switch (decision.decision) {
  case "CREATE_INITIAL":
    // insert new recipe with start_date=nowIso, end_date=null
    break;
  case "UNCHANGED":
    // no-op
    break;
  case "CREATE_VERSION":
    // 1. Close ONLY the latest active recipe (decision.activeRecipe.id)
    await update(RECIPE_SHEET, decision.activeRecipe!.id, { end_date: nowIso });
    // 2. Insert new version
    break;
}
```

## Files

- `app/admin/products/modifiers/actions.ts` (primary)
- May need to extend `lib/recipe-selection.ts` if `planRecipeSave` doesn't accept `MODIFIER` target_type (check first — should work since it's generic on `target_type`)

## Verify `planRecipeSave` compatibility

Before implementing, read `lib/recipe-selection.ts` and check:
1. Is `planRecipeSave` generic on `target_type`? (Should be — it accepts `target_type` param)
2. Does `canonicalizeIngredients` work for modifier ingredients shape? (Modifiers use `{ ingredient_id, ingredient_type, quantity }` — same as products)
3. Are there any product-specific assumptions in the helpers?

If helper needs adjustment for modifier context, refactor it to be truly generic (no behavior change for product callers).

## Tests

Add/extend tests in `lib/recipe-selection.test.ts`:

- `planRecipeSave` with `target_type: "MODIFIER"` and identical ingredients → returns `UNCHANGED`
- `planRecipeSave` with `target_type: "MODIFIER"` and changed ingredients → returns `CREATE_VERSION`
- `planRecipeSave` with `target_type: "MODIFIER"` and no existing active → returns `CREATE_INITIAL`
- `findLatestActiveRecipe` filters by both `target_type` and `target_id`

If modifier ingredients have different validation rules (e.g., required modifiers like "đá" cannot be removed), document them but don't add business rules in the selection helper (keep it pure).

## Verify

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass (add 4-6 new tests for MODIFIER target_type)
3. Manual: open `/admin/products/modifiers`, edit a modifier's recipe, save → verify
   - Same recipe → no new version created (check DB)
   - Changed recipe → exactly 1 new version created, old version closed
   - Existing open recipes are not duplicated

## Commit

Suggested: `Codex fix: harden modifier recipe save with planRecipeSave (Phase 1.5)`

## Out of scope

- Do NOT change product recipe save (already hardened)
- Do NOT change modifier recipe schema
- Do NOT touch the UI (form is fine, this is engine scope)
- Do NOT delete duplicate recipes if found (separate cleanup task)

## Coordination

This task is INDEPENDENT of all UI work. Can be done in parallel with Antigravity's UI consistency task.

# Recipe Selection Hardening and History Audit

Date: 2026-07-04
Status: Approved

## Goal

Prevent product recipe saves from selecting an older open recipe and provide a
read-only audit that distinguishes real ingredient removal from intentional
ingredient-type replacement.

Phase 1 does not modify recipe history data.

## Confirmed Findings

Before 2026-07-01, the product edit form loaded the first matching recipe
without filtering or deterministic ordering. Commit `d23211f` replaced that
read path with `selectEffectiveRecipe`, so `app/admin/products/page.tsx`
already loads the latest effective recipe and requires no production change in
this phase.

The save path in `app/admin/products/actions.ts` still selects an open recipe
with unsorted `Array.find`. This is unsafe if multiple open rows exist or the
input order changes.

The live read-only audit found:

- 49 variants with product-variant recipe history.
- 0 variants with multiple open recipes.
- `REC-062` to `REC-068` for Hồng trà chanh removed Trái chanh entirely.
- `REC-001` to `REC-011` for Cà phê đá replaced BTP-004 with ING-022.
  Both ingredients are named Nước đường and both quantities are 20, so this is
  an intentional type replacement rather than a drop.

## Recipe Selection

Add `findLatestActiveRecipe` to `lib/recipe-selection.ts`.

The helper:

1. Filters by `target_type` and `target_id`.
2. Excludes rows whose status is present and not `ACTIVE`.
3. Keeps only rows with an empty or null `end_date`.
4. Sorts by `created_at` descending.
5. Uses recipe ID descending as the deterministic tie-breaker.

The save path uses this helper instead of unsorted `Array.find`.

`selectEffectiveRecipe` remains the read/as-of API. It is not replaced because
effective historical selection and latest-open selection have different
contracts.

## Save Decision

Add a pure recipe-save decision helper so the write behavior can be tested
without mocking database calls.

Given the latest open recipe and submitted ingredients, it returns:

- `CREATE_INITIAL` when no open recipe exists.
- `UNCHANGED` when normalized ingredients are equivalent.
- `CREATE_VERSION` when normalized ingredients differ.

Ingredient normalization:

- Parses stored JSON when necessary.
- Coerces quantity to a finite number.
- Uses `BASE_INGREDIENT` as the default type.
- Compares rows by `ingredient_type`, `ingredient_id`, and quantity.
- Ignores array order so reordering identical ingredients does not create a
  false version.

The action creates exactly one recipe for `CREATE_INITIAL` or
`CREATE_VERSION`. For `CREATE_VERSION`, it closes only the latest open recipe.
It performs no recipe write for `UNCHANGED`.

## Recipe History Audit

Add a pure audit module and a read-only CLI script:

- `lib/recipe-history-audit.ts`
- `lib/recipe-history-audit.test.ts`
- `scripts/audit-recipe-history.ts`

The script reads Recipes, Product_Variants, Products, Base_Ingredients, and
Semi_Products. It writes only the requested local report:

- `docs/audits/2026-07-04-recipe-audit.md`

It never writes application or ledger data.

### Name-aware transition matching

Ingredient names are normalized with Unicode-aware lowercase conversion,
trimmed whitespace, and collapsed internal whitespace.

For each pair of consecutive product-variant recipes:

1. Match unchanged ingredients by ID and type.
2. Match remaining old/new ingredients by normalized name.
3. Classify same-name, different-ID or different-type pairs as
   `TYPE_REPLACEMENT`.
4. Classify matched ingredients with a different quantity as
   `QUANTITY_CHANGE`.
5. Classify unmatched old ingredient names as `TRUE_DROP`.
6. Record unmatched new ingredients as additions for timeline context.

If a name maps to multiple unmatched ingredients on either side, the
transition is marked ambiguous and requires manual review; it is not silently
classified as a safe replacement.

### Actionable categories

- `MULTIPLE_ACTIVE`: more than one open recipe for a variant.
- `TRUE_DROP`: an ingredient name disappears from the next version.
- `TYPE_REPLACEMENT`: the same ingredient name moves to a different ID or
  ingredient type.
- `QUANTITY_CHANGE`: a matched ingredient changes quantity.

Invalid JSON is reported separately as an audit error and requires manual
review.

Only `MULTIPLE_ACTIVE`, `TRUE_DROP`, invalid JSON, and ambiguous name matching
produce cleanup recommendations. `TYPE_REPLACEMENT` and `QUANTITY_CHANGE`
remain visible but are not automatically treated as corruption.

## Report Content

The Markdown report contains:

- Generation timestamp and read-only statement.
- Counts by audit category.
- Per-variant chronological timeline.
- Ingredient additions, replacements, quantity changes, and true drops between
  consecutive versions.
- Recommended cleanup options without executing them:
  - Option A: keep the latest version and close older open rows.
  - Option B: restore a reviewed historical version as the current recipe and
    close or deactivate the corrupt newer version.
  - Option C: manual review when intent is ambiguous.

Expected current-data result:

- Hồng trà chanh `REC-062` to `REC-068`: `TRUE_DROP` for Trái chanh and cleanup
  recommendation.
- Cà phê đá `REC-001` to `REC-011`: `TYPE_REPLACEMENT` from BTP-004 to ING-022
  for Nước đường; no cleanup recommendation.
- No other variant should receive an automatic cleanup recommendation unless
  the live data changes before the audit runs.

## Verification

TDD coverage must demonstrate:

- Latest open recipe wins regardless of input order.
- Deterministic tie-breaking.
- Identical normalized ingredients produce `UNCHANGED` and zero new entries.
- Changed ingredients produce `CREATE_VERSION` and exactly one new entry.
- BTP-004 to ING-022 with the same name is `TYPE_REPLACEMENT`, not
  `TRUE_DROP`.
- Removing NNL-006 without a same-name replacement is `TRUE_DROP`.
- Multiple open recipes and invalid JSON are reported.

Final gates:

- Audit script completes and produces the expected current-data result.
- Vitest baseline remains at least 266 tests.
- TypeScript reports zero errors.
- Claude reviews the implementation diff before commit.
- No push and no recipe data cleanup in Phase 1.

## Follow-up Outside Phase 1

Modifier recipe save and delete paths also contain unsorted open-recipe
selection. They require a separate reviewed change because this phase is
limited to product-variant recipe selection and audit.

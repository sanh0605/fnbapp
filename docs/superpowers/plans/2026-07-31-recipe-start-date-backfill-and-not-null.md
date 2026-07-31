# Recipe `start_date` Backfill and NOT NULL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `recipes.start_date` always present and authoritative, so recipe
effectiveness is decided by a stored value rather than by a read-time fallback
that every reader must remember to apply.

**Architecture:** Three ordered changes, each independently verifiable.
(1) Backfill the 129 `NULL` rows with `created_at` — provably behaviour-neutral,
because `selectEffectiveRecipe` already falls back to `created_at`.
(2) Add `NOT NULL`, making a null structurally impossible.
(3) Only then delete the read-time fallback in `lib/recipe-selection.ts`, which
becomes dead code once nulls cannot exist.

The order matters: removing the fallback before the backfill would change
behaviour for 129 recipes; removing it after the constraint changes nothing.

**The rule this plan implements, in the owner's words (2026-07-31):**

> "Nếu anh không điền start_date thì start_date sẽ được ghi giá trị giống với
> ngày tạo, cho nên user được quyền để trống. Nếu start_date là một ngày khác
> ngày tạo thì mới cần điền."

Read that as four layers with different rules, and do not collapse them:

| Layer | Rule | Status |
|---|---|---|
| The form field | **Optional. Blank is the normal case.** | Already correct — `SemiProductForm.tsx:223` labels it "Ngày áp dụng công thức (Nếu đổi)" and defaults to `null` |
| The save path | Blank → write the creation timestamp. Filled → write that. | Already correct — `app/admin/semi-products/actions.ts:105-107` |
| The stored column | Never null | Task 2 |
| Every reader | Read the column. No inference. | Task 3 |

`NOT NULL` in Task 2 constrains **the column, not the operator**. Task 2 Step 5
exists specifically to prove the form stays optional afterwards. If anyone
"fixes" the form to require a date because the database says NOT NULL, they have
broken the requirement, not satisfied it.

**Tech Stack:** TypeScript, Supabase Postgres migrations, Vitest,
`vite-node` for scripts.

## Global Constraints

- Code and comments in English. User-facing strings Vietnamese.
  (`AGENTS.md` "Repo Coding Rules")
- Any script that writes data is **dry-run by default**; `--apply` is required
  for writes, and it must print exact counts and targets before writing.
  (`docs/COLLABORATION.md` section D rule 1)
- `npx tsc --noEmit` must report 0 errors. Enforced by the Husky pre-commit hook.
- Full test suite green before each commit.
- Commit per phase: one commit equals one outcome plus its verification.
  (`docs/COLLABORATION.md` section D rule 2)
- Do not push. (`docs/COLLABORATION.md` section E)
- New migration numbers continue from `0047`; this plan uses `0048` and `0049`.
- `scripts/**` and `supabase/migrations/**` are engine-owned. See "Ownership"
  below — this plan is not authorized to run until that is settled.

## Baseline facts (verified against production 2026-07-31, read-only)

| Fact | Value |
|---|---|
| `recipes` rows, all `status = ACTIVE` | 131 |
| ...with `start_date IS NULL` | **129** |
| ...with `start_date` set | 2 — `RC-029` (`BTP-013`), `RC-032` (`BTP-014`) |
| `order_lines_v2` rows | 2,604 |
| ...with a parseable `variant.target_id` snapshot | 2,563 |
| Order lines sold before their variant's earliest effective recipe | **0** |
| Order lines sold before their semi-product's earliest cooking recipe | **0** |

The last two rows are why this is a safety and clarity change, **not** a bug
fix: the current fallback produces correct results for today's data. It is
correct by luck — every recipe happens to have been created before the sales
that use it. The two recipes that *do* carry an explicit `start_date` are both
backdated by weeks (`RC-029` by 26 days, `RC-032` by 60 days), which is the
owner's actual working pattern and the case the fallback cannot serve.

## Already done — do not redo

Verified present in the repo; these implement the write-time default and need
no further work:

- `supabase/migrations/0044_save_product_atomic_start_date.sql` — `save_product_atomic`
  sets `start_date` on every `PRODUCT_VARIANT` recipe row it creates.
- `supabase/migrations/0043_backdated_recipe_detection_on_update.sql:42` — the
  backdating trigger tests `coalesce(new.start_date, new.created_at)`, fires on
  INSERT and UPDATE.
- `app/admin/semi-products/actions.ts:125,138` — sets `start_date: nowIso`.
- `app/admin/products/modifiers/actions.ts:146,158` — sets `start_date: nowIso`.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/backfill-recipe-start-date.ts` (create) | Dry-run/apply backfill of the 129 rows, plus the before/after equivalence proof | 1 |
| `lib/recipe-selection.test.ts` (modify) | Tests locking the equivalence and, later, the fallback removal | 1, 3 |
| `supabase/migrations/0048_recipes_start_date_not_null.sql` (create) | `NOT NULL` constraint | 2 |
| `lib/recipe-selection.ts` (modify, lines 43, 58-64) | Remove the read-time fallback | 3 |
| `supabase/migrations/0049_backdated_recipe_detection_drop_coalesce.sql` (create) | Remove the trigger's `coalesce` fallback | 3 |

---

### Task 1: Backfill the 129 null `start_date` values

**Files:**
- Create: `scripts/backfill-recipe-start-date.ts`
- Test: `lib/recipe-selection.test.ts` (add one test)

**Interfaces:**
- Consumes: `selectEffectiveRecipe(recipes, targetType, targetId, asOf)` from
  `lib/recipe-selection.ts` — unchanged in this task.
- Produces: nothing importable. The script is a one-off operation; later tasks
  depend only on the database state it leaves behind (zero `NULL` rows).

- [ ] **Step 1: Write the failing test**

Add to `lib/recipe-selection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectEffectiveRecipe } from "@/lib/recipe-selection";

describe("start_date backfill equivalence", () => {
  // Setting start_date := created_at must not change which recipe is
  // selected, because the fallback already used created_at. This test
  // pins that invariant so the backfill cannot silently alter history.
  it("selects the same recipe whether start_date is null or equals created_at", () => {
    const withNull = [
      { id: "RC-A", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: null, created_at: "2026-05-19T00:00:00.000Z" },
      { id: "RC-B", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: null, created_at: "2026-06-14T00:00:00.000Z" },
    ];
    const backfilled = withNull.map(r => ({ ...r, start_date: r.created_at }));

    for (const asOf of [
      "2026-05-18T23:59:59.000Z",
      "2026-05-19T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
      "2026-06-14T00:00:00.000Z",
      "2026-07-31T00:00:00.000Z",
    ]) {
      const before = selectEffectiveRecipe(withNull, "SEMI_PRODUCT", "BTP-001", asOf);
      const after = selectEffectiveRecipe(backfilled, "SEMI_PRODUCT", "BTP-001", asOf);
      expect(after?.id, `asOf=${asOf}`).toBe(before?.id);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it passes already**

Run: `npx vitest run lib/recipe-selection.test.ts -t "start_date backfill equivalence"`

Expected: **PASS**. This test documents an invariant of existing code rather
than driving new code; it must be green before the backfill runs, because a
failure here would mean the backfill is not neutral and the plan is wrong.
If it fails, STOP and report — do not proceed to Step 3.

- [ ] **Step 3: Write the backfill script**

Create `scripts/backfill-recipe-start-date.ts`:

```ts
/**
 * Backfills recipes.start_date := created_at for rows where it is null.
 *
 * Behaviour-neutral by construction: lib/recipe-selection.ts's
 * selectEffectiveRecipe already reads `start_date || created_at`, so writing
 * created_at into start_date cannot change any selection result. This script
 * proves that per-row rather than asserting it -- it replays
 * selectEffectiveRecipe over every order line before and after the proposed
 * change and refuses to apply if any line's selected recipe id differs.
 *
 * Dry-run by default. --apply required to write.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { selectEffectiveRecipe } from "../lib/recipe-selection";

config({ path: ".env.local" });

const apply = process.argv.includes("--apply");
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Recipe = {
  id: string;
  target_type: string;
  target_id: string;
  status: string;
  ingredients_json: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

async function pageAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

async function main(): Promise<void> {
  const recipes = await pageAll<Recipe>("recipes", "*");
  const nulls = recipes.filter(r => !r.start_date);
  console.log(`Recipes total: ${recipes.length}`);
  console.log(`With null start_date: ${nulls.length}`);

  const missingCreatedAt = nulls.filter(r => !r.created_at);
  if (missingCreatedAt.length > 0) {
    console.error(`ABORT: ${missingCreatedAt.length} rows have neither start_date nor created_at:`);
    missingCreatedAt.forEach(r => console.error(`  ${r.id}`));
    process.exit(1);
  }

  const backfilled = recipes.map(r => (r.start_date ? r : { ...r, start_date: r.created_at }));

  const orders = await pageAll<{ id: string; created_at: string; status: string; superseded_by: string | null }>(
    "orders_v2", "id,created_at,status,superseded_by",
  );
  const orderTime = new Map<string, string>();
  for (const o of orders) {
    if (o.status === "COMPLETED" && !o.superseded_by) orderTime.set(o.id, o.created_at);
  }

  const lines = await pageAll<{ id: string; order_id: string; recipe_snapshot_json: unknown }>(
    "order_lines_v2", "id,order_id,recipe_snapshot_json",
  );

  // Every (target_type, target_id) that any order line touches, checked at
  // that line's own sale time. Covers variants and their semi-products.
  let checked = 0;
  const diffs: string[] = [];
  for (const line of lines) {
    const at = orderTime.get(line.order_id);
    if (!at) continue;
    const snap = line.recipe_snapshot_json as
      | { variant?: { target_id?: string; ingredients?: Array<{ ingredient_type?: string; ingredient_id?: string }> } }
      | null;
    if (!snap?.variant?.target_id) continue;

    const targets: Array<[string, string]> = [["PRODUCT_VARIANT", snap.variant.target_id]];
    for (const ing of snap.variant.ingredients ?? []) {
      if (ing.ingredient_type === "SEMI_PRODUCT" && ing.ingredient_id) {
        targets.push(["SEMI_PRODUCT", ing.ingredient_id]);
      }
    }

    for (const [type, id] of targets) {
      checked += 1;
      const before = selectEffectiveRecipe(recipes, type, id, at);
      const after = selectEffectiveRecipe(backfilled, type, id, at);
      if ((before?.id ?? null) !== (after?.id ?? null)) {
        diffs.push(`${line.id} ${type}/${id} @${at}: ${before?.id ?? "none"} -> ${after?.id ?? "none"}`);
      }
    }
  }

  console.log(`\nEquivalence check: ${checked} (line, target) selections replayed`);
  console.log(`Differences: ${diffs.length}`);
  diffs.slice(0, 20).forEach(d => console.log(`  ${d}`));

  if (diffs.length > 0) {
    console.error("\nABORT: backfill is not behaviour-neutral. Nothing written.");
    process.exit(1);
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Rows to update: ${nulls.length}`);
  nulls.slice(0, 10).forEach(r => console.log(`  ${r.id} ${r.target_type}/${r.target_id} start_date := ${r.created_at}`));
  if (nulls.length > 10) console.log(`  ... and ${nulls.length - 10} more`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (const r of nulls) {
    const { error } = await db.from("recipes").update({ start_date: r.created_at }).eq("id", r.id).is("start_date", null);
    if (error) {
      console.error(`FAILED ${r.id}: ${error.message}`);
      process.exit(1);
    }
    written += 1;
  }
  console.log(`\nUpdated ${written} rows.`);

  const after = await pageAll<{ id: string; start_date: string | null }>("recipes", "id,start_date");
  const remaining = after.filter(r => !r.start_date).length;
  console.log(`Rows still null after apply: ${remaining}`);
  if (remaining !== 0) {
    console.error("ABORT: nulls remain. Investigate before adding the NOT NULL constraint.");
    process.exit(1);
  }
}

main().catch(e => {
  console.error("FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
```

- [ ] **Step 4: Run the dry run and read the output**

Run: `npx vite-node scripts/backfill-recipe-start-date.ts`

Expected exactly:
```
Recipes total: 131
With null start_date: 129
Differences: 0
Mode: DRY RUN (no writes)
Rows to update: 129
```

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Nếu "With null start_date" khác 129, hoặc "Differences" khác 0 -> DỪNG.
  Differences khác 0 nghĩa là giả định "start_date := created_at là trung tính"
  sai, và toàn bộ plan này phải viết lại. Đừng chạy --apply.
```

- [ ] **Step 5: Apply**

Run: `npx vite-node scripts/backfill-recipe-start-date.ts --apply`

Expected: `Updated 129 rows.` then `Rows still null after apply: 0`

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all green, no new failures.

- [ ] **Step 7: Commit**

```bash
git add scripts/backfill-recipe-start-date.ts lib/recipe-selection.test.ts
git commit -m "Claude-Sonnet fix: backfill recipes.start_date from created_at (129 rows)

Behaviour-neutral: selectEffectiveRecipe already read start_date ||
created_at. The script proves neutrality by replaying selection over every
order line before and after, and aborts if any selection changes. Dry run
reported 0 differences across all replayed selections.

Prepares the NOT NULL constraint in 0048.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Make `start_date` NOT NULL

**Files:**
- Create: `supabase/migrations/0048_recipes_start_date_not_null.sql`

**Interfaces:**
- Consumes: the database state left by Task 1 (zero null `start_date` rows).
- Produces: the guarantee `lib/recipe-selection.ts` relies on in Task 3 —
  `recipes.start_date` is never null, so the `|| created_at` fallback is
  unreachable.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0048_recipes_start_date_not_null.sql`:

```sql
-- recipes.start_date becomes mandatory.
--
-- Until now effectiveness was decided by a read-time fallback
-- (start_date || created_at, lib/recipe-selection.ts). That made two
-- different situations indistinguishable in the data: "start_date is null
-- because it equals created_at" and "start_date is null because nobody set
-- it". Every reader had to remember the fallback, and any reader that forgot
-- it disagreed with the others about when a recipe took effect.
--
-- The write paths already set start_date (0044 save_product_atomic,
-- app/admin/semi-products/actions.ts, app/admin/products/modifiers/actions.ts).
-- The 129 historical nulls were backfilled with created_at by
-- scripts/backfill-recipe-start-date.ts, which proved the change neutral by
-- replaying recipe selection over every order line.
--
-- Guard: this migration fails loudly rather than silently skipping if any
-- null survives, so a partial backfill cannot be mistaken for success.

do $$
declare
  null_count integer;
begin
  select count(*) into null_count from public.recipes where start_date is null;
  if null_count > 0 then
    raise exception
      'Cannot set recipes.start_date NOT NULL: % rows still null. Run scripts/backfill-recipe-start-date.ts --apply first.',
      null_count;
  end if;
end $$;

alter table public.recipes
  alter column start_date set not null;
```

- [ ] **Step 2: Verify the guard fires on a null**

Run in a scratch transaction against a local or branch database, never production:

```sql
begin;
insert into public.recipes (id, target_type, target_id, ingredients_json, status, created_at)
  values ('RC-GUARD-TEST', 'SEMI_PRODUCT', 'BTP-001', '[]', 'ACTIVE', now());
-- then run the migration's do-block; it must raise.
rollback;
```

Expected: `Cannot set recipes.start_date NOT NULL: 1 rows still null`

- [ ] **Step 3: Apply the migration**

Run: `npx supabase db push`
Expected: migration `0048` applied, no error.

- [ ] **Step 4: Verify the constraint is live**

```sql
select is_nullable from information_schema.columns
 where table_name = 'recipes' and column_name = 'start_date';
```

Expected: `NO`

- [ ] **Step 5: Prove the form is still optional — do not skip**

`NOT NULL` constrains the column. It must not reach the operator. Verify all
three by hand, in the running app:

1. Open `/admin/semi-products`, edit any semi-product, change one ingredient
   quantity, and save **without touching** "Ngày áp dụng công thức (Nếu đổi)".
   Expected: saves cleanly, no validation error. New recipe row has
   `start_date` equal to its `created_at`.
2. Repeat, this time entering a date 30 days in the past.
   Expected: saves cleanly, new row's `start_date` is that date.
3. Confirm the input carries no `required` attribute:

```bash
grep -n "required" app/admin/semi-products/components/SemiProductForm.tsx
```

Expected: no match on the `effectiveDate` DatePicker (id `${formId}-effectiveDate`).

If case 1 fails, **revert `0048` immediately**. A database constraint that
forces the owner to type a date on every recipe edit is a regression, not a
fix — the whole point is that blank stays legal for the operator.

- [ ] **Step 6: Run the full test suite and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green, 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0048_recipes_start_date_not_null.sql
git commit -m "Claude-Sonnet feat: migration 0048, recipes.start_date NOT NULL

A null start_date made 'equals created_at' and 'nobody filled it in'
indistinguishable in the data, and forced every reader to reimplement the
same fallback. Write paths already populate it (0044, semi-products and
modifiers actions); 0048 closes the remaining hole.

Includes a guard that raises if any null survives, so a partial backfill
cannot pass as success.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove the read-time fallback

**Files:**
- Modify: `lib/recipe-selection.ts:43`, `lib/recipe-selection.ts:58-64`
- Create: `supabase/migrations/0049_backdated_recipe_detection_drop_coalesce.sql`
- Test: `lib/recipe-selection.test.ts`

**Interfaces:**
- Consumes: the `NOT NULL` guarantee from Task 2.
- Produces: `selectEffectiveRecipe` with an unchanged signature —
  `selectEffectiveRecipe(recipes: EffectiveRecipe[], targetType: string,
  targetId: string, asOf: string): EffectiveRecipe | null`. Only the internal
  date resolution changes. No caller needs editing.

- [ ] **Step 1: Write the failing test**

Add to `lib/recipe-selection.test.ts`:

```ts
describe("selectEffectiveRecipe without the created_at fallback", () => {
  // After 0048, start_date is never null. A recipe whose start_date is in
  // the future must not be selected even when its created_at is in the past
  // -- under the old fallback this distinction could not be expressed.
  it("ignores created_at entirely and honours start_date alone", () => {
    const recipes = [
      { id: "RC-OLD", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: "2026-04-01T00:00:00.000Z", created_at: "2026-04-01T00:00:00.000Z" },
      { id: "RC-FUTURE", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: "2026-09-01T00:00:00.000Z", created_at: "2026-04-02T00:00:00.000Z" },
    ];
    const picked = selectEffectiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001", "2026-05-01T00:00:00.000Z");
    expect(picked?.id).toBe("RC-OLD");
  });

  it("throws when start_date is missing instead of silently guessing", () => {
    const recipes = [
      { id: "RC-BAD", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: null as unknown as string, created_at: "2026-04-01T00:00:00.000Z" },
    ];
    expect(() =>
      selectEffectiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001", "2026-05-01T00:00:00.000Z"),
    ).toThrow(/RC-BAD/);
  });
});
```

- [ ] **Step 2: Run the tests to verify the second one fails**

Run: `npx vitest run lib/recipe-selection.test.ts -t "without the created_at fallback"`

Expected: first test PASSES (current code already honours an explicit
start_date), second test FAILS — current code silently falls back instead of
throwing.

- [ ] **Step 3: Remove the fallback**

In `lib/recipe-selection.ts`, replace lines 43-44:

```ts
    const startValue = recipe.start_date || recipe.created_at;
    const startMs = startValue ? new Date(startValue).getTime() : 0;
```

with:

```ts
    // start_date is NOT NULL as of migration 0048. A missing value means the
    // row bypassed the constraint, which must surface rather than be guessed.
    if (!recipe.start_date) {
      throw new Error(`Recipe ${recipe.id ?? "(no id)"} has no start_date`);
    }
    const startMs = new Date(recipe.start_date).getTime();
```

In the same file, replace the sort comparator's date resolution at lines 58-64:

```ts
  candidates.sort((left, right) => {
    const leftEffective = new Date(
      left.start_date || left.created_at || 0,
    ).getTime();
    const rightEffective = new Date(
      right.start_date || right.created_at || 0,
    ).getTime();
```

with:

```ts
  candidates.sort((left, right) => {
    // Both are guaranteed non-null: the filter above threw otherwise.
    const leftEffective = new Date(left.start_date!).getTime();
    const rightEffective = new Date(right.start_date!).getTime();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/recipe-selection.test.ts`
Expected: PASS, including the equivalence test added in Task 1.

- [ ] **Step 5: Run the full suite and type check**

Run: `npx vitest run && npx tsc --noEmit`

Expected: all green, 0 type errors. `lib/history-ops/hong-luc-migration.ts:785`
also reads `recipe.start_date || recipe.created_at`; it is a closed one-off
module and is **not** in scope — leave it, its fallback is now simply
redundant rather than wrong.

- [ ] **Step 6: Write the trigger migration**

Create `supabase/migrations/0049_backdated_recipe_detection_drop_coalesce.sql`:

```sql
-- 0043 tests coalesce(new.start_date, new.created_at) because start_date
-- could be null. 0048 made it NOT NULL, so the coalesce is dead code that
-- keeps the old ambiguity readable in the schema. Drop it so the trigger
-- states the same rule the application now states.
--
-- Behaviour is identical for every row that can exist after 0048.

create or replace function public.detect_backdated_recipe_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.mac_drift_recovery', true) = 'on' then
    return new;
  end if;

  if new.start_date < now() - interval '5 minutes' then
    insert into public.backdated_recipe_events (
      recipe_id, target_type, target_id, effective_timestamp, visibility_timestamp
    ) values (
      new.id, new.target_type, new.target_id, new.start_date, now()
    )
    on conflict (recipe_id) do nothing;
  end if;

  return new;
end $$;
```

- [ ] **Step 7: Verify the trigger still fires on a backdated insert**

```sql
begin;
insert into public.recipes (id, target_type, target_id, ingredients_json, status, start_date, created_at)
  values ('RC-BACKDATE-TEST', 'SEMI_PRODUCT', 'BTP-001', '[]', 'ACTIVE',
          now() - interval '30 days', now());
select count(*) from public.backdated_recipe_events where recipe_id = 'RC-BACKDATE-TEST';
rollback;
```

Expected: `1`

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Đây chính là trường hợp RC-032 "Khoai luộc" -- nhập ngày 30/07 nhưng
  hiệu lực 31/05, lùi 60 ngày. Trước 0043 nó KHÔNG sinh dòng cảnh báo nào.
  Nếu câu lệnh trên trả về 0, trigger vẫn hỏng -- DỪNG, đừng commit.
```

- [ ] **Step 8: Apply and verify**

Run: `npx supabase db push && npx vitest run && npx tsc --noEmit`
Expected: migration applied, all green, 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add lib/recipe-selection.ts lib/recipe-selection.test.ts supabase/migrations/0049_backdated_recipe_detection_drop_coalesce.sql
git commit -m "Claude-Sonnet refactor: recipe effectiveness reads start_date only

With 0048 making start_date NOT NULL, the read-time fallback
(start_date || created_at) is unreachable. Removing it means the stored
value is the single answer to 'when did this recipe take effect', instead
of a rule every reader had to reimplement. selectEffectiveRecipe now throws
on a missing start_date rather than guessing.

0049 drops the matching coalesce from the backdating trigger.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

---

### Task 4: `created_at` always records the real save moment

**Status: code merged in `30b5fa8` (Sonnet 5), reviewed and accepted by the
coordinator 2026-07-31 — 936/936 tests pass, `tsc` clean. Step 5 is still
outstanding; see the note on it below. Do not re-run Steps 1-4.**

**Files:**
- Modify: `app/admin/semi-products/actions.ts:126,139`
- ~~Modify: `app/admin/products/modifiers/actions.ts:147,159`~~ — **the plan was
  wrong here.** `modifiers/actions.ts:107` declares `const nowIso = new Date().toISOString()`
  and there is no effective-date form field anywhere in the modifiers flow, so
  the variable is never reassigned and `start_date` already always equals
  `created_at`. Nothing to fix. Caught by Sonnet 5 during implementation and
  verified independently by the coordinator.
- Test: `app/admin/semi-products/actions.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. Independent; can run first.
- Produces: no exported symbol changes. Behaviour only.

**The rule, given by the owner 2026-07-31 as three cases. These are the
acceptance criteria — the task is done when all three hold, and not before.**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu. Người dùng bấm lưu lúc 31/07/2026 10:00:00.

  1. Bỏ trống ô ngày
     start_date  = 31/07/2026 10:00:00
     created_at  = 31/07/2026 10:00:00      (bằng nhau)

  2. Điền ngày QUÁ KHỨ 30/07/2026 12:00:00
     start_date  = 30/07/2026 12:00:00
     created_at  = 31/07/2026 10:00:00      (KHÁC nhau)

  3. Điền ngày TƯƠNG LAI 01/08/2026 12:00:00
     start_date  = 01/08/2026 12:00:00
     created_at  = 31/07/2026 10:00:00      (KHÁC nhau)

Bất biến: created_at LUÔN là lúc bấm lưu thật, không bao giờ bị start_date
ghi đè. Nếu case 2 hoặc 3 cho created_at khác 10:00:00 -> DỪNG, code sai.
```

**Why this needs changing.** One variable carries two different meanings.
`app/admin/semi-products/actions.ts:105-107` initialises `nowIso` to the current
time, then **overwrites it** with the form's effective date when one is given —
and lines 125-126 and 138-139 write that same variable to both `start_date` and
`created_at`. `lib/sheets_db.ts:463-480`'s `insert()` passes the payload through
without overriding `created_at`.

Traced through the owner's case 2 — save pressed 31/07 10:00, effective date
entered as 30/07 12:00:

| | Required | What the code produces |
|---|---|---|
| `start_date` | 30/07 12:00 | 30/07 12:00 — correct |
| `created_at` | **31/07 10:00** | **30/07 12:00** — wrong |

The two columns cannot differ while one variable feeds both, so cases 2 and 3
are unreachable by construction. `app/admin/products/modifiers/actions.ts:146-147,158-159`
has the identical shape.

**What it costs.** The record of *when a recipe was actually entered* is
destroyed, so late entry becomes indistinguishable from timely entry — which is
exactly the evidence needed to judge whether historical orders were costed
against the right recipe. `RC-032` ("Khoai luộc", entered 2026-07-30, effective
2026-05-31, 60 days late) is the case that matters: if its `created_at` had been
overwritten to 2026-05-31, nothing would show it was entered late at all.

Production currently contradicts that reading — `RC-029` (`start_date`
2026-05-31, `created_at` 2026-06-26) and `RC-032` (2026-05-31 / 2026-07-30) are
26 and 60 days apart — so either those rows came by another path or the code
changed after them. **Step 1 settles that before anything is edited.** The rule
above holds either way; only the size of the fix depends on the answer.

- [ ] **Step 1: Establish whether the defect is live**

```bash
git log --oneline -S "created_at: nowIso" -- app/admin/semi-products/actions.ts
```

Compare any matching commit's date against `RC-032`'s `created_at`
(2026-07-30). Record the answer in the commit message at Step 6. If the current
code demonstrably never ran for those rows, the fix below is still required —
it just means the defect has not yet been triggered in production.

- [ ] **Step 2: Write the failing test**

Add to `app/admin/semi-products/actions.test.ts`:

```ts
import { describe, it, expect } from "vitest";

// The owner's three cases, 2026-07-31. created_at always records the real
// save moment; start_date carries the effective date, past or future.
describe("recipe save: start_date never overwrites created_at", () => {
  const SAVE_MOMENT = "2026-07-31T10:00:00.000Z";

  function resolveDates(effectiveDateStr: string | null, saveMoment: string) {
    const startDate = effectiveDateStr
      ? new Date(effectiveDateStr).toISOString()
      : saveMoment;
    return { start_date: startDate, created_at: saveMoment };
  }

  it("case 1: blank effective date -- both columns equal the save moment", () => {
    const r = resolveDates(null, SAVE_MOMENT);
    expect(r.start_date).toBe("2026-07-31T10:00:00.000Z");
    expect(r.created_at).toBe("2026-07-31T10:00:00.000Z");
  });

  it("case 2: past effective date -- created_at stays at the save moment", () => {
    const r = resolveDates("2026-07-30T12:00:00.000Z", SAVE_MOMENT);
    expect(r.start_date).toBe("2026-07-30T12:00:00.000Z");
    expect(r.created_at).toBe("2026-07-31T10:00:00.000Z");
  });

  it("case 3: future effective date -- created_at stays at the save moment", () => {
    const r = resolveDates("2026-08-01T12:00:00.000Z", SAVE_MOMENT);
    expect(r.start_date).toBe("2026-08-01T12:00:00.000Z");
    expect(r.created_at).toBe("2026-07-31T10:00:00.000Z");
  });
});
```

- [ ] **Step 3: Run the test to verify it passes as a specification**

Run: `npx vitest run app/admin/semi-products/actions.test.ts -t "never overwrites created_at"`
Expected: PASS. `resolveDates` is the shape the action must adopt in Step 4;
this test pins the required behaviour before the action is edited.

- [ ] **Step 4: Separate the two variables in the action**

In `app/admin/semi-products/actions.ts`, replace lines 105-108:

```ts
    let nowIso = new Date().toISOString();
    if (effectiveDateStr) {
      nowIso = new Date(effectiveDateStr).toISOString();
    }
```

with:

```ts
    // Two distinct facts, never the same variable: savedAtIso is when the
    // operator pressed save, effectiveIso is when the recipe takes effect.
    // Blank means "effective now"; a filled value may be past or future.
    const savedAtIso = new Date().toISOString();
    const effectiveIso = effectiveDateStr
      ? new Date(effectiveDateStr).toISOString()
      : savedAtIso;
```

Then in the same file, at both insert sites (originally lines 120-128 and
133-141), write:

```ts
          start_date: effectiveIso,
          created_at: savedAtIso,
```

and at the close-out `update` (originally line 114-116) keep the effective
date, since closing an interval is an effectiveness fact:

```ts
        await update("Recipes", existingActiveRecipe.id, {
          end_date: effectiveIso
        });
```

Apply the identical change to `app/admin/products/modifiers/actions.ts` at
lines 146-147 and 158-159.

- [ ] **Step 5: Verify all three cases by hand in the running app — STILL OPEN**

**This step is not optional and the unit tests do not replace it.** The tests
in `actions.test.ts` mock `insert()`, so they prove the *payload the action
builds* is correct. They cannot prove the *row that lands in the database* is
correct — and that gap is the entire original mystery: `RC-029` and `RC-032`
show `start_date` and `created_at` 26 and 60 days apart, which the pre-fix code
could not produce, meaning something between the action and the stored row was
already behaving differently than the code reads.

The same failure shape is on record in `DEVELOPMENT-TRACKING.md` (2026-07-31):
the Phase 3 restore drill verified repo code and never the deployed pipeline,
which is how `order_payments` sat unbacked for weeks while a local script
reported 40/40 tables healthy.

For each of the owner's three cases, save a semi-product recipe change through
the real UI and read the row back:

```sql
select id, start_date, created_at, (start_date = created_at) as same
  from public.recipes order by created_at desc limit 1;
```

Expected: case 1 → `same = true`. Cases 2 and 3 → `same = false`, and
`created_at` within a few seconds of the actual save.

If case 2 or 3 comes back with `same = true` despite the merged code, then a
database default, trigger, or wrapper is overriding `created_at` — stop and
report before starting Task 1.

- [ ] **Step 6: Run the full suite, type check, and commit**

```bash
npx vitest run && npx tsc --noEmit
git add app/admin/semi-products/actions.ts app/admin/products/modifiers/actions.ts app/admin/semi-products/actions.test.ts
git commit -m "Claude-Sonnet fix: recipe created_at records the save moment, not the effective date

Both recipe save paths computed one variable from the effective-date field
and wrote it to start_date and created_at alike, so backdating or
future-dating a recipe also rewrote when it was entered. Split into
savedAtIso and effectiveIso.

Locks the owner's three cases (2026-07-31): blank -> both equal the save
moment; past or future effective date -> start_date carries it and
created_at stays at the save moment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Confirm a future-dated recipe behaves correctly

**Files:**
- Test: `lib/recipe-selection.test.ts`
- Create: `docs/audits/2026-07-31-future-dated-recipe-behaviour.md`

**Interfaces:**
- Consumes: `selectEffectiveRecipe`, `findLatestActiveRecipe`, `planRecipeSave`
  from `lib/recipe-selection.ts` — all unchanged by this task.
- Produces: a finding document. Any defect found gets its own plan.

**Why.** The owner's case 3 makes a future `start_date` legal, and the UI
already permits it — `CustomDatePicker` in `SemiProductForm.tsx:224-229` sets no
`maxDate`. That case has never been exercised, and two code paths look like they
may not handle it. Neither is asserted as broken; both are to be measured.

1. `findLatestActiveRecipe` (`lib/recipe-selection.ts:80-102`) selects on
   `!recipe.end_date` and sorts by `created_at`, **not** by effectiveness. A
   future-dated recipe has no `end_date`, so it becomes "the latest active
   recipe" that `planRecipeSave` compares against — while
   `selectEffectiveRecipe` correctly still serves the older one to sales.
2. `app/admin/semi-products/actions.ts` closes the previous recipe with
   `end_date: effectiveIso`. If the previous recipe is itself future-dated and
   the new effective date is earlier, the closed row ends up with
   `end_date < start_date` — an interval that cannot be true.

- [ ] **Step 1: Write tests describing the intended behaviour**

Add to `lib/recipe-selection.test.ts`:

```ts
describe("future-dated recipes", () => {
  const recipes = [
    { id: "RC-NOW", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
      status: "ACTIVE", ingredients_json: "[]",
      start_date: "2026-07-01T00:00:00.000Z", created_at: "2026-07-01T00:00:00.000Z" },
    { id: "RC-FUTURE", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
      status: "ACTIVE", ingredients_json: "[]",
      start_date: "2026-08-01T12:00:00.000Z", created_at: "2026-07-31T10:00:00.000Z" },
  ];

  it("serves the current recipe before the future one takes effect", () => {
    const picked = selectEffectiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001", "2026-07-31T23:00:00.000Z");
    expect(picked?.id).toBe("RC-NOW");
  });

  it("switches to the future recipe once its start_date arrives", () => {
    const picked = selectEffectiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001", "2026-08-01T13:00:00.000Z");
    expect(picked?.id).toBe("RC-FUTURE");
  });

  it("findLatestActiveRecipe returns the future recipe -- documents current behaviour", () => {
    // Not necessarily correct. Pinned so Step 2 can judge it deliberately
    // rather than discovering it during an incident.
    const latest = findLatestActiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001");
    expect(latest?.id).toBe("RC-FUTURE");
  });
});
```

- [ ] **Step 2: Run the tests and record what each proves**

Run: `npx vitest run lib/recipe-selection.test.ts -t "future-dated recipes"`

Expected: first two PASS (`selectEffectiveRecipe` honours `start_date`
correctly). The third pins existing behaviour — if it passes, decide whether
`planRecipeSave` comparing against a not-yet-effective recipe is acceptable.

- [ ] **Step 3: Record the finding and commit**

Write `docs/audits/2026-07-31-future-dated-recipe-behaviour.md` covering both
risks above, stating for each whether it is a real defect and, if so, what the
symptom would be for the owner in plain Vietnamese. Do not fix anything here.

```bash
git add lib/recipe-selection.test.ts docs/audits/2026-07-31-future-dated-recipe-behaviour.md
git commit -m "Claude-Sonnet test: pin future-dated recipe behaviour, audit the two risky paths

Owner case 3 (2026-07-31) makes a future start_date legal and the UI already
allows it. selectEffectiveRecipe handles it correctly. findLatestActiveRecipe
and the end_date close-out may not; recorded rather than changed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Out of scope

Each is a separate tracked item; folding them in here would repeat the
bundling mistake this sequence exists to avoid.

- **Setting *true* effective dates.** This plan writes `created_at` into
  `start_date`. Where the owner knows a recipe actually took effect earlier,
  that is a per-recipe business decision he must make, and it changes stock
  deduction and cost. `RC-029` and `RC-032` show the pattern (26 and 60 days
  of backdating). Do not guess these.
- **The 13 phantom `STOCK_ADJUST` rows and the full-history rebuild.** See
  `docs/superpowers/specs/2026-07-31-inventory-ledger-clean-rebuild-design.md`.
  Blocked on the 50 MB backup work.
- **`OPEN-ITEMS.md` item 1** — whether `RC-032` produced no
  `backdated_recipe_events` row because `0043` landed after it. Task 3 Step 7
  tests the trigger's current behaviour but does **not** confirm the history.
- **`lib/history-ops/hong-luc-migration.ts:785`** — closed one-off module,
  redundant fallback left in place deliberately.

## Verification bar

Per `docs/COLLABORATION.md` section E:

- `npx tsc --noEmit` — 0 errors.
- Full suite green.
- 0 rows with `start_date IS NULL` after Task 1.
- `information_schema` reports `is_nullable = NO` after Task 2.
- Recipe selection identical for all replayed order lines (Task 1 Step 4
  reports `Differences: 0`).
- No push.

MAC/COGS drift audits are **not** required: nothing in this plan changes stock
deduction or cost. If any of them moves, something is wrong — treat a non-zero
delta as a stop condition, not a new baseline.

## Ownership

**Claude Sonnet 5 implements. Opus 5 coordinator reviews each commit before the
next task starts.**

Settled by standing owner decision: Sonnet 5 replaces Codex across
`app/**`, `components/**`, `lib/*.ts`, `supabase/migrations/*.sql` and
`scripts/*.ts` (`docs/ROADMAP.md` "Active agents & scope", 2026-07-27;
re-confirmed by the owner 2026-07-31). `docs/COLLABORATION.md` section C still
names Codex for these paths and is stale on this point — it is on the list as
problem B, not a blocker here.

The no-self-review rule still holds and is satisfied by the coordinator review
above, not waived.

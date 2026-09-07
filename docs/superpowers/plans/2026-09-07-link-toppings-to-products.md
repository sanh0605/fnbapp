# Link each topping's two records so the product list stops lying about it

> **For agentic workers:** REQUIRED SUB-SKILLS: `superpowers:executing-plans` for the plan, `superpowers:test-driven-development` for every code task, and `superpowers:fnbapp-bulk-data-change` before the backfill in Task 1 — it writes to production rows. Challenge the plan first and report. **Stop at Task 3**: running the migration on the live server is the owner's separate approval, never folded into a push approval.

**Goal:** teach the product list that a topping sold as an add-on has been sold.
Nothing about how toppings are sold changes; both paths stay, by owner decision
2026-09-07 (`BR-CATALOG-003`).

**Rule this serves:** `docs/02-rules/business-rules/catalog.md`, `BR-CATALOG-003`.
Read it before starting — it carries the measurements and what the owner was
asked.

## Current state (five numbered questions)

Measured 2026-09-07 against production with a read-only probe.

1. **States.** Per topping the product list decides one thing: does "Xoá vĩnh
   viễn" appear? Today: yes when no `order_lines_v2` row carries that
   `product_id` or one of its `variant_id`s. After: also no when a modifier
   linked to that product has been sold. No other state moves.
2. **Buttons.** No button is added, removed or restyled. Five products stop
   offering "Xoá vĩnh viễn": `PROD-029`, `PROD-030`, `PROD-031`, `PROD-032`,
   `PROD-035`. `PROD-033` and `PROD-034` already do not offer it and must not
   start. The other 40 products must be untouched — 13 never-sold today, 8
   after (13 − 5; an earlier draft of this plan said 11, which was a
   subtraction slip, corrected 2026-09-07 after Sonnet measured 8 and refused
   to report the plan's figure).
3. **Lists.** Changed: the sold-set the page computes. Not changed: which
   products are listed, the `DELETED` filter, the POS grid, the modifiers admin
   screen, every report.
4. **Inputs.** Not applicable — no input field changes. The new column is set by
   a one-off backfill, not typed by anyone.
5. **Data.** One schema change and one backfill on production, both needing the
   owner's separate approval. `modifiers` gains a nullable `product_id`. Nine
   rows get a value or stay null. No order, no sale, no price is touched.

Seen: `app/admin/products/page.tsx`, `app/admin/products/toppings/actions.ts`,
`lib/db/tables.ts`, `lib/products/product-erase-transaction.ts`,
`supabase/migrations/0001_init_schema.sql` (the `modifiers` and `recipes`
tables), `supabase/migrations/0075_erase_never_sold_product.sql` by reference.
Not seen: `ProductsClient.tsx` body, the modifiers admin screen body, the POS
cart writer that produces `modifiers_snapshot_json`.

## The defect, stated once

`modifiers` has no `product_id`. Nothing joins *Kem muối* `MOD-002` to *Kem
muối* `PROD-030` except the spelling. The page reads only
`order_lines_v2.product_id` and `variant_id`, and add-on sales live in
`modifiers_snapshot_json` on the parent line, so those sales are invisible to it.

Measured, whole trading history:

| Topping | product | add-on sales | standalone | offered for deletion today |
|---|---|---:|---:|---|
| 20ml cốt cà phê | `PROD-029` | 136 | 0 | **yes** |
| Trân châu trắng | `PROD-032` | 75 | 0 | **yes** |
| Kem muối | `PROD-030` | 17 | 0 | **yes** |
| Dâu sấy | `PROD-035` | 6 | 0 | **yes** |
| Kem dẻo | `PROD-031` | 1 | 0 | **yes** |
| Kem muối phô mai | `PROD-033` | 37 | 1 | no |
| Đào miếng | `PROD-034` | 5 | 1 | no |

## Worked example, real numbers

Order line `ol-004ca7d2-fa55-40f2-aa12-39a46b418b4e` stores
`[{"id":"MOD-001","qty":1,"name":"20ml cốt cà phê","price":5000}]` and a
`gross_line_total` of 27.000đ — a 22.000đ drink plus the 5.000đ topping. That
line, and 135 like it, is why *20ml cốt cà phê* has sold. Its product row
`PROD-029` names no order line, so today the screen offers to erase it.

After Task 2, the page resolves `MOD-001` → `PROD-029` through the new column
and puts `PROD-029` in the sold set. The button disappears. *Hộp sữa chua*
(`MOD-009`) has no product and stays absent from the product list either way.

## Task 0: challenge the plan

Re-measure the seven pairs and the two standalone sales yourself before writing
code. Report in English: `Challenged the plan. Objections: ...`, or none with the
count you checked. A name that no longer matches, or an eighth `CAT-007` product,
changes Task 1's backfill — say so rather than adapting silently.

## Task 1: the link, the backfill, and the reader, in one migration

**Files:** a new `supabase/migrations/00XX_link_modifiers_to_products.sql`
(number it one above the highest present), `lib/db/tables.ts`,
`types/db.ts`, plus tests.

The migration and the code that reads it land in the **same commit**. CLAUDE.md
is explicit: never run a migration ahead of its reader.

- [ ] **Step 1: Read the bulk-data skill first.** The backfill writes production
      rows. List `modifiers`' triggers and say what each does to a touched row,
      name any automation that reads what those triggers produce, and prove the
      write is neutral per row with the count you compared.

- [ ] **Step 2: The migration does three things**

  1. `alter table public.modifiers add column product_id text references public.products(id) on delete restrict` — nullable, because `MOD-009` has no product and future add-ons may not either. `RESTRICT`, so Postgres refuses to erase a product a modifier still points at. That FK is what makes the erase RPC safe by itself, independent of any screen.
  2. Backfill by exact name against `CAT-007` products only. Expected: 8 of 9 rows get a value. `MOD-007` and `MOD-008` are both *Dâu sấy* and both take `PROD-035`; `MOD-009` stays null. If any other row matches zero or more than one product, the migration must raise rather than guess.
  3. A function returning the distinct modifier ids that appear in any `order_lines_v2.modifiers_snapshot_json`. Do the scan in Postgres and return ids only — the payload must stay a handful of ids, not the JSON. This repo has just been burned by a 3 MB cache entry on this very page (`BR-CATALOG-003`'s sibling fix, commit `b954af2`); do not reintroduce one.

- [ ] **Step 3: Extend the narrow reader**

`findOrderLineProductAndVariantIds` already returns product and variant ids.
Have it also return the sold modifier ids from the new function, in the same
cached call, keeping the `CLI_MODE` branch that commit `6356d37` added. Update
`types/db.ts` for the new column.

- [ ] **Step 4: Tests, red first**

Cover: a modifier with a `product_id` that has sold marks its product sold; a
modifier with a null `product_id` marks nothing; two modifiers pointing at one
product do not double-count; a product sold only standalone is still sold. Say
in the commit message whether each was red for a wrong value or a missing
function.

- [ ] **Step 5: Gates, then commit** — four fast gates plus `npm run build`.
      Do **not** run the migration against the live server.

## Task 2: the product list uses the link

**Files:** `app/admin/products/page.tsx`, tests.

- [ ] **Step 1:** After the existing two loops, add a third: for each sold
      modifier id, look up its `product_id` and add it to `soldProductIds`. Keep
      the comment above them — the rule it states is unchanged, only its inputs
      widen. Extend that comment with one sentence naming the add-on path and
      the rule id, so the next reader knows why a third loop is there.
- [ ] **Step 2:** A test asserting the five products above leave the never-sold
      set and `PROD-033`/`PROD-034` stay out of it.
- [ ] **Step 3:** Gates, build, commit.

## Task 3: prove it on real data, then stop

- [ ] **Step 1:** A throwaway read-only script comparing the never-sold set
      before and after. Expected exactly: 13 before, 8 after, and the five
      leaving are `PROD-029`, `PROD-030`, `PROD-031`, `PROD-032`, `PROD-035`.
      Report the denominator: "N of 47 products". Measured 2026-09-07 by both
      Sonnet and the supervisor, independently, before the migration ran.
- [ ] **Step 2:** **Stop.** Hand the owner: the migration file to read, the
      before/after numbers, and the screens to open. Running it on the live
      server is his separate approval, asked as its own question, never bundled
      with a push.

## Cross-impact — flagged, not fixed

- **`CAT-007` is hard-coded** in `toggleToppingStandalone`. Against the rule that
  anything the owner may want to change lives in data. Not fixed here; changing
  it is its own decision.
- **Prices are not synchronised.** *Kem muối* is 4.000đ in both tables today by
  coincidence of data entry, not by any mechanism. This plan does not add one.
  If the owner edits one side, the two will disagree silently. Tell him that
  plainly when handing over; whether prices should follow the link is a business
  decision nobody has been asked.
- **Toppings still have no recipe.** Correct under `BR-COGS-005`, which measures
  cost by stocktake rather than per cup. Nothing to do.

## Out of scope

Creating a `CAT-007` product for *Hộp sữa chua*; merging the duplicate *Dâu sấy*
modifiers; the modifiers admin screen; anything about how toppings are sold.

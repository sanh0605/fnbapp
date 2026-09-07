# Repair the migration history so the CLI stops being a loaded gun

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Task 1 is read-only measurement. Task 2 writes to the production migration-history table and needs the owner's approval, which he has already given for the repair itself — but **stop and ask again if Task 1 cannot prove all 32**. Task 3 is a production schema change and is a **separate** approval. Never run `supabase db push` before Task 2 passes its check.

**Goal:** make `supabase_migrations.schema_migrations` on the live server match
what has actually run, so that `supabase db push` is a safe one-command release
again and nobody has to paste SQL into a dashboard.

**Owner decision 2026-09-07:** repair the history first, then let `0097` go out
through the normal path rather than by hand — *"Dọn sổ trước."*

## Current state (five numbered questions)

Measured 2026-09-07 with `npx supabase migration list` against the linked
project.

1. **States.** Each migration is `applied` or `unapplied` in the history table.
   `0001`–`0064` say applied. `0065`–`0097` say unapplied. `0065`–`0096` have in
   fact run — that is the lie this plan corrects. `0097` genuinely has not run.
2. **Buttons.** Not applicable — no screen changes. Nothing the owner sees moves.
3. **Lists.** Changed: 32 rows in the history table. Not changed: every other
   table, every function, every row of business data.
4. **Inputs.** Not applicable.
5. **Data.** `migration repair` writes **only** to the history table and executes
   none of the migration SQL. No business data is read or written. The risk is
   not corruption; it is marking something applied that never ran, which would
   mean it never runs and nobody finds out.

Seen: all 32 migration files, `supabase migration list` output, `supabase
migration repair --help`. Not seen: the live body of any function (Task 1
measures those), the history table itself.

## Why the history drifted, and why doing nothing costs more

Migrations from `0065` on were applied by hand — the same dashboard route the
owner was about to use for `0097`. Hand-application never writes the history row,
so every manual fix widens the gap, which forces the next fix to be manual too.
The gap is now 32 wide. Left alone it grows; `supabase db push` stays unusable
because it would replay 32 migrations including `drop table` statements.

## The danger, stated plainly

`migration repair --status applied` **runs no SQL**. It writes a row saying "this
one is done". If a migration is marked applied when it did not run, it will never
run, and the history will insist everything is fine. That failure is silent and
permanent. So: **mark applied only what is proven applied.** Anything unproven
stops the task and goes to the owner as its own question.

## Task 0: challenge the plan

Re-run `npx supabase migration list` and confirm the boundary is still
`0064`/`0065` and the tail is `0097`. Read all 32 files. Report in English, with
the count, any migration whose observable artifact differs from the table below —
the table is a survey, not gospel, and a wrong marker is worse than no marker.

## Task 1: prove each of the 32, read-only

**Files:** one throwaway probe script, deleted at the end. No repo file changes.

Three classes, by how the migration can be observed:

**Class A — structural, directly observable (11).** Query
`information_schema` / `pg_indexes` for the artifact.

| Migration | Prove by |
|---|---|
| `0065` duplicate_name_guard | the index it creates exists |
| `0066` | `base_ingredients` gained its column — **but `base_ingredients` was dropped by `0090`**, so this one is Class C, see below |
| `0067` | `purchased_items` has the confirmation column |
| `0068` | `purchased_items.is_non_inventory` exists |
| `0069` | `asset_depreciation_bands` exists |
| `0070` | `assets` has the band-bounds column |
| `0071` | `outlets` exists and `orders_v2.outlet_id` exists |
| `0072` | `orders_v2.outlet_id` is NOT NULL **and** the unique index `orders_v2_order_no_active` exists — the only migration in the tree doing either, so this proves `0072` even though `0085` later overwrote its two functions |
| `0073` | `outlets` has the hours column |
| `0090` | `base_ingredients` is **gone** |
| `0095` | `purchased_items.base_ingredient_id` is **gone** |
| `0096` | `inventory_balances` is **gone** |

**Class B — function bodies (17).** The function exists either way, so existence
proves nothing. Fetch the live source with `pg_get_functiondef(oid)` and look for
a marker string unique to that migration's version — an error message, a comment,
or a column reference the previous version did not have. Pick the marker by
reading both versions, and record which marker you chose for each. Covers
`0075`, `0076`, `0078`, `0079`, `0080`, `0082`, `0083`, `0084`, `0086`, `0087`,
`0088`, `0089`, `0092`, `0093`, `0094`. `0077`, `0081`, `0085` are the easy half
of this class: they only drop functions, so prove the dropped names are absent.
`0072` moved to Class A and `0074` to Class C — see the overlap table below;
neither can be proved by a marker of its own.

**Class C — superseded or unobservable (the rest).** Some cannot be measured
directly and must be reasoned about, with the reasoning written down:

- **A function replaced more than once.** Eight functions, found by mapping every
  `create [or replace] function` across all 32 and grouping by name — an earlier
  draft of this plan listed only five and was corrected 2026-09-07 after Sonnet
  found the two missing pairs:

  | Function | Written by | Only this marker survives |
  |---|---|---|
  | `apply_stocktake_session_atomic` | `0079`, `0086`, `0089` | `0089` |
  | `create_issue_slip_atomic` | `0076`, `0094` | `0094` |
  | `create_pos_order_atomic` | `0072`, `0085` | `0085` |
  | `create_pos_order_atomic_unvalidated_0025` | `0072`, `0085` | `0085` |
  | `reverse_manual_issue_atomic` | `0076`, `0093` | `0093` |
  | `save_stocktake_line_atomic` | `0087`, `0092` | `0092` |
  | `supersede_order_v2_atomic` | `0074`, `0081` | `0081` |
  | `void_order_atomic` | `0080`, `0088` | `0088` |

  For the superseded ones, say so explicitly: they are **inferred**, on the
  ground that a later proven migration overwrote them, so marking them applied
  cannot skip anything that still matters. Do not dress inference up as
  measurement.

  **`0074` is inferred; `0072` is not.** `0074` is function-only — 280 of its
  311 lines are the `supersede_order_v2_atomic` body, and `0081` drops the
  overloads it created (lines 32-33) before recreating both, so nothing of
  `0074` survives to measure. `0072` also rewrites two functions that `0085`
  later replaced, but it carries structural work nothing else touches, which
  makes it **Class A, PROVEN**: it is the only migration in the tree that sets
  `orders_v2.outlet_id` NOT NULL, and the only one that creates the unique index
  `orders_v2_order_no_active`. Prove `0072` by those two, not by a function body.
  (The NOT NULL is also what separates `0072` from `0071`, which merely adds the
  column.)
- **`0066`** touches `base_ingredients`, a table `0090` later dropped. Same
  reasoning: inferred, superseded.
- **`0091`** is grants only, no DDL. Prove it with
  `has_function_privilege('service_role', ..., 'EXECUTE')` on the functions it
  grants, or declare it unprovable and hand it to the owner.

- [ ] **Step 1:** Write the probe. Read-only. It must print, per migration:
      the class, the exact check run, and `PROVEN` / `INFERRED` / `UNPROVEN`.
- [ ] **Step 2:** Report the tally with its denominator — "N proven, M inferred,
      K unproven, of 32". List every INFERRED with its superseding migration and
      every UNPROVEN with what you tried.
- [ ] **Step 3: If anything is UNPROVEN, stop.** Do not proceed to Task 2. That
      is an owner question, one migration at a time.

## Task 2: repair the history

Only after Task 1 shows zero UNPROVEN.

- [ ] **Step 1:** `npx supabase migration repair --status applied --linked` with
      the proven and inferred versions. If it prompts for a database password
      interactively, **stop** — an interactive prompt is not yours to answer;
      hand the owner the exact command.
- [ ] **Step 2:** `npx supabase migration list` again. The only row without a
      remote value must be `0097`. Any other shape: stop and report.
- [ ] **Step 3:** Commit nothing — this task changes no repo file. Report the
      before/after shape of the list.

## Task 3: let `0097` go out the normal way — SEPARATE OWNER APPROVAL

- [ ] **Step 1: Stop and ask.** Task 2 finishing does not authorise this. Running
      `0097` on production is its own approval, and the owner giving it does not
      also authorise a push or a deploy.
- [ ] **Step 2:** On his word, `npx supabase db push`. Expect exactly one
      migration applied. Anything else applied means Task 1 was wrong — capture
      the output and report before touching anything.
- [ ] **Step 3:** Verify against production, read-only: `modifiers.product_id`
      exists, 8 of 9 rows linked with `MOD-009` null, `find_sold_modifier_ids()`
      returns the sold ids, and the never-sold product count is **8 of 47**,
      down from 13. Then confirm `/admin/products` loads without the
      "Could not find the function public.find_sold_modifier_ids" error it throws
      today.

## Cross-impact

- **`/admin/products` is broken until Task 3 finishes.** The page calls
  `find_sold_modifier_ids`, which does not exist yet. That is deliberate — a
  fallback would show wrong buttons silently — but it means this plan is now
  blocking a screen the owner uses.
- **The repaired history is only as good as Task 1.** If a migration was marked
  applied on a weak marker, `db push` will skip it forever. Prefer UNPROVEN and
  an owner question over a generous guess.
- **This does not make pushing code safe.** Repairing history and deploying are
  different acts with different approvals.

## Out of scope

Backfilling history rows for `0001`–`0064` (already correct); changing how
migrations are written or numbered; any change to business data.

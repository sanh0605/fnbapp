# Phase 2 — Workflow Docs and Reference Set: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the human-facing documentation set from live source — the 10 workflow docs, the completed hand-drawn system map, the glossary, the system overview, and the incident-response runbook — every file passing the Phase-1 gates.

**Architecture:** Every doc is derived from what the code actually does, never from old records (spec §2.2). The generated map `docs/generated/system-map.md` (built in Phase 1) is the authority for which file writes which table; workflow docs declare a subset of it and the map-drift gate enforces agreement. Each workflow doc carries a machine-readable `flow-decl` block (checked by the Phase-1 flow-doc gate) plus prose answering the same five questions. The hand map `docs/01-system/SYSTEM-MAP.md` is completed first so every flow's relations have somewhere to live.

**Tech Stack:** Markdown only. Verification is the existing Phase-1 tooling: `npx vite-node scripts/doc-checks/run-blocking.ts` and `npx vite-node scripts/check-rules-current.ts`. No code changes in this phase.

**Spec:** `docs/superpowers/specs/2026-09-02-project-reset-design.md` (owner-approved). This plan implements its §3.2 doc tree, §3.4b/§3.5 (10 flows, five-question frame), §3.6 (hand map), and the language split §2.17.

## Global Constraints

- **Language by reader (spec §2.17, §3.2 tree):** `03-workflows/*.md`, `SYSTEM-MAP.md`, `INCIDENT-RESPONSE.md` are **English** (machine + DEV readers). `GLOSSARY.md`, `SYSTEM-OVERVIEW.md` are **Vietnamese** (owner reads them). `BUSINESS-RULES.md` stays Vietnamese and is NOT touched this phase (Phase 3).
- **200-line ceiling** on every file in the governed doc set (Phase-1 line-ceiling gate). If a doc would exceed it, split by sub-concern.
- **No undated data claims** (check-rules-current): any number with a data unit needs a nearby date, or the `<!-- undated-ok -->` marker, or phrase it as a rule not a measurement.
- **Every backticked path must exist** (check-rules-current paths-exist): cite real files/routes only.
- **Derive facts, do not invent (spec §2.2):** table lists come from `grep <file> docs/generated/system-map.md`; routes from real `page.tsx`; `BR-*` codes must exist in `docs/BUSINESS-RULES.md`.
- **Two table-name casings are the same table:** the generated map shows both e.g. `Products` (from a `sheets_db` call) and `products` (from an RPC body). When a flow-decl `tables:` value or a hand-map relation must match the generated map, copy the casing verbatim from the generated map; explain the duplication once in `SYSTEM-OVERVIEW.md` and `SYSTEM-MAP.md`.
- **Verification per doc:** after writing, `npx vite-node scripts/doc-checks/run-blocking.ts` must stay all-`[docs] PASS`, and `npx vite-node scripts/check-rules-current.ts` clean.
- **This plan is implemented by Sonnet**, one task per subagent, Claude reviews between.

---

## Current-state description (mandatory, `CLAUDE.md` §1b)

1. **States / how set:** documentation files; each either exists or not, and either passes the gates or not. A workflow doc's `flow-decl` block is its machine-checkable state.
2. **Entry points:** none in the app; these are files under `docs/` read by people and by the gates.
3. **What the set contains / excludes:** 10 workflow docs (one per screen group, §3.5), one hand map, glossary, overview, incident runbook. Excludes `BUSINESS-RULES.md` (Phase 3), the generated files (machine-owned), and any content copied from deleted records.
4. **Valid inputs / out-of-range:** facts must trace to live source; a cited path or `BR-*` that does not exist fails `check-rules-current` at commit.
5. **Deliberately NOT served:** this phase does not verify prose correctness beyond declared facts (spec §5.1), does not touch code, does not delete anything (Phase 5).

**Already done in Phase 1 (do not redo):** `docs/01-system/SYSTEM-MAP.md` exists as a 2-relation seed; `docs/03-workflows/stock-issue.md` exists as a seed covering only the manual-issue flow; `docs/generated/system-map.md` and `docs/generated/README.md` exist.

---

## The ten flows and their real write-path files (derived from `docs/generated/system-map.md`, 2026-09-03)

Each flow's covered files and routes. Tables are NOT hard-coded here — derive them per task by `grep "<file>" docs/generated/system-map.md`. A flow with no write file (reports) declares empty `files`/`tables`.

| Flow doc | Routes (real `page.tsx`) | Write-path files (from the generated map) |
|---|---|---|
| `sales.md` | `/pos`, `/admin/orders`, `/admin/promotions` | `app/pos/actions.ts`, `lib/void-order-transaction.ts`, `app/admin/promotions/actions.ts` |
| `purchasing.md` | `/admin/inventory/purchase-orders`, `/admin/inventory/purchase-orders/new`, `/admin/inventory/purchase-orders/[id]`, `/admin/suppliers` | `lib/purchase-order-transaction.ts`, `app/admin/inventory/purchase-orders/actions.ts`, `app/admin/suppliers/actions.ts` |
| `stock-issue.md` (extend seed) | `/admin/inventory/issue-slips`, `/admin/inventory/stock-adjustments` | `lib/manual-issue-transaction.ts` (seed), `lib/stock-adjustment-transaction.ts`, `app/admin/inventory/actions.ts` |
| `stocktake.md` | `/admin/inventory/stocktake` | `lib/stocktake-transaction.ts` |
| `assets.md` | `/admin/inventory/assets`, `/admin/inventory/asset-bands` | `app/admin/inventory/assets/actions.ts`, `app/admin/inventory/asset-bands/actions.ts` |
| `reports.md` | `/admin`, `/admin/reports/daily`, `/admin/reports/sales`, `/admin/reports/issued` | (none — read-only) |
| `product-catalog.md` | `/admin/products`, `/admin/products/categories`, `/admin/products/modifiers`, `/admin/products/toppings` | `app/admin/products/actions.ts`, `lib/product-save-transaction.ts`, `lib/product-erase-transaction.ts`, `app/admin/products/categories/actions.ts`, `app/admin/products/modifiers/actions.ts`, `app/admin/products/toppings/actions.ts` |
| `inventory-catalog.md` | `/admin/inventory/items`, `/admin/inventory/categories`, `/admin/inventory/units`, `/admin/inventory/conversions` | `app/admin/inventory/actions.ts`, `app/admin/inventory/items/actions.ts`, `app/admin/inventory/conversions/actions.ts` |
| `users.md` | `/login`, `/admin/users`, `/admin/users/edit/[id]`, `/settings/password` | `app/actions/auth.ts`, `app/admin/users/actions.ts` |
| `operations.md` | `/admin/pos-sync`, `/admin/outlets`, `/admin/brands`, `/admin/activity-log`, `/admin/clear-cache` | `app/admin/pos-sync/actions.ts`, `app/admin/outlets/actions.ts`, `app/admin/brands/actions.ts` |

Note: `app/admin/inventory/actions.ts` writes tables spanning both inventory-catalog and stock-issue (it writes `Stock_Adjustments`). It is declared in BOTH flows' `files:`. `checkFlowFacts` only requires each declared table be written by SOME declared file, so this is fine; and because the file is covered, ALL its relations must appear in the completed hand map (Task 1 guarantees that).

---

## Task 1: Complete the hand system map with every write relation

Before any flow doc, extend `docs/01-system/SYSTEM-MAP.md` so its `relations` block lists **every** write relation from the generated map. This way, as each later task declares its files (making them "covered"), the map-drift gate already has their relations. Extra relations beyond covered files are harmless (map-drift only flags MISSING covered relations).

**Files:**
- Modify: `docs/01-system/SYSTEM-MAP.md`

- [ ] **Step 1: Extract every generated write relation**

Run: `sed -n '/```relations/,/```/p' docs/generated/system-map.md`
This is the authoritative list. Copy every `file -> table (write)` line verbatim.

- [ ] **Step 2: Rewrite `docs/01-system/SYSTEM-MAP.md`**

Keep the existing prose intro and the `sheets_db` naming-trap note. Replace the seed's 2-line `relations` block with a block containing ALL the lines from Step 1 (verbatim, casing preserved). Add a short prose section grouping the relations by area (sales, inventory, purchasing, products, assets, stocktake, users, operations) for human reading — but the machine only reads the fenced `relations` block. Add a one-line note: "Two casings of a name (e.g. `Products`/`products`) are the same table — see SYSTEM-OVERVIEW." Keep the whole file under 200 lines (if the prose pushes it over, trim prose, never the relations block).

- [ ] **Step 3: Verify the gate is green**

Run: `npx vite-node scripts/doc-checks/run-blocking.ts`
Expected: all `[docs] PASS`. In particular map-drift PASS (the hand map now covers the one covered flow — stock-issue — and having extra relations is fine).

Run: `npx vite-node scripts/check-rules-current.ts`
Expected: clean (paths-exist PASS — every relation's file path must exist).

- [ ] **Step 4: Commit**

```bash
git add docs/01-system/SYSTEM-MAP.md
git commit -m "docs(map): complete hand system map with all write relations"
```

---

## Task 2: Flow doc procedure (worked on `stock-issue.md`, extending the seed)

This task establishes the exact procedure every workflow-doc task follows. It is applied here to complete `stock-issue.md` (currently a manual-issue-only seed) so it also covers stock adjustments.

**Files:**
- Modify: `docs/03-workflows/stock-issue.md`

**The procedure (every flow-doc task repeats this):**

1. **Find the covered files and routes** from the table above for this flow.
2. **Derive the tables:** for each covered file, run `grep "<file>" docs/generated/system-map.md` and collect the table names it writes. The `flow-decl` `tables:` is the union.
3. **Confirm routes exist:** each route has a real `app/<route>/page.tsx`.
4. **Pick BR codes:** `grep` `docs/BUSINESS-RULES.md` for rule codes relevant to this flow; include only codes that exist. If none apply, omit `brCodes` (empty is allowed).
5. **Write the `flow-decl` block** (English), fenced ` ```flow-decl `, keys `routes`, `files`, `tables`, `brCodes`, comma-separated.
6. **Write the five-question prose** (English) — the frame from spec §3.4b/§1b:
   1. What states does this thing have, and how is each set?
   2. What buttons does each screen have, what each does, and which should be hidden when.
   3. What each list/table contains, and what is excluded and why.
   4. What each input accepts as valid, and what happens outside that range.
   5. Which data it serves, and which it deliberately does NOT serve.
   Mark any figure with `<!-- undated-ok -->` or a date, or phrase as a rule.
7. **Add the "measured last" line:** `> Measured against source: 2026-09-03 — via docs/generated/system-map.md` (spec §5.1 mitigation).
8. **Verify:** `run-blocking.ts` all PASS, `check-rules-current.ts` clean. Keep under 200 lines.

- [ ] **Step 1: Derive stock-issue facts**

Run: `grep -E "manual-issue-transaction|stock-adjustment-transaction|admin/inventory/actions" docs/generated/system-map.md`
Expected covered relations: `lib/manual-issue-transaction.ts -> issue_slips`, `-> stock_issues`; `lib/stock-adjustment-transaction.ts -> stock_adjustments`, `-> stock_ledger`; `app/admin/inventory/actions.ts -> Stock_Adjustments` (and other inventory tables — those belong to inventory-catalog, do NOT list them under stock-issue's `tables:`, but the file being covered means all its relations are already in the hand map from Task 1).

- [ ] **Step 2: Rewrite `docs/03-workflows/stock-issue.md`**

Convert the heading to English ("# Stock issue and adjustment flow"). `flow-decl`:

```flow-decl
routes: /admin/inventory/issue-slips, /admin/inventory/stock-adjustments
files: lib/manual-issue-transaction.ts, lib/stock-adjustment-transaction.ts
tables: issue_slips, stock_issues, stock_adjustments
brCodes: BR-COGS-005
```

(Verify `BR-COGS-005` exists first: `grep BR-COGS-005 docs/BUSINESS-RULES.md`. Note the `stock_ledger` write by stock-adjustment-transaction is to a DROPPED table — mention it in the prose as known stale tooling, do NOT list it in `tables:`.) Then the five-question prose covering both issue slips and stock adjustments.

- [ ] **Step 3: Verify and commit**

Run: `npx vite-node scripts/doc-checks/run-blocking.ts` (all PASS) and `npx vite-node scripts/check-rules-current.ts` (clean).

```bash
git add docs/03-workflows/stock-issue.md
git commit -m "docs(flow): complete stock-issue flow (issue slips + adjustments)"
```

---

## Tasks 3–11: The remaining nine workflow docs

Each follows the Task 2 procedure exactly, with its own row from the flows table. One task per doc. For each: derive tables via grep, confirm routes, pick existing BR codes, write flow-decl + five-question prose in English, add the measured-last line, verify both gates, commit as `docs(flow): <name>`.

- [ ] **Task 3 — `docs/03-workflows/sales.md`** (POS, orders, promotions). Files: `app/pos/actions.ts`, `lib/void-order-transaction.ts`, `app/admin/promotions/actions.ts`. Derive tables via grep (expect `POS_Drafts`, `Pos_Sync_Failures`, `orders_v2`, `order_events`, `Promotions`). Cover the supersede/void model (spec §10: edits create a new COMPLETED row, old becomes SUPERSEDED, same order code) and the `BR-SALE-*` rules. Note POS writes only drafts + sync-failure records; the completed sale is written by the POS device sync, and voids go through `void_order_atomic`.

- [ ] **Task 4 — `docs/03-workflows/purchasing.md`** (purchase orders, suppliers). Files: `lib/purchase-order-transaction.ts`, `app/admin/inventory/purchase-orders/actions.ts`, `app/admin/suppliers/actions.ts`. Derive tables (expect `purchase_orders`, `purchase_order_lines`, `Purchase_Sources`, `purchase_order_edits`, `assets`, `Suppliers`; `stock_ledger` is a dropped table still written by the RPC — note as stale, don't list). Relevant rules: `BR-INV-*` on purchasing/receiving. Explain that receiving a purchase raises stock and that durable tools bought on a PO create `assets` rows.

- [ ] **Task 5 — `docs/03-workflows/stocktake.md`** (count sessions). Files: `lib/stocktake-transaction.ts`. Tables: `stocktake_sessions`, `stocktake_lines`, `stock_issues` (a closed count books its shortfall as an issue). Rules: `BR-INV-007` (count sealed packages only), `BR-COGS-007` (a stocktake gap is loss only if the period had issue slips). Explain open→count→close and that the first count carries months of accumulated difference (spec §10).

- [ ] **Task 6 — `docs/03-workflows/assets.md`** (tools, depreciation, disposal). Files: `app/admin/inventory/assets/actions.ts`, `app/admin/inventory/asset-bands/actions.ts`. Tables: `asset_disposals`, `asset_depreciation_bands` (and `assets` is created via purchasing — cross-reference, do not double-declare). Explain the register answers "what the shop owns," an ended-term asset stays listed at 0đ until disposed, and disposal is insert-only into `asset_disposals` (never a downward mutation). Depreciation bands are owner-editable (spec §7 flexibility rule).

- [ ] **Task 7 — `docs/03-workflows/reports.md`** (dashboard + three reports). Files: none (read-only) → `flow-decl` with empty `files:` and `tables:` and the four routes. Explain each report's source: revenue from `orders_v2` filtered to `COMPLETED` with empty `superseded_by` (spec §10, avoid double counting); COGS from `stock_issues` split by `source` (`MANUAL` vs `STOCKTAKE`), and that the two must not be summed as one month's cost. No `BR` needed unless a reporting rule code exists (`BR-COGS-*` on reporting — check).

- [ ] **Task 8 — `docs/03-workflows/product-catalog.md`** (items, variants, categories, modifiers, toppings, price). Files: `app/admin/products/actions.ts`, `lib/product-save-transaction.ts`, `lib/product-erase-transaction.ts`, `app/admin/products/categories/actions.ts`, `app/admin/products/modifiers/actions.ts`, `app/admin/products/toppings/actions.ts`. Tables via grep (expect `Products`/`products`, `Product_Variants`/`product_variants`, `product_price_history`, `recipes`, `Product_Categories`, `Modifiers`). Rules: `BR-CATALOG-*`. Explain: a never-sold product can be hard-deleted (erase transaction) but a once-sold one only hidden (spec risk table); saving a product also writes its recipe snapshot and price history.

- [ ] **Task 9 — `docs/03-workflows/inventory-catalog.md`** (ingredients, categories, units, conversions). Files: `app/admin/inventory/actions.ts`, `app/admin/inventory/items/actions.ts`, `app/admin/inventory/conversions/actions.ts`. Tables via grep (expect `Purchased_Items`, `Item_Categories`, `Units`, `UOM_Conversions`, `Purchase_Order_Lines`). Rules: `BR-INV-*`. Explain unit-of-measure conversions and that ingredients are never deleted, only marked inactive (RESTRICT foreign keys).

- [ ] **Task 10 — `docs/03-workflows/users.md`** (login, users, roles, password). Files: `app/actions/auth.ts`, `app/admin/users/actions.ts`. Tables: `users`/`Users`. Rules: `BR-ACCESS-*`. Note the direct `supabase.from("users").update(...)` password write in `auth.ts` (the round-9 finding) and that role permissions are intended/observed/verified-labelled (spec `BR-U-003`).

- [ ] **Task 11 — `docs/03-workflows/operations.md`** (POS sync, outlets, brands, activity log, cache). Files: `app/admin/pos-sync/actions.ts`, `app/admin/outlets/actions.ts`, `app/admin/brands/actions.ts`. Tables via grep (expect `Pos_Sync_Failures`, `Outlets`, `Brands`). Explain the two outlets `001`/`002` each bound to a brand, shared warehouse (spec §10), and that clear-cache/activity-log are operational tools with no business-table writes.

---

## Task 12: `docs/02-rules/GLOSSARY.md` (Vietnamese)

**Files:** Create `docs/02-rules/GLOSSARY.md` (create `docs/02-rules/` if absent).

- [ ] **Step 1: Gather terms from real source**

Terms readers hit: `orders_v2`/`order_lines_v2`, SUPERSEDED/COMPLETED, `stock_issues` (source MANUAL vs STOCKTAKE), weighted-average cost, `issue_slips`, stocktake, `asset_disposals`, depreciation band, BTP (bán thành phẩm), điểm bán/outlet, thương hiệu/brand, `sheets_db` (the Supabase adapter with a Sheets name). Confirm each named table exists in `docs/generated/system-map.md`.

- [ ] **Step 2: Write GLOSSARY.md in Vietnamese**

One term per row: term, plain-Vietnamese meaning, and where it shows up. Use real names not codes (memory: "Trứng gà" not "NNL-007"). Keep under 200 lines; if over, that is a signal the glossary is doing too much — split by area only if truly needed.

- [ ] **Step 3: Verify and commit**

`npx vite-node scripts/check-rules-current.ts` clean (every backticked table/path must exist); `run-blocking.ts` all PASS.

```bash
git add docs/02-rules/GLOSSARY.md
git commit -m "docs(glossary): term dictionary in Vietnamese"
```

---

## Task 13: `docs/01-system/SYSTEM-OVERVIEW.md` (Vietnamese)

**Files:** Create `docs/01-system/SYSTEM-OVERVIEW.md`.

- [ ] **Step 1: Write the overview — ONLY what the shop is (spec §3.2b boundary)**

Vietnamese. Cover, at concept level only: a drinks shop, two outlets `001`/`002` each with a brand (Phin Đi, Uchako), takeaway/cart, one shared warehouse; money-in path (POS → `orders_v2`); money-out path (cost measured when goods leave stock, not at sale — weighted average; sale does not deduct stock since the 2026-08-07 cutover). **Do NOT list features** (that is the workflow docs' job) — listing features turns this into a stale summary. Explain the `sheets_db` naming trap and the two-casings-one-table point once, here. Note the Singapore deploy-region requirement (spec §10).

- [ ] **Step 2: Verify and commit**

`check-rules-current.ts` clean; `run-blocking.ts` PASS; under 200 lines.

```bash
git add docs/01-system/SYSTEM-OVERVIEW.md
git commit -m "docs(overview): what the shop and system are, in Vietnamese"
```

---

## Task 14: `docs/04-operations/INCIDENT-RESPONSE.md` (English)

Rebuild the recovery runbook from the real backup tooling (spec §2.8: reconstruct from the live tool, do not copy the deleted `restore-from-backup.md`).

**Files:** Create `docs/04-operations/INCIDENT-RESPONSE.md`.

- [ ] **Step 1: Find the real backup/restore tooling**

Run: `ls scripts/ | grep -iE "backup|restore"` and read the Google-Sheets/Drive backup operation doc if it still exists, and any backup script. Base the runbook on what actually exists now, not on the deleted doc's remembered content.

- [ ] **Step 2: Write the runbook (English)**

Cover the incidents spec §3.2 names: restoring data after loss (from whatever backup mechanism actually exists), POS sync failing (see `Pos_Sync_Failures` and the pos-sync screen), a migration applied wrong, the web build failing. For each: symptom → first check → action. Keep it findable and short (under 200 lines). Only reference files/scripts that exist.

- [ ] **Step 3: Verify and commit**

`check-rules-current.ts` clean (paths must exist); `run-blocking.ts` PASS.

```bash
git add docs/04-operations/INCIDENT-RESPONSE.md
git commit -m "docs(ops): incident-response runbook rebuilt from live tooling"
```

---

## Task 15: Full Phase-2 verification

- [ ] **Step 1: Every gate, whole tree**

Run: `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts`
Expected: tsc 0 errors; vitest all green; rules clean; docs all PASS. In particular, with all 10 flow docs now declaring their files, map-drift now compares the FULL set of covered relations against the completed hand map — it must still PASS, proving the hand map (Task 1) and every flow-decl agree with the generated map.

- [ ] **Step 2: Confirm the doc set is complete and consistent**

Run: `ls docs/01-system docs/02-rules docs/03-workflows docs/04-operations`
Expected: `01-system/SYSTEM-OVERVIEW.md` + `SYSTEM-MAP.md`; `02-rules/GLOSSARY.md`; `03-workflows/` all ten flow files; `04-operations/INCIDENT-RESPONSE.md` + `OPEN-ITEMS.md`.

- [ ] **Step 3: Report for owner review**

Summarize in Vietnamese what each doc says at a glance, and surface anything the derivation revealed (e.g. stale `stock_ledger` writes still in two RPCs). Do not start Phase 3 — owner approves after each phase (spec §2.12).

---

## Self-Review

**Spec coverage:** 10 workflow docs (§3.5) → Tasks 2–11; hand map completion (§3.6) → Task 1; GLOSSARY (§3.2) → Task 12; SYSTEM-OVERVIEW (§3.2b boundary) → Task 13; INCIDENT-RESPONSE (§2.8) → Task 14; language split (§2.17) → Global Constraints. BUSINESS-RULES split is correctly deferred to Phase 3.

**Placeholder scan:** Per-flow tasks name exact files/routes and give the derivation command for tables rather than hard-coding table lists — this is deliberate (spec §7.1: store the command, not the data), not a placeholder. The five-question frame is fully enumerated in Task 2 and referenced by number, not re-derived.

**Ordering:** Task 1 (complete hand map) precedes all flow docs so every flow's relations are already present when its files become covered — no map-drift failure window. Task 15 re-verifies the whole set once all files are covered.

**Consistency:** every task verifies with the same two commands; every doc obeys the 200-line ceiling and paths-exist gate; casing duplication is handled by copying from the generated map verbatim and explained once in the overview and map.

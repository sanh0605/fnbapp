# `lib/` dependency map, re-measured — 2026-08-10

Status: evidence for the phase 3 restructure (`docs/OPEN-ITEMS.md` item 27)
Supersedes nothing — `docs/audits/2026-08-02-lib-dependency-map.md` stays as
history. This is a full re-measurement, not a patch on the old numbers: Plan C
and Plan D added and deleted enough that patching the old file would have
mixed pre- and post-cutover code under one count.

**Read-only.** Nothing moved, renamed, or created a directory. One new script
(`scripts/audit-lib-dependency-map.ts`) is the only code change, and it is the
measurement tool itself, kept so this can be re-run identically later.

## Method

`npx vite-node scripts/audit-lib-dependency-map.ts` — full output saved this
run at `scratchpad/lib-audit-output.txt` (not committed, regenerate on demand).

Walks `app/`, `lib/`, `components/`, `scripts/`, `types/` for every `.ts`/
`.tsx` file. For each file, regexes out every import specifier from three
forms — `from "..."`, `require("...")`, `import("...")` — then resolves each
specifier against the *importing file's own directory* (for anything starting
with `.`) or the repo root (for `@/...`, matching `tsconfig.json`'s `"@/*":
["./*"]`), trying `.ts`/`.tsx`/`/index.ts`/`/index.tsx`. This is a resolver,
not a fixed set of four regexes — it catches `@/lib/x`, `../lib/x`, `./x`,
`../x`, and any deeper relative form (`../../lib/x`) the same way, which is
what the 2026-08-02 method's fixed patterns could not do. That method matched
only `@/lib/x` and `./x` and undercounted by 5x because `../lib/x` (61 places
in `scripts/`) matched neither pattern. A module's own co-located test file
(`X.test.ts` importing `./X`) is excluded from its importer count — testing a
module is not the same as something depending on it.

**Control check, before trusting any number below.** `lib/sheets_db.ts`'s
importer count came out **162**, high enough to be worth distrusting on
sight. A manual `grep -rlE` for `from "...sheets_db"` and `import("...
sheets_db")` found only 150 — a real gap. Tracing it: the gap was **12 files
using `require("../lib/sheets_db")`** (CommonJS, e.g.
`scripts/check-mod-recipes.ts`), which my manual grep's pattern didn't
include but the script's own `REQUIRE_RE` does. Re-running the manual check
with `require(...)` added closed the gap to zero — the two file sets are
identical, only differently ordered. **The script was right; the hand-check
was incomplete**, which is itself the same lesson the 2026-08-02 note
recorded: a manual pattern silently misses whatever form it wasn't written
for. Two more direct spot-checks, chosen because their real answer was
already known from this week's own work: `lib/stocktake-package-lines.ts`
→ exactly 2 importers, `app/admin/inventory/issue-slips/actions.ts` and
`app/admin/inventory/stocktake/actions.ts` (correct — D14/D15 built both);
`lib/conversion-countability.ts` → exactly 1, `app/admin/inventory/
conversions/actions.ts` (correct — D15 wrote it single-purpose). `lib/
auth.ts` also reproduced the *exact same* importer count as the 2026-08-02
audit, 33 — a useful cross-run consistency signal on a module whose call
sites have not changed.

## 1. How many modules

**106 modules in `lib/` today** (86 top-level + 20 in subdirectories), up
from 78 on 2026-08-02 — all top-level, none in a subdirectory. **4 new
subdirectories** since then, matching the owner's own count: `backdated-
ledger`, `backdated-recipe-events`, `history-ops`, `__tests__` (the last is
shared test fixtures, not a business module — one file, `fixtures.ts`).

## 2. Zero importers — 8, not 3

`crypto.ts` and `sheets.ts` carry over unchanged from 2026-08-02's list of 3.
**`sheets-source.ts` dropped off that list** — it now has 2 scripts-only
importers it did not have then. **6 are new:**

| Module | Note |
|---|---|
| `crypto.ts` | Carried over, unreferenced since at least 2026-08-02 |
| `sheets.ts` | Carried over, unreferenced since at least 2026-08-02 |
| `history-ops/gate4-mac-drift-classification.ts` | New subdirectory, never wired to a caller |
| `history-ops/negative-stock-resolution.ts` | Same |
| `history-ops/purchase-cost-recovery.ts` | Imports `purchase-ledger-audit.ts` but nothing imports it back |
| `order-ledger-read-scope.ts` | Imports `inventory-consumption.ts` + `order-types.ts`, nothing imports it |
| `production-order-transaction.ts` | **Real finding, not a scan artifact**: `app/admin/production/actions.test.ts` still `vi.mock`s this module, but `app/admin/production/actions.ts` no longer imports it at all — checked directly. A stale mock in a test, and a module orphaned by Plan C's move away from implicit production-order writes at sale time (`CLAUDE.md` section 7: "không còn lệnh nấu ngầm") |
| `sheets-db-v2.ts` | Imports `order-types.ts` + `sheets_db.ts`, nothing imports it |

Candidates only — none deleted, per the task.

## 3. Used only by `scripts/` — 31, not 6

Every one of these is one-off audit or historical-correction tooling,
correctly living in `lib/` for testability, same category the 2026-08-02
audit named for its smaller list of 6: `admin-auth-guard-audit`, `backup-
restore`, `cogs-drift-audit`, `duplicate-item-audit`, `full-history-ledger-
audit`, `full-history-recompute`, `history-ops/backdated-historical-gap-
lock`, `history-ops/btp-drift-lock`, `history-ops/btp-shortfall-reprocess`,
`history-ops/cogs5-pipeline-audit`, `history-ops/hong-luc-migration-
transaction`, `history-ops/mac-drift-baseline`, `history-ops/migrate-v1-to-
v2`, `history-ops/task-3-recovery`, `inventory-balance-audit`, `item-balance-
summary`, `order-ledger-audit`, `phase4-rebuild-scope`, `phase5-cost-scope`,
`po-header-lines-audit`, `pos-inventory-state`, `production-stock-audit`,
`purchase-order-rpc-readiness`, `recipe-history-audit`, `script-cleanup-
tools`, `semi-product-yield-audit`, `sheet-content-audit`, `sheet-usage-
audit`, `sheets-source`, `stock-adjustment-audit`, `void-order-ledger-
repair`.

**The 5x jump (6 → 31) is Plan C/D's own volume of one-off correction work,
not a scan-method artifact** — the 2026-08-02 count used the same broken
method that undercounted everything else, so its "6" was itself an
undercount on top of being a smaller, earlier codebase. Both effects point
the same direction.

## 4. Full importer / importee table

Kept as data, not reproduced row-by-row here at full width — a hub like
`sheets_db.ts` has 162 individual importers, and listing all of them for all
106 modules would make this file mostly unreadable noise. What follows: the
hub table (§ below) gives every importer-heavy module's total and its
domain-cluster breakdown; § 5's per-cluster tables give every module's exact
importer **count** and, for anything with 12 or fewer importers (94 of the
106), the importers **themselves**, which is enough to read `lib/x`'s callers
directly off the table. The full nested JSON (`module → importers[] →
importsFromLib[]`) for all 106 is what `scripts/audit-lib-dependency-map.ts`
prints — re-run it for the complete list; it is the same command that
produced everything in this file.

### Hubs (≥10 importers)

| Module | Importers | 2026-08-02 | Delta | Live business-domain callers |
|---|---:|---:|---:|---|
| `sheets_db.ts` | 162 | 52 | +110 | INFRA (every domain) |
| `supabase.ts` | 94 | 62 | +32 | INFRA (every domain) |
| `order-types.ts` | 53 | 28 | +25 | INFRA (shared types) |
| `format.ts` | 34 | 35 | −1 | INFRA (every domain) |
| `auth.ts` | 33 | 33 | 0 | INFRA (every domain) |
| `inventory-consumption.ts` | 26 | 16 | +10 | **none** — see § 6 |
| `mac-cogs.ts` | 22 | 16 | +6 | CATALOG only (`app/admin/products/**`, 2 files) — see § 6 |
| `shared-actions.ts` | 17 | 16 | +1 | INFRA |
| `datetime.ts` | 13 | 13 | 0 | INFRA |
| `dialog.ts` | 12 | 10 | +2 | INFRA (UI) |
| `recipe-selection.ts` | 12 | 10 | +2 | CATALOG + SALE — see § 6 |
| `full-history-recompute.ts` | 11 | *(not a hub)* | new | **none** — scripts-only |

`sheets_db` overtook `supabase` for the #1 spot (was #2 on 2026-08-02).
`auth.ts` is exact-identical, a genuine coincidence worth noting rather than
suspecting: its 33 call sites have not changed even though the surrounding
codebase grew by 28 modules.

## 5. Business-domain clusters

Assigned by each module's actual **subject** (what it computes or writes),
cross-checked against which `app/` directories really import it — not by
name alone. `order-types.ts` again wears a domain name it does not deserve
(`order`) while being pure shared types, same finding as 2026-08-02.

Historical/audit tooling (§ 3's 31 scripts-only modules, plus the zero-
importer ones) is clustered by subject too, since the task asked to cluster
everything — but it is flagged **`[tooling]`** in each table, because it is
categorically different from live business logic: it exists to fix past
data, not to run the shop today. A domain restructure can move `[tooling]`
modules into a `history/`-shaped area under their domain, or out of the
live-code tree entirely, without touching how any screen behaves.

### Kho & giá vốn (inventory & COGS) — 56 modules

| Module | Importers | Note |
|---|---:|---|
| `conversion-countability.ts` | 1 | `app/admin/inventory/conversions/actions.ts` (D15) |
| `issue-slip-warnings.ts` | 1 | `IssueSlipClient.tsx` |
| `item-purchase-history.ts` | 4 | items + purchase-orders screens |
| `manual-issue-transaction.ts` | 2 | issue-slips actions + client (D7b/D9/D14) |
| `purchase-order-edit-gate.ts` | 1 | PO detail page |
| `purchase-order-transaction.ts` | 1 | PO actions |
| `purchase-order-write-plan.ts` | 1 | PO actions |
| `purchased-item-onhand.ts` | 2 | issue-slips + stocktake actions |
| `reorder-suggestion.ts` | 2 | inventory actions + `ReorderSuggestionTable.tsx` (switched off per `docs/OPEN-ITEMS.md` item 33, still wired) |
| `stock-adjustment-transaction.ts` | 1 | inventory actions |
| `stocktake-package-lines.ts` | 2 | stocktake + issue-slips actions (D6/D15) |
| `stocktake-transaction.ts` | 2 | stocktake actions + client |
| `purchase-line-base-quantity.ts` | 2 | `[tooling]` purchase-ledger-rebuild + 1 script |
| `purchase-ledger-rebuild.ts` | 3 | `[tooling]` |
| `purchase-ledger-audit.ts` | 3 | `[tooling]` |
| `fifo-tracker.ts` | 5 | feeds `order-cogs-fifo`/`report-v2-allocators` — no live caller of its own, audit-adjacent |
| `mac-cogs-audit.ts` | 5 | `[tooling]` |
| `cogs-drift-audit.ts` | 1 | `[tooling]` |
| `admin-auth-guard-audit.ts` | 3 | `[tooling]` (security audit, filed here for lack of a better subject — really cross-cutting) |
| `backup-restore.ts` | 1 | `[tooling]` |
| `duplicate-item-audit.ts` | 1 | `[tooling]` |
| `full-history-ledger-audit.ts` | 1 | `[tooling]` |
| `full-history-recompute.ts` | 11 | `[tooling]`, hub |
| `inventory-balance-audit.ts` | 1 | `[tooling]` |
| `item-balance-summary.ts` | 1 | `[tooling]` |
| `order-ledger-audit.ts` | 5 | `[tooling]` |
| `order-ledger-read-scope.ts` | 0 | `[tooling]`, zero importers (§ 2) |
| `phase4-rebuild-scope.ts` | 1 | `[tooling]` |
| `phase5-cost-scope.ts` | 1 | `[tooling]` |
| `po-header-lines-audit.ts` | 1 | `[tooling]` |
| `production-order-transaction.ts` | 0 | `[tooling]`, zero importers, orphaned (§ 2) |
| `production-stock-audit.ts` | 1 | `[tooling]` |
| `purchase-order-rpc-readiness.ts` | 1 | `[tooling]` |
| `recipe-history-audit.ts` | 1 | `[tooling]` (recipe-subject but files a cost/history question, not a catalog edit) |
| `semi-product-yield-audit.ts` | 1 | `[tooling]` |
| `stock-adjustment-audit.ts` | 1 | `[tooling]` |
| `stock-ledger-history.ts` | 1 | `StockLedgerHistoryButton.tsx` — live, INV |
| `void-order-ledger-repair.ts` | 1 | `[tooling]` |
| `pos-inventory-state.ts` | 1 | `[tooling]` (1 audit script only — see § 6, not live) |
| `inventory-consumption.ts` | 26 | hub, `[tooling]`-only live path — see § 6 |
| `mac-cogs.ts` | 22 | hub — see § 6 |
| `history-ops/backdated-historical-gap-lock.ts` | 1 | `[tooling]` |
| `history-ops/btp-drift-lock.ts` | 1 | `[tooling]` |
| `history-ops/btp-shortfall-reprocess.ts` | 1 | `[tooling]` |
| `history-ops/cogs5-pipeline-audit.ts` | 1 | `[tooling]` |
| `history-ops/gate4-mac-drift-classification.ts` | 0 | `[tooling]`, zero importers |
| `history-ops/mac-drift-baseline.ts` | 2 | `[tooling]` |
| `history-ops/negative-stock-resolution.ts` | 0 | `[tooling]`, zero importers |
| `history-ops/purchase-cost-recovery.ts` | 0 | `[tooling]`, zero importers |
| `history-ops/task-3-recovery.ts` | 1 | `[tooling]` |
| `backdated-ledger/compute-sale-time-cogs.ts` | 7 | `[tooling]` |
| `backdated-ledger/find-affected-lines.ts` | 5 | `[tooling]` |
| `backdated-ledger/recompute-event.ts` | 3 | `[tooling]` |
| `backdated-recipe-events/find-affected-lines.ts` | 2 | `[tooling]` |
| `backdated-recipe-events/recompute-event.ts` | 2 | `[tooling]` |
| `recipe-snapshot-repair.ts` | 2 | `[tooling]` — repairs a cost snapshot stored on an order line, filed INV (the repair's subject is cost) not SALE |

56 rows. Two — `admin-auth-guard-audit.ts` and `pos-inventory-state.ts` —
are cross-cutting tooling filed here for lack of a cleaner home, noted
inline rather than silently placed. This table (and every table below) was
checked programmatically against the script's own 106-module list after a
first hand-written pass missed 3 rows here (`backdated-recipe-events/find-
affected-lines.ts`, `backdated-recipe-events/recompute-event.ts`, `recipe-
snapshot-repair.ts`) — worth stating plainly: the first draft of this
section undercounted by hand for the same reason the 2026-08-02 measurement
did, a manual pass missing what a fixed check catches. The published counts
below are post-correction.

### Bán hàng & đơn (sales & orders) — 18 modules

| Module | Importers | Note |
|---|---:|---|
| `order-cart.ts` | 8 | POS + order-edit, live |
| `order-edit-cart.ts` | 1 | order actions |
| `order-edit-transaction.ts` | 1 | via `sheets-db-v2-edit.ts` |
| `sheets-db-v2-edit.ts` | 2 | order actions |
| `order-math.ts` | 5 | feeds cart/edit-cart, live |
| `order-snapshot.ts` | 3 | feeds cart + recipe-snapshot-repair |
| `pos-captured-at.ts` | 1 | `order-cart.ts` |
| `pos-category-icons.ts` | 1 | `ProductCard.tsx` |
| `pos-checkout-idempotency.ts` | 2 | `POSScreen.tsx` |
| `pos-offline-queue.ts` | 1 | `POSScreen.tsx` |
| `pos-order-transaction.ts` | 1 | `app/pos/actions.ts` |
| `void-order-reversal.ts` | 1 | order actions — writes ledger reversal rows, filed SALE not INV since its only live caller and its own purpose ("void an order") are both order-domain |
| `void-order-transaction.ts` | 1 | order actions, same note |
| `history-ops/migrate-v1-to-v2.ts` | 1 | `[tooling]` |
| `history-ops/hong-luc-migration.ts` | 2 | `[tooling]` — see § 6, cross-domain |
| `history-ops/hong-luc-migration-transaction.ts` | 1 | `[tooling]` |
| `history-ops/hong-luc-migration-rpc-readiness.ts` | 1 | `[tooling]` |
| `history-ops/recovery-snapshot.ts` | 4 | `[tooling]`, generic — see INFRA note below |

18 rows. `recovery-snapshot.ts` is really a generic hashing/snapshot
utility used across several recovery tools, not order-specific; filed here
only because every current importer happens to be order/migration tooling.

### Báo cáo (reports) — 11 modules

| Module | Importers | Note |
|---|---:|---|
| `daily-digest.ts` | 1 | `app/admin/reports/daily/actions.ts` |
| `display-rounding.ts` | 1 | `app/admin/reports/actions.ts` |
| `issue-costing.ts` | 1 | `app/admin/reports/actions.ts` — **the live COGS engine, see § 6** |
| `purchase-order-cost-allocation.ts` | 1 | `app/admin/reports/actions.ts` (D11/BR-COGS-006) |
| `shift-stock-check-config.ts` | 1 | `app/admin/reports/stock/shift-check-actions.ts` |
| `shift-stock-check-transaction.ts` | 2 | same screen + panel |
| `report-time.ts` | 3 | reports + POS — cross, see § 6 |
| `report-v2-allocators.ts` | 3 | reports + admin dashboard + POS — cross, see § 6 |
| `order-cogs.ts` | 1 | feeds `order-cogs-fifo.ts`, no live caller of its own |
| `order-cogs-fifo.ts` | 2 | feeds `report-v2-allocators.ts` |
| `__tests__/fixtures.ts` | 4 | shared test fixtures for report/order tests |

11 rows. `history-ops/cogs5-pipeline-audit.ts` (cost-pipeline subject
overlaps both) is tabled once, under INV, not repeated here.

### Danh mục (catalog) — 4 modules

| Module | Importers | Note |
|---|---:|---|
| `modifier-recipe.ts` | 3 | modifiers screen |
| `product-save-transaction.ts` | 1 | products actions |
| `price-history.ts` | 1 | `HistoryModal.tsx` |
| `recipe-selection.ts` | 12 | hub — see § 6, cross-domain |

### Hạ tầng dùng chung (shared infrastructure) — 17 modules

| Module | Importers | Note |
|---|---:|---|
| `auth.ts` | 33 | hub |
| `client-error-report.ts` | 4 | `app/error.tsx` / `app/global-error.tsx` / API route |
| `crypto.ts` | 0 | zero importers (§ 2) |
| `datetime.ts` | 13 | hub |
| `dialog.ts` | 12 | hub (UI) |
| `format.ts` | 34 | hub |
| `order-types.ts` | 53 | hub — shared types wearing a domain name, not domain logic |
| `shared-actions.ts` | 17 | hub |
| `sheets_db.ts` | 162 | hub, #1 |
| `sheets-db-v2.ts` | 0 | zero importers (§ 2) |
| `sheets-source.ts` | 2 | `[tooling]`, gained since 2026-08-02 (§ 2) |
| `sheets.ts` | 0 | zero importers (§ 2) |
| `supabase.ts` | 94 | hub, #2 |
| `use-filter-form.ts` | 3 | generic filter-form hook, used across 3 unrelated screens — its cross-cluster span (INV+CATALOG) is exactly what makes it infra, not domain logic |
| `sheet-content-audit.ts` | 1 | `[tooling]` |
| `sheet-usage-audit.ts` | 2 | `[tooling]` |
| `script-cleanup-tools.ts` | 2 | `[tooling]` |

17 rows. `display-rounding.ts` (report money-rounding only) and
`admin-auth-guard-audit.ts` / `pos-inventory-state.ts` (filed under INV,
cross-cutting in subject) are deliberately **not** repeated here — each has
exactly one table row, in the cluster its single current use case actually
belongs to.

### Cluster totals

56 (kho & giá vốn) + 18 (bán hàng & đơn) + 11 (báo cáo) + 4 (danh mục) + 17
(hạ tầng) = **106** — every module in one table, no module in two.

## 6. Modules used by more than one cluster — re-checked, not copied

**The 2026-08-02 conclusion ("the tangle is infrastructure, not cross-
domain") is still true for true infrastructure, but the domain-hub half of
it does not hold any more — two of the three "domain engine" hubs it named
are not live domain engines today.**

- **`inventory-consumption.ts` (26 importers): zero are live `app/` code.**
  Every single importer is either `lib/`-internal tooling or a `scripts/`
  audit/correction file. It was a domain engine on 2026-08-02; Plan C's
  cutover (`docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md`) moved
  every live screen off it, and nothing routed a replacement caller back to
  it. It is now historical-tooling-only, wearing a live-sounding name.
- **`mac-cogs.ts` (22 importers): exactly 2 are live, both under
  `app/admin/products/`** (`page.tsx`, `cogs-estimate/page.tsx`) — a
  catalog-side cost *estimate* shown while editing a product, not the real
  COGS report. Every other importer is `lib/`-internal or `scripts/`.
- **The module that actually computes today's live COGS figure is a
  different one the 2026-08-02 map never saw, because it did not exist
  yet: `lib/issue-costing.ts`, built for Plan D, with exactly one caller,
  `app/admin/reports/actions.ts`.** Same for `purchase-order-cost-
  allocation.ts` (D11). Neither is a hub by import count, but both are the
  real center of the COGS calculation today, and both live *downstream of
  reports*, not upstream of inventory screens.
- **This splits "kho" (stock quantity) from "giá vốn" (cost valuation) more
  cleanly than the cluster name suggests.** Every live, non-tooling
  inventory module in § 5's kho table (`stocktake-*`, `manual-issue-
  transaction`, `purchase-order-*`, `purchased-item-onhand`, …) only ever
  writes or reads **quantity** — none of them compute money. Every module
  that computes **money** (`issue-costing`, `purchase-order-cost-
  allocation`, `mac-cogs`, `order-cogs*`, `report-v2-allocators`,
  `fifo-tracker`) is either dead, catalog-estimate-only, or report-only.
  Worth naming for whoever designs the actual split: "kho & giá vốn" as one
  cluster bundles a live quantity-tracking domain with a valuation
  calculation that today belongs entirely to reporting.
- **`recipe-selection.ts` (12 importers) is the one hub that is still a
  genuine, live cross-domain dependency**: 4 catalog callers
  (`app/admin/products/**`) plus `lib/order-cart.ts`, which is live via both
  `app/pos/actions.ts` and `app/admin/orders/actions.ts` (SALE). This is
  ordinary, expected coupling — SALE reads CATALOG's recipe definitions to
  build a cart — not a tangle: the dependency runs one direction only
  (SALE → CATALOG), matching the 2026-08-02 note's own "domains depend
  downward" framing, just not onto a shared *infrastructure* tier as
  written there.
- **Smaller, real cross-cluster cases (REPORT ↔ SALE):** `report-time.ts`
  and `report-v2-allocators.ts` are each imported by both
  `app/admin/reports/actions.ts` and `app/pos/actions.ts` — the POS screen
  computes some report-shaped numbers itself (a same-day summary), a small,
  understandable overlap, not a design problem.
- **`history-ops/hong-luc-migration.ts`** (an ingredient identity merge,
  "Hồng trà" → "Lục trà") is the other real 3-way case: it imports
  `inventory-consumption.ts` and `mac-cogs.ts` (INV) and `recipe-
  selection.ts` (CATALOG) to rewrite stock/ledger rows that recipes and
  orders both reference — `[tooling]`, one-off, not live.
- **A finding the old audit could not have made, because the codebase was
  half this size then: 54 of 106 modules (51%) have zero live `app/`
  importers at all** — either scripts-only (§ 3) or feeding only into other
  such tooling. This is the largest change since 2026-08-02, and it argues
  for treating "historical/audit tooling" as its own concern in the
  restructure, separate from the four business domains, rather than forcing
  every one of these 54 into a domain folder by subject alone.

## 7. Files over ~500 lines

12 files, up from 4 on 2026-08-02. Two of the original four **shrank** —
Plan C removed machinery from both — while the rest are new arrivals, mostly
Plan D's own screens and `lib/sheets_db.ts`'s own growth.

| File | Lines | 2026-08-02 | Delta |
|---|---:|---:|---:|
| `components/POSScreen.tsx` | 1,379 | 1,378 | +1 |
| `lib/history-ops/hong-luc-migration.ts` | 981 | 980 | +1 |
| `app/admin/reports/actions.ts` | 902 | 1,110 | **−208** |
| `components/pos/CartPanel.tsx` | 690 | *(not measured)* | new |
| `app/admin/orders/actions.ts` | 633 | 755 | **−122** |
| `app/admin/orders/OrderTable.tsx` | 604 | *(not measured)* | new |
| `app/admin/inventory/actions.ts` | 600 | *(not measured)* | new |
| `app/admin/inventory/stocktake/components/StocktakeClient.tsx` | 583 | *(did not exist)* | new (D-plan) |
| `lib/sheets_db.ts` | 582 | *(not measured — was under 500)* | grew past the line |
| `lib/history-ops/task-3-recovery.ts` | 546 | *(not measured)* | new |
| `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx` | 540 | *(did not exist)* | new (D-plan) |
| `lib/recipe-history-audit.ts` | 502 | *(not measured)* | new, just over the line |

`app/admin/reports/actions.ts` and `app/admin/orders/actions.ts` both got
**smaller** since 2026-08-02 despite the codebase growing overall — Plan C's
Task 2b/6 removed P&L and correction machinery from both. The two D-plan
screens (`StocktakeClient.tsx`, `IssueSlipClient.tsx`) crossing 500 lines is
new growth from this week's own work, not pre-existing debt.

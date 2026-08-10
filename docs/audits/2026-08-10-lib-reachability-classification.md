# `lib/` reachability classification — Plan E, E1

Status: classification only — nothing moved, renamed, or deleted
Plan: `docs/superpowers/plans/2026-08-10-repo-restructure.md` (E1)
Supersedes nothing: `docs/audits/2026-08-02-lib-dependency-map.md` and
`docs/audits/2026-08-10-lib-dependency-map.md` both stay as history. That
file measured *who imports each module, one hop*. This file answers a
different, narrower question E1 actually needs: *is this module reachable
from something the shop's runtime or mandatory tooling actually invokes,
and if so, does any real code from it execute — or only its types.*

## Why a new method was needed, not a bigger table

Plan E's own challenge round (recorded in the plan itself, section 2a)
found two real errors on the way to this file, both worth restating here
because they are exactly the failure modes this method has to defend
against:

1. **One-hop importer counts are not reachability.** The 2026-08-10 map
   correctly said `lib/inventory-consumption.ts` has no *direct* `app/`
   importer, and Plan E's first draft quoted that as "no live screen uses
   it" — wrong, because `app/admin/products/cogs-estimate/page.tsx` imports
   `lib/mac-cogs.ts`, which imports `lib/inventory-consumption.ts`. A
   one-hop count cannot see a two-hop path. This file does a real
   breadth-first walk from actual roots instead.
2. **Not every edge in that walk means the same thing.** The very edge that
   fixed error 1 (`mac-cogs.ts` → `inventory-consumption.ts`) turned out to
   be `import type { ConsumptionRow } from "@/lib/inventory-consumption"` —
   erased at compile time. No runtime code executes because of it. A graph
   walk that treats type-only and value edges the same way overstates
   "live" by counting declarations as code.

## Method

`npx vite-node scripts/audit-lib-reachability.ts` — full output this run at
`scratchpad/reachability-output.txt` (not committed, regenerate on demand).
The script is committed (`scripts/audit-lib-reachability.ts`) for exact
reproducibility.

**Roots — the only things this repo's runtime or mandatory tooling actually
invokes directly.** The plan's first draft named `app/` and `components/`
broadly; corrected during the challenge round to:

- Next.js special files under `app/**` only: `page.tsx`, `layout.tsx`,
  `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`,
  `global-error.tsx`, `template.tsx`, `default.tsx`, `manifest.ts`.
  **72 files.** A component or Server Action sitting anywhere under `app/`
  is *not* itself a root — it is reached (or not) the same way a `lib/`
  module is, through an import from an actual root.
- `middleware.ts` — a root, though it currently imports nothing from `lib/`.
- `supabase/functions/backup-to-drive/index.ts`,
  `supabase/functions/backup-to-sheets/index.ts`,
  `supabase/functions/user-admin/index.ts` — **three** Edge Functions, not
  one. The plan's first draft named only `backup-to-drive` and asserted it
  imports `lib/backup-restore.ts`; checked directly, the only occurrence of
  that path in the file is a comment about restore ordering, not an import.
  None of the three imports anything from `lib/` today — they are listed so
  a future import is not missed, not because they change any count here.
- `scripts/check-rules-current.ts` — the one script with actual evidence of
  still running: wired into `.husky/pre-commit`, which runs on every
  commit. Checked all 31 scripts-only `lib/` modules from the 2026-08-10 map
  against `package.json` and `.husky/` for the same evidence; none of the
  other 30 qualifies. `npx vitest run` is deliberately not a root either — a
  module's own test proving it still compiles proves nothing about whether
  the shop uses it, the same rule the plan already applies to orphans.
- `components/**` is **not** an independent root — a component is reached
  through whichever `app/` root actually renders it, and the walk below
  follows that path rather than assuming every component is live by
  default.

**Edge classification.** Every `from "..."`, `require(...)`, and dynamic
`import(...)` in every scanned file (`app/`, `lib/`, `components/`,
`scripts/`, `types/`) is extracted and classified:

- `import type ...` / `export type ...` (whole statement) → **type**.
- `import { type A, type B } from "x"` (every named specifier individually
  marked `type`) → **type**.
- `import { type A, B } from "x"` (**mixed** — at least one specifier is a
  real value) → **value**. TypeScript itself works this way: `B`'s presence
  means the module executes for `B`'s sake regardless of `A`.
- Default imports, namespace imports (`import * as X`), side-effect
  imports, `export * from`, `require(...)`, dynamic `import(...)` → always
  **value**.

**Two edges collapse to the stronger one.** If a file imports the same
module twice (rare, but happens), the pair is **value** if *either*
occurrence is a value edge — a mixed statement in one place does not get
diluted by a type-only statement elsewhere.

**Control check before trusting the parser, done before the full run**: 11
hand-written cases (whole-statement `import type`, mixed named imports, all
type-only named imports, `export type`, `export *`, `require`, dynamic
`import`, default import, namespace import, a real multi-line mixed import
copied from this repo) — **11/11 passed**
(`scratchpad/test-edge-parser.ts`).

**Reachability.** Two breadth-first walks from the same roots, over the
whole file graph (not just `lib/` — a root reaches a `lib/` module through
ordinary non-`lib/` files like a `page.tsx` importing its own
`actions.ts`, and the walk has to cross those files too):

- **`live`**: reachable following **only value edges**. Real code from the
  module executes.
- **`type-only`**: reachable following any mix of edges, but **no
  all-value path exists** — every path from every root crosses at least one
  type-only edge somewhere. The module's declarations are used; its
  runtime code is not.
- **`spent`**: not reachable from a root at all (neither `live` nor
  `type-only`), but something still imports it — `scripts/` tooling, or
  another `lib/` module that itself only feeds `scripts/` tooling.
- **`orphan`**: nothing imports it, from anywhere.

## Control checks against the three named cases — one required a real answer, not the expected one

- **`lib/issue-costing.ts` → `live`.**
  `app/admin/reports/sales/page.tsx → app/admin/reports/actions.ts →
  lib/issue-costing.ts`. Matches expectation.
- **`lib/production-order-transaction.ts` → `orphan`.** Zero importers from
  anywhere. Matches expectation.
- **`lib/inventory-consumption.ts` → `live` — not `type-only`.** This does
  **not** match the expected answer, and the reason is not a parser bug:
  `lib/report-v2-allocators.ts` (itself reachable from `app/admin/page.tsx`,
  `app/admin/reports/actions.ts`, and `app/pos/actions.ts`) contains

  ```ts
  import {
    buildLineConsumptionRows,
    type SemiProductConsumptionMaps,
  } from "@/lib/inventory-consumption";
  ```

  — a genuinely **mixed** import. `buildLineConsumptionRows` carries no
  `type` prefix, and it is not merely imported and unused: `report-v2-
  allocators.ts:204` calls it directly
  (`const consumptionRows = buildLineConsumptionRows(lineRecipe, line.qty,
  balances, consumptionMaps);`). This is a second, independent path into
  `inventory-consumption.ts`, separate from the `mac-cogs.ts` type-only
  path the plan's correction round already found, and this one is real
  code that runs whenever the admin dashboard, the sales report, or POS
  computes per-ingredient consumption. The parser's 11/11 unit result and
  the exact match on the other two control cases say this is not a parser
  defect — `inventory-consumption.ts` has one dead path and one live path,
  and the live one wins the classification, by construction (a module is
  `live` if *any* all-value path reaches it, not only if *every* path
  does). Reported as found rather than adjusted to match the expected
  answer.

  One caveat, stated plainly rather than implied: this file-level walk
  confirms `report-v2-allocators.ts` **imports and calls**
  `buildLineConsumptionRows`. It does not trace whether every caller of
  `report-v2-allocators.ts`'s exported functions actually exercises the
  specific code path containing that call — that is call-graph analysis
  within a single file, a finer grain than any measurement in this plan
  has used so far (including the `mac-cogs.ts` finding, which was a
  whole-statement `import type`, not a per-branch question). Flagged as a
  boundary of this method, not resolved here.

## Result

**54 live / 1 type-only / 43 spent / 8 orphan = 106.**

The 8 orphans are the exact same 8 modules the 2026-08-10 one-hop map
found — expected, since "zero importers from anywhere" cannot change
between a one-hop count and a graph walk; it is the one number the two
methods must agree on exactly, and they do.

Compared with Plan E's own working numbers going into this task (46 direct
/ ~56 walked-but-not-type-aware / 8 orphan): the value-only walk lands at
54 live, one lower than the 56 from the type-unaware walk, because
`lib/order-cogs.ts` moves out of "live" into its own `type-only` bucket —
the only module in that bucket, described in full below.

### Live (54)

Path shown is the first all-value path the breadth-first walk found — not
necessarily the only one (`inventory-consumption.ts` above has at least
two).

_(table below)_

### Type-only (1)

`lib/order-cogs.ts` — the older, MAC-based per-order-line COGS function,
superseded in the live replay path by `lib/order-cogs-fifo.ts` and, for
reporting, by `lib/issue-costing.ts`. Its only remaining connection to a
root is `lib/order-cogs-fifo.ts:11`:

```ts
import type { SemiProductContext } from "@/lib/order-cogs";
```

— checked for any other reference to `@/lib/order-cogs` in that file: none.
`order-cogs.ts`'s own runtime code (its cost-computing function) is never
called by anything reachable from a root. Its one exported *type*,
`SemiProductContext`, is. This is exactly the category Plan E's correction
round asked E1 to carve out: not safe to move wholesale into spent tooling
(a real type is still consumed), not live either (no function body from it
ever executes) — the type wants extracting, the rest does not need to keep
compiling for any live caller's sake.

### Spent (43)

One-off historical/audit tooling from Plans A–D with zero root-reachable
path, still imported by something (mostly `scripts/`, some by other spent
`lib/` tooling). None has evidence of recurring use beyond
`check-rules-current.ts`, already a root and therefore not in this list.

### Orphan (8)

Nothing imports these from anywhere — same 8 as the 2026-08-10 map.

---

## Full tables

### Live (54)

| Module | Path from root |
|---|---|
| `auth.ts` | `app/admin/inventory/purchase-orders/[id]/page.tsx -> lib/auth.ts` |
| `client-error-report.ts` | `app/api/client-errors/route.ts -> lib/client-error-report.ts` |
| `conversion-countability.ts` | `app/admin/inventory/conversions/page.tsx -> app/admin/inventory/conversions/actions.ts -> lib/conversion-countability.ts` |
| `daily-digest.ts` | `app/admin/reports/daily/page.tsx -> app/admin/reports/daily/actions.ts -> lib/daily-digest.ts` |
| `datetime.ts` | `app/admin/activity-log/page.tsx -> app/admin/activity-log/components/ActivityLogClient.tsx -> lib/datetime.ts` |
| `dialog.ts` | `app/admin/inventory/categories/page.tsx -> components/InventoryForms.tsx -> lib/dialog.ts` |
| `display-rounding.ts` | `app/admin/reports/sales/page.tsx -> app/admin/reports/actions.ts -> lib/display-rounding.ts` |
| `fifo-tracker.ts` | `app/admin/page.tsx -> lib/report-v2-allocators.ts -> lib/fifo-tracker.ts` |
| `format.ts` | `app/admin/inventory/purchase-orders/[id]/page.tsx -> lib/format.ts` |
| `inventory-consumption.ts` | `app/admin/page.tsx -> lib/report-v2-allocators.ts -> lib/inventory-consumption.ts` |
| `issue-costing.ts` | `app/admin/reports/sales/page.tsx -> app/admin/reports/actions.ts -> lib/issue-costing.ts` |
| `issue-slip-warnings.ts` | `app/admin/inventory/issue-slips/page.tsx -> app/admin/inventory/issue-slips/components/IssueSlipClient.tsx -> lib/issue-slip-warnings.ts` |
| `item-purchase-history.ts` | `app/admin/inventory/items/page.tsx -> app/admin/inventory/items/actions.ts -> lib/item-purchase-history.ts` |
| `mac-cogs.ts` | `app/admin/products/cogs-estimate/page.tsx -> lib/mac-cogs.ts` |
| `manual-issue-transaction.ts` | `app/admin/inventory/issue-slips/page.tsx -> app/admin/inventory/issue-slips/actions.ts -> lib/manual-issue-transaction.ts` |
| `modifier-recipe.ts` | `app/admin/products/modifiers/page.tsx -> app/admin/products/modifiers/actions.ts -> lib/modifier-recipe.ts` |
| `order-cart.ts` | `app/pos/page.tsx -> app/pos/actions.ts -> lib/order-cart.ts` |
| `order-cogs-fifo.ts` | `app/admin/page.tsx -> lib/report-v2-allocators.ts -> lib/order-cogs-fifo.ts` |
| `order-edit-cart.ts` | `app/admin/orders/page.tsx -> app/admin/orders/actions.ts -> lib/order-edit-cart.ts` |
| `order-edit-transaction.ts` | `app/admin/orders/page.tsx -> app/admin/orders/actions.ts -> lib/sheets-db-v2-edit.ts -> lib/order-edit-transaction.ts` |
| `order-math.ts` | `app/admin/page.tsx -> lib/report-v2-allocators.ts -> lib/order-math.ts` |
| `order-snapshot.ts` | `app/pos/page.tsx -> app/pos/actions.ts -> lib/order-cart.ts -> lib/order-snapshot.ts` |
| `order-types.ts` | `app/admin/page.tsx -> lib/order-types.ts` |
| `pos-captured-at.ts` | `app/pos/page.tsx -> app/pos/actions.ts -> lib/order-cart.ts -> lib/pos-captured-at.ts` |
| `pos-category-icons.ts` | `app/pos/page.tsx -> components/POSScreen.tsx -> components/pos/ProductGrid.tsx -> components/pos/ProductCard.tsx -> lib/pos-category-icons.ts` |
| `pos-checkout-idempotency.ts` | `app/pos/page.tsx -> components/POSScreen.tsx -> lib/pos-checkout-idempotency.ts` |
| `pos-offline-queue.ts` | `app/pos/page.tsx -> components/POSScreen.tsx -> lib/pos-offline-queue.ts` |
| `pos-order-transaction.ts` | `app/pos/page.tsx -> app/pos/actions.ts -> lib/pos-order-transaction.ts` |
| `price-history.ts` | `app/admin/products/page.tsx -> components/HistoryModal.tsx -> lib/price-history.ts` |
| `product-save-transaction.ts` | `app/admin/products/page.tsx -> components/ProductForm.tsx -> app/admin/products/actions.ts -> lib/product-save-transaction.ts` |
| `purchase-ledger-rebuild.ts` | `app/admin/inventory/purchase-orders/page.tsx -> app/admin/inventory/purchase-orders/actions.ts -> lib/purchase-order-write-plan.ts -> lib/purchase-ledger-rebuild.ts` |
| `purchase-line-base-quantity.ts` | `app/admin/inventory/purchase-orders/page.tsx -> app/admin/inventory/purchase-orders/actions.ts -> lib/purchase-order-write-plan.ts -> lib/purchase-ledger-rebuild.ts -> lib/purchase-line-base-quantity.ts` |
| `purchase-order-cost-allocation.ts` | `app/admin/reports/sales/page.tsx -> app/admin/reports/actions.ts -> lib/purchase-order-cost-allocation.ts` |
| `purchase-order-edit-gate.ts` | `app/admin/inventory/purchase-orders/[id]/page.tsx -> lib/purchase-order-edit-gate.ts` |
| `purchase-order-transaction.ts` | `app/admin/inventory/purchase-orders/page.tsx -> app/admin/inventory/purchase-orders/actions.ts -> lib/purchase-order-transaction.ts` |
| `purchase-order-write-plan.ts` | `app/admin/inventory/purchase-orders/page.tsx -> app/admin/inventory/purchase-orders/actions.ts -> lib/purchase-order-write-plan.ts` |
| `purchased-item-onhand.ts` | `app/admin/inventory/issue-slips/page.tsx -> app/admin/inventory/issue-slips/actions.ts -> lib/purchased-item-onhand.ts` |
| `recipe-selection.ts` | `app/admin/products/cogs-estimate/page.tsx -> lib/recipe-selection.ts` |
| `reorder-suggestion.ts` | `app/admin/inventory/categories/page.tsx -> app/admin/inventory/actions.ts -> lib/reorder-suggestion.ts` |
| `report-time.ts` | `app/admin/reports/sales/page.tsx -> app/admin/reports/actions.ts -> lib/report-time.ts` |
| `report-v2-allocators.ts` | `app/admin/page.tsx -> lib/report-v2-allocators.ts` |
| `shared-actions.ts` | `app/admin/inventory/base-ingredients/page.tsx -> app/admin/inventory/base-ingredients/actions.ts -> lib/shared-actions.ts` |
| `sheets_db.ts` | `app/admin/brands/page.tsx -> lib/sheets_db.ts` |
| `sheets-db-v2-edit.ts` | `app/admin/orders/page.tsx -> app/admin/orders/actions.ts -> lib/sheets-db-v2-edit.ts` |
| `shift-stock-check-config.ts` | `app/admin/reports/stock/page.tsx -> app/admin/reports/stock/shift-check-actions.ts -> lib/shift-stock-check-config.ts` |
| `shift-stock-check-transaction.ts` | `app/admin/reports/stock/page.tsx -> app/admin/reports/stock/shift-check-actions.ts -> lib/shift-stock-check-transaction.ts` |
| `stock-adjustment-transaction.ts` | `app/admin/inventory/categories/page.tsx -> app/admin/inventory/actions.ts -> lib/stock-adjustment-transaction.ts` |
| `stock-ledger-history.ts` | `app/admin/reports/stock/page.tsx -> components/StockTable.tsx -> components/StockLedgerHistoryButton.tsx -> lib/stock-ledger-history.ts` |
| `stocktake-package-lines.ts` | `app/admin/inventory/issue-slips/page.tsx -> app/admin/inventory/issue-slips/actions.ts -> lib/stocktake-package-lines.ts` |
| `stocktake-transaction.ts` | `app/admin/inventory/stocktake/page.tsx -> app/admin/inventory/stocktake/actions.ts -> lib/stocktake-transaction.ts` |
| `supabase.ts` | `app/admin/page.tsx -> lib/supabase.ts` |
| `use-filter-form.ts` | `app/admin/inventory/items/page.tsx -> app/admin/inventory/items/components/ItemsClient.tsx -> lib/use-filter-form.ts` |
| `void-order-reversal.ts` | `app/admin/orders/page.tsx -> app/admin/orders/actions.ts -> lib/void-order-reversal.ts` |
| `void-order-transaction.ts` | `app/admin/orders/page.tsx -> app/admin/orders/actions.ts -> lib/void-order-transaction.ts` |

### Type-only (1)

| Module | Path (last edge is type-only) |
|---|---|
| `order-cogs.ts` | `app/admin/page.tsx -> lib/report-v2-allocators.ts -> lib/order-cogs-fifo.ts -> lib/order-cogs.ts` |

### Spent (43)

| Module | Importers |
|---|---:|
| `__tests__/fixtures.ts` | 4 |
| `admin-auth-guard-audit.ts` | 3 |
| `backdated-ledger/compute-sale-time-cogs.ts` | 7 |
| `backdated-ledger/find-affected-lines.ts` | 5 |
| `backdated-ledger/recompute-event.ts` | 3 |
| `backdated-recipe-events/find-affected-lines.ts` | 2 |
| `backdated-recipe-events/recompute-event.ts` | 2 |
| `backup-restore.ts` | 1 |
| `cogs-drift-audit.ts` | 1 |
| `duplicate-item-audit.ts` | 1 |
| `full-history-ledger-audit.ts` | 1 |
| `full-history-recompute.ts` | 11 |
| `history-ops/backdated-historical-gap-lock.ts` | 1 |
| `history-ops/btp-drift-lock.ts` | 1 |
| `history-ops/btp-shortfall-reprocess.ts` | 1 |
| `history-ops/cogs5-pipeline-audit.ts` | 1 |
| `history-ops/hong-luc-migration-rpc-readiness.ts` | 1 |
| `history-ops/hong-luc-migration-transaction.ts` | 1 |
| `history-ops/hong-luc-migration.ts` | 2 |
| `history-ops/mac-drift-baseline.ts` | 2 |
| `history-ops/migrate-v1-to-v2.ts` | 1 |
| `history-ops/recovery-snapshot.ts` | 4 |
| `history-ops/task-3-recovery.ts` | 1 |
| `inventory-balance-audit.ts` | 1 |
| `item-balance-summary.ts` | 1 |
| `mac-cogs-audit.ts` | 5 |
| `order-ledger-audit.ts` | 5 |
| `phase4-rebuild-scope.ts` | 1 |
| `phase5-cost-scope.ts` | 1 |
| `po-header-lines-audit.ts` | 1 |
| `pos-inventory-state.ts` | 1 |
| `production-stock-audit.ts` | 1 |
| `purchase-ledger-audit.ts` | 3 |
| `purchase-order-rpc-readiness.ts` | 1 |
| `recipe-history-audit.ts` | 1 |
| `recipe-snapshot-repair.ts` | 2 |
| `script-cleanup-tools.ts` | 2 |
| `semi-product-yield-audit.ts` | 1 |
| `sheet-content-audit.ts` | 1 |
| `sheet-usage-audit.ts` | 2 |
| `sheets-source.ts` | 2 |
| `stock-adjustment-audit.ts` | 1 |
| `void-order-ledger-repair.ts` | 1 |

### Orphan (8)

| Module |
|---|
| `crypto.ts` |
| `history-ops/gate4-mac-drift-classification.ts` |
| `history-ops/negative-stock-resolution.ts` |
| `history-ops/purchase-cost-recovery.ts` |
| `order-ledger-read-scope.ts` |
| `production-order-transaction.ts` |
| `sheets-db-v2.ts` |
| `sheets.ts` |

---

## What this does and does not decide

This is E1: classification only. No file moved, renamed, or deleted. E2/E3
(segregating spent tooling and orphans) and E4 (the re-test of whether the
54 live modules are genuinely tangled across business domains, gating
whether a domain split happens at all) are separate tasks in the plan, not
executed here.

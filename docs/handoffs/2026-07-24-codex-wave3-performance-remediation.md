# Codex Handoff — Wave 3 Performance Remediation (owner-approved 2026-07-24)

> **READ FIRST**: `docs/COLLABORATION.md` — protocol, merge gate, commit conventions.
> Related plan: `docs/audits/2026-07-24-full-system-reaudit-and-improvement-plan.md` (findings F-8, F-15).

## Context

Owner approved Claude's recommendation to close the remaining full-table-load
performance debt, then explicitly directed that Claude plans and other agents
implement (2026-07-24). Claude validated the approach below by direct code
reading this session but wrote no production code — a briefly started
implementation was fully reverted (`git status` clean at handoff time) so this
work gets an independent implementation and Claude can review it cleanly.

Baseline at handoff: commit `464bac9` + 1 docs commit; `tsc` clean; suite
673/673; live `audit-pnl-mac-consistency.ts` 0 VND delta (1,677 orders);
`audit-current-stock.ts` 3 known negative items; migrations 0001–0034 applied.

Split into two phases with different risk levels. **Commit per phase item.**

---

## Phase A — page-level fixes (recommended: `gpt-5.5` Medium)

### A1. Strip dead out-of-stock work from POS page load

The single highest-value item. Evidence:

- `app/pos/page.tsx:26-39` fetches `getPOSStockStatus()` and `findAll("Recipes")`
  on every POS load, then computes `stockMap` → `pickVariantRecipe` →
  `variantAvailableMap` (lines 52-87) — and **discards all of it** because
  `outOfStockProductIds` is hardcoded `[]` (line 90, owner-disabled feature).
- `getPOSStockStatus` → `loadPOSStockStatus` (`app/pos/actions.ts:315-344`)
  reads the **full `Stock_Ledger`** via `findAllNoCache` — 11,702 rows today,
  growing with every sale — under a 60 s `unstable_cache` whose
  `sheets-Stock_Ledger` tag invalidates on ledger writes. So the hottest page
  pays the system's heaviest query for a feature that renders nothing.

Change:

1. Remove `getPOSStockStatus()` and `findAll("Recipes")` from the page's
   `Promise.all`; delete the dead block (`stockMap`, `pickVariantRecipe`,
   `variantAvailableMap`, `outOfStockProductIds` incl. the commented-out code).
2. Drop the `outOfStockProductIds` prop from the `<POSScreen>` call —
   `components/POSScreen.tsx:24` already defaults it to `[]`; the optional prop
   type (line 33) stays so the contract is unchanged.
3. **Keep** `getPOSStockStatus`/`loadPOSStockStatus` in `app/pos/actions.ts`
   (tested API, referenced by FEATURE-CATALOG `RPT-STOCK`; feature may return).
4. Leave a short comment where the block was: if the out-of-stock feature
   returns, rebuild it on a materialized per-item balance (see B2) and reuse
   `lib/recipe-selection.ts` instead of the inline `pickVariantRecipe` copy,
   which diverges from the canonical recipe-selection logic (no `status`
   filtering, different tie-breaking) — removing it also removes that latent
   divergence risk.

Verify: `next build`; POS page renders and checkout works (existing tests);
no remaining reference to the removed locals.

### A2. Activity log — real database-level pagination

`app/admin/activity-log/page.tsx:7-10` loads full `Order_Events` **and** full
`Orders_V2`; `ActivityLogClient` filters in a `useMemo` and renders every event
with no pagination. `Order_Events` grows ≥1 row per sale — this will be the
first page to degrade badly.

Mirror this week's `getOrdersV2` rebuild (`app/admin/orders/actions.ts:130-259`
and `app/admin/orders/page.tsx` + `OrderTable.tsx:117-211` for the URL-sync
pattern):

1. New `app/admin/activity-log/actions.ts` — `getActivityLogEvents(filters)`:
   - `requireAdmin()` guard (same as `getOrdersV2`).
   - Direct Supabase query on `order_events` with `{ count: "exact" }`,
     `.order("event_at", { ascending: false })`, `.range()` at 20/page.
   - Push filters into the query: `eq("event_type", …)`, `eq("actor_name", …)`,
     `gte/lte("event_at", …)`.
   - Text search needs a two-step because `order_no` lives on `orders_v2`:
     first `orders_v2.select("id").ilike("order_no", %q%).limit(200)`, then a
     single `.or()` combining `id.ilike`, `reason.ilike`, `actor_name.ilike`,
     and `order_id.in.(…)` when matches exist. **Sanitize `(),` out of the
     user's q before embedding it in the `.or()` string** — those characters
     are PostgREST syntax.
   - Enrich only the returned page with `order_no` via
     `findAllWhereInBatches("Orders_V2", "id", pageOrderIds)`.
   - Actor dropdown: single-column `select("actor_name")` + dedupe is
     acceptable (narrow payload); note in code that a distinct view/RPC is the
     upgrade path if it ever gets heavy.
2. `page.tsx` reads `searchParams` (`page`, `q`, `type`, `actor`, `from`, `to`)
   and expands date-only params to full-day bounds exactly like
   `app/admin/orders/page.tsx:10-15`.
3. `ActivityLogClient.tsx`: replace the `useMemo` filtering with the
   OrderTable URL-sync pattern — local state seeded from `searchParams`, a
   back/forward sync `useEffect`, search applies on Enter/"Lọc" button via
   `router.replace`, selects/dates via `router.push`, filter changes reset to
   page 1, Trước/Sau pagination controls. **Preserve the rendering (timeline,
   badges, `renderDelta`) byte-for-byte** — this is a data-path change only.

Verify (parity is the acceptance bar): page 1 unfiltered must show the same
first 20 events (same ids, same order) as the old implementation's sorted
output against live data; each filter must return a subset consistent with the
old client-side logic on a spot-checked window; `tsc`/suite/build clean.

### A3. PERF-1 — stop wasted server round-trips on client-filtered pages

`app/admin/inventory/stock-adjustments/page.tsx` and
`app/admin/promotions/page.tsx`: server components never read `searchParams`;
filtering is 100% client-side over an already-fetched table, yet the filter UI
still drives `router.replace/push`, re-invoking the server fetch for identical
data (at most 1 per explicit "Lọc" since the 2026-07-20 fix).

Change: swap the URL sync to `window.history.replaceState` (keeps
bookmarkability, no Next navigation, zero server refetch). Confirm first that
each page's server component truly ignores `searchParams` — if one actually
consumes them, leave it and note it instead. These tables are small; do NOT
convert them to server-side pagination in this pass (scope control).

### A4. Small cleanup batch

- Add an `app/icon.png` (or equivalent metadata icon) — currently 404s on
  every page load.
- Audit the remaining broad `revalidatePath("/pos")` calls on rare admin
  toggles (promotions/toppings): narrow only where trivially provable; if in
  doubt, leave and list them in the commit body.

---

## Phase B — engine-adjacent (recommended: `gpt-5.6-sol` High; separate commits)

### B1. Upper-bound the full `Stock_Ledger` fetches in void/edit paths

`app/admin/orders/actions.ts:416` and `:484` (`findAllNoCache("Stock_Ledger")`
inside the void/supersede/edit flows) load the entire ledger to build MAC
inputs. The P&L fix's argument (2026-07-24, commit `464bac9`) applies: MAC
needs full history **before** an effective time, never after. But each call
site must be individually proven:

- Determine per site which effective time bounds the recompute (original sale
  time vs. edit time) by reading how the fetched ledger feeds
  `buildInventoryBalances`/`computeMacCostForConsumptionRows`.
- Bound with `created_at <= <provable end>` only where the argument holds; if
  any site can't be safely bounded, leave it and document why.
- Also `:393` (`findAllNoCache("Orders_V2")`) — check whether the void path's
  full-orders read can be replaced with targeted `findById`/`findAllWhere`.

Verify: forced-failure/void tests still pass; live `audit-pnl-mac-consistency`
0 delta after a probe void+re-void-rejection on a test order (or dry
reasoning if no safe probe exists); order-ledger quantity baseline unchanged.

### B2. Design proposal ONLY — materialized current-stock balance

Do not implement in this wave. Produce a reviewed design doc for replacing the
"replay the whole ledger to get current stock" pattern (`getRealtimeStock`,
`loadPOSStockStatus`, stock report) with a maintained per-item balance:

- `Stock_Ledger` stays the auditable source of truth (CLAUDE.md §9);
  the balance is derived state, maintained inside the existing atomic RPCs or
  by trigger — pick and justify.
- Must include: drift-audit script (balance vs. full ledger sum), migration +
  backfill + rollback plan, and how correction scripts/rebuilds interact with
  it (the 2026-07-24 full rebuild deleted/reinserted 18k rows — the design
  must survive that class of operation).
- Claude reviews the design before any implementation is scheduled.

---

## Merge gate (per `docs/COLLABORATION.md` E)

- `tsc --noEmit` 0 errors; full suite green (baseline 673); `next build` passes.
- Live audits when Phase B1 lands: P&L MAC consistency 0 delta; current-stock
  audit shows the same 3 known negatives (no new ones).
- Commit prefix `Codex <type>:`, one commit per phase item. **No push.**
- Stop and ping Claude: any parity check that fails, any schema change that
  seems needed, anything touching `cost_at_sale` semantics.

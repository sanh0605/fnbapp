# Task: Gate 2 Remediation Wave 2 — Admin Read Actions Local Guard

## Context

Gate 2 (`docs/audits/2026-07-18-gate2-access-map.md`) found 21 admin
`READ`-classified Server Actions with no local guard — they rely entirely
on `middleware.ts` route protection (`/admin/:path*`), not on a guard
inside the action itself. This is Wave 2 of the Gate 2 remediation split:
lower risk than Wave 1 (read-only, not financially-material writes), larger
in count, mechanical in shape.

Read `docs/audits/2026-07-18-gate2-access-map.md`'s "Server Action matrix"
section for the authoritative list before starting — the list below is
extracted from that report for convenience but the report is the source of
truth if they disagree.

## Scope

Add a local guard to each of these read actions. Match the guard style
already used by the mutations in the same files (`requireAdmin()` per the
existing Gate 1/2 pattern), so the file stays internally consistent rather
than mixing guard styles:

- `app/admin/brands/actions.ts` — `getBrands`
- `app/admin/inventory/base-ingredients/actions.ts` — `getBaseIngredientsData`
- `app/admin/inventory/conversions/actions.ts` — `getConversionsData`
- `app/admin/inventory/items/actions.ts` — `getItemsData`
- `app/admin/inventory/purchase-orders/actions.ts` — `getPurchaseOrdersData`
- `app/admin/orders/actions.ts` — `getOrdersV2`, `getOrderDetailV2`
- `app/admin/production/actions.ts` — `getProductionData`
- `app/admin/products/categories/actions.ts` — `getCategoriesWithCounts`
- `app/admin/products/modifiers/actions.ts` — `getModifiersData`
- `app/admin/promotions/actions.ts` — `getPromotionsData`
- `app/admin/reports/actions.ts` — `getPnLDataV2`, `getHourlyHeatmapV2`,
  `getPromotionPerformanceV2`
- `app/admin/semi-products/actions.ts` — `getSemiProductsData`
- `app/admin/suppliers/actions.ts` — `getSuppliers`
- `app/admin/users/actions.ts` — `getUsers`, `getUserById`

That's 18 named above with a direct `requireAdmin()` guard. `getPOSDrafts`
is a 19th unguarded read but it belongs to Wave 1 (POS, already scoped and
closed there) — don't duplicate it here. The remaining 2 —
`getRealtimeStock` and `getSalesDataV2` — need the different treatment
below, per Codex's own stop-gate finding (approved 2026-07-18): both are
called directly from `app/pos/page.tsx`, which STAFF can reach (middleware
allows `/pos/:path*` for STAFF). A direct `requireAdmin()` guard on either
would break checkout for every cashier.

### `getRealtimeStock` and `getSalesDataV2` — split into ADMIN-only + a narrow POS read

Keep `getRealtimeStock()` (`app/admin/inventory/actions.ts`) and
`getSalesDataV2()` (`app/admin/reports/actions.ts`) exactly as-is and
`requireAdmin()`-guarded like the other 18 — they remain the full admin
report/inventory functions and must stay ADMIN-only; a cashier must not be
able to call either directly and pull full revenue/COGS or full stock
detail.

Instead, add two new, narrow, `resolveActor()`-guarded reads (any
authenticated role, matching how POS already works after Wave 1) and point
`app/pos/page.tsx` at those instead of the admin functions. Checked what
the POS page actually consumes from each (`app/pos/page.tsx:53,57,110`) —
scope the new functions to exactly this, nothing more:

- A best-sellers read that returns only the top-N product IDs (the page
  currently does `salesData.bestSellers.slice(0, 8).map(bs => bs.product_id)`
  — the new function should compute/return just that list, not the full
  `SalesReportResult` shape with revenue, discounts, or per-staff/category
  breakdowns).
- A stock-status read that returns only `{ id, current_stock }` pairs (the
  page currently does `realtimeStock.forEach(s => stockMap.set(s.id, s.current_stock))`
  — the new function should not include cost, supplier, or other inventory
  detail fields that `getRealtimeStock()`'s full admin shape may carry).

Add these to `app/pos/actions.ts` (colocated with the other POS reads that
already use `resolveActor()` after Wave 1) rather than in the admin
`actions.ts` files — they are POS-facing reads, not admin ones, and this
keeps the guard style/location consistent with where POS already looks for
its data access. Update `app/pos/page.tsx` to call the two new functions
instead of `getSalesDataV2`/`getRealtimeStock`.

## Explicitly out of scope

- `submitStockAdjustment` — resolved and closed in Wave 1 (locked to
  `requireAdmin()`), not this wave.
- Anything already covered by Wave 1.
- Do not change what the 18 directly-guarded functions return — this wave
  is guard-only for those. The 2 POS-called exceptions above are the one
  approved case where new narrow-return functions are added; don't extend
  that pattern to any other function without checking back first.
  If guarding one of the 18 reveals it's also missing SEC-1-style
  client-projection safety (returning more fields than the UI needs),
  note it but don't fix it here — flag it as a follow-up instead of
  silently expanding scope.
- Do not touch `middleware.ts` — the fix is local per-action/per-read, not
  a route-matcher change. `app/pos/page.tsx` is touched only to swap which
  function it calls (2 import/call-site changes), not for any UI/JSX
  change — that stays Antigravity's domain if it's ever needed.

## Constraints

- Follow `docs/COLLABORATION.md` Section C: these are Codex-owned files
  (admin actions, engine/data correctness).
- Since this is 20 near-identical changes across 15 files, batch commits
  sensibly (e.g., by module: inventory-related files together, reports
  together) rather than one file per commit or one giant commit — use
  judgment, but keep each commit reviewable.
- Add regression tests. Given the volume, a representative sample with
  full rejection-proof tests plus a lighter-weight assertion across the
  rest (e.g., extending the audit tool's own test suite to assert 0
  remaining `UNGUARDED_READ` findings after this wave, which doubles as
  both the fix verification and a regression guard against future drift)
  is preferable to skipping tests for the later files in the batch.
- No production data write expected.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: pass, count increased from the Wave 1 baseline (430).
3. Rerun `scripts/audit-admin-action-auth.ts --json` (the Gate 2 tool) and
   confirm it now reports 0 `UNGUARDED_READ` findings among the 18 directly-
   guarded items and 0 remaining findings for `getRealtimeStock`/
   `getSalesDataV2` (still `GUARDED` as ADMIN — this is correct, they did
   not become open reads, they stay admin-only and the tool won't see the
   new POS-side functions as a gap since it maps callers, not just names).
4. New test proving the 2 new POS read functions reject an unauthenticated
   call (matching the Wave 1 `app/pos/actions.auth.test.ts` pattern) and
   return only the narrow shape described above (no revenue/cost fields
   leaking through).
5. Manually confirm (or add a test) that `app/pos/page.tsx` still produces
   the same `bestSellers`/`stockMap` values it did before — this is a data-
   source swap, the POS screen's behavior must not change for the cashier.
6. `docs/audits/2026-07-18-gate2-access-map.md` and
   `docs/FEATURE-CATALOG.md` updated to reflect the closed findings —
   append/update rather than rewrite.

## Priority

P1 — lower risk than Wave 1 (read-only), but real: these are financial/
inventory/customer report reads reachable, per the report's methodology,
without going through the UI's route protection.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High or
`gpt-5.6-luna` Medium for the mechanical batch — this is repetitive/
pattern-following work (Section G: "Fast/cheap agentic batch" fits if the
pattern from the first few files is established cleanly), but the initial
few files establishing the pattern and the rerun-verification step benefit
from the higher tier. Use judgment on whether to split model tier by
sub-step.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Any of the 18 directly-guarded functions turns out not to be a pure read
  (e.g., has a side effect not caught by Gate 2's static analysis) — treat
  it as a mutation-risk item and flag rather than guarding-and-moving-on.
- Adding a guard to any of the 18 breaks an existing legitimate caller
  beyond the 2 already handled above (`getRealtimeStock`/`getSalesDataV2`)
  — check before assuming none exist, the same way this exact check caught
  the POS case.
- The two new POS-facing functions turn out to need more than the exact
  fields named above (best-seller product IDs; `{id, current_stock}`) to
  keep the POS screen working — if the minimal shape isn't actually
  sufficient, stop rather than widening it back toward the full report
  shape.
- The rerun of the Gate 2 tool still shows findings after this wave that
  aren't accounted for.
- TS/build fails for a non-trivial reason.

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

Add a local guard to each of these 21 read actions. Match the guard style
already used by the mutations in the same files (`requireAdmin()` per the
existing Gate 1/2 pattern), so the file stays internally consistent rather
than mixing guard styles:

- `app/admin/brands/actions.ts` — `getBrands`
- `app/admin/inventory/actions.ts` — `getRealtimeStock`
- `app/admin/inventory/base-ingredients/actions.ts` — `getBaseIngredientsData`
- `app/admin/inventory/conversions/actions.ts` — `getConversionsData`
- `app/admin/inventory/items/actions.ts` — `getItemsData`
- `app/admin/inventory/purchase-orders/actions.ts` — `getPurchaseOrdersData`
- `app/admin/orders/actions.ts` — `getOrdersV2`, `getOrderDetailV2`
- `app/admin/production/actions.ts` — `getProductionData`
- `app/admin/products/categories/actions.ts` — `getCategoriesWithCounts`
- `app/admin/products/modifiers/actions.ts` — `getModifiersData`
- `app/admin/promotions/actions.ts` — `getPromotionsData`
- `app/admin/reports/actions.ts` — `getPnLDataV2`, `getSalesDataV2`,
  `getHourlyHeatmapV2`, `getPromotionPerformanceV2`
- `app/admin/semi-products/actions.ts` — `getSemiProductsData`
- `app/admin/suppliers/actions.ts` — `getSuppliers`
- `app/admin/users/actions.ts` — `getUsers`, `getUserById`

That's 20 named above (matching the report's "20 admin read actions"
recommendation); `getPOSDrafts` is the 21st unguarded read but it belongs
to Wave 1 (POS, already scoped there) — don't duplicate it here.

## Explicitly out of scope

- `submitStockAdjustment` — separate, pending owner decision.
- Anything already covered by Wave 1.
- Do not change what data each function returns — this wave is guard-only.
  If adding a guard reveals a function is also missing the SEC-1-style
  client-projection safety (returning more fields than the UI needs),
  note it but don't fix it here — flag it as a follow-up instead of
  silently expanding scope.
- Do not touch `middleware.ts` — the fix is local per-action, not a
  route-matcher change.

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
2. `npx vitest run`: pass, count increased from the Gate 2 baseline (422).
3. Rerun `scripts/audit-admin-action-auth.ts --json` (the Gate 2 tool) and
   confirm it now reports 0 `UNGUARDED_READ` findings for these 20 items
   (this is the cleanest single proof the wave is complete — use it).
4. `docs/audits/2026-07-18-gate2-access-map.md` and
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

- Any of the 20 functions turns out not to be a pure read (e.g., has a
  side effect not caught by Gate 2's static analysis) — treat it as a
  mutation-risk item and flag rather than guarding-and-moving-on.
- Adding a guard breaks an existing legitimate caller (e.g., a page that
  calls one of these during a non-authenticated render path — check before
  assuming none exist).
- The rerun of the Gate 2 tool still shows findings after this wave that
  aren't accounted for.
- TS/build fails for a non-trivial reason.

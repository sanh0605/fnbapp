# Antigravity Handoff — UI-CLEAN-1: Design-Free Cleanup Sweep (2026-07-24)

> **READ FIRST**: `docs/COLLABORATION.md` — protocol, merge gate, commit conventions.
> Source audit: `docs/audits/2026-07-24-frontend-ui-ux-audit.md` (FE-3, FE-5, FE-7).

## Context

Frontend audit 2026-07-24 found three mechanical debts that need **zero design
decisions** — safe to do now without waiting for the redesign phase. The
2026-07-24 warm-palette retheme (`66c963c`) makes the leftover raw colors
visibly clash with token-based components, so FE-3 got more urgent this week.

Three items, one commit each. No visual redesign, no layout changes, no new
components.

## Item 1 — Token swap: 65 raw palette occurrences in 22 files (FE-3)

Replace raw Tailwind palette classes (`gray/zinc/slate/red/rose/green/emerald/
amber/yellow/orange/blue/indigo-<n>`) with the design tokens already used
elsewhere (`text-text-*`, `bg-surface-*`, `border-border`, `bg-primary*`,
`success/warning/danger` semantic tokens) — same mapping discipline as
UI-REMED-1 (see `docs/reports/ui-remed-1-overnight-report.md` for precedent).

Occurrence counts from the audit grep (re-run to confirm before starting):

```
components/inventory/PurchasedItemForm.tsx  10
components/SupplierForm.tsx                  7
components/ProductionForm.tsx                5
components/ProductCategoryForm.tsx           5
components/pos/CartPanel.tsx                 5
components/RecipeHistoryTimeline.tsx         4
components/SemiProductForm.tsx               4
components/backdated-ledger/status-badge.tsx 3
components/HistoryModal.tsx                  3
components/UserForm.tsx                      2
components/EditUserForm.tsx                  2
components/backdated-ledger/event-row.tsx    2
components/backdated-ledger/event-detail.tsx 2
components/inventory/BaseIngredientForm.tsx  2
components/inventory/ConversionForm.tsx      2
components/SearchableSelect.tsx              1
app/admin/activity-log/components/ActivityLogClient.tsx 1
components/pos/ProductGrid.tsx               1
app/admin/products/ProductsClient.tsx        1
components/InventoryForms.tsx                1
app/admin/audit/backdated-ledger/page.tsx    1
app/admin/promotions/components/PromotionsClient.tsx 1
```

Rules:

- Semantically equivalent swap only — if a raw color has no obvious token
  equivalent, leave it and list it in the commit body instead of guessing.
- Do NOT touch `components/ModifierForm.tsx` from this list — it is deleted in
  Item 2.
- Skip test files.

## Item 2 — Delete dead `components/ModifierForm.tsx` (FE-5)

Claude's grep found zero importers (the live form is
`app/admin/products/modifiers/components/ModifierForm.tsx`, imported by
`ModifiersClient.tsx`). Independently re-verify before deleting:

```
grep -rn "components/ModifierForm" app components lib
grep -rn "from \"@/components/ModifierForm\"" .
```

If truly zero references: delete the file (git history preserves it). If any
reference exists, stop and report instead.

## Item 3 — "Unknown" → "Không rõ" (FE-7)

7 user-visible English fallbacks:

- `app/admin/orders/actions.ts` (4 occurrences — product/size snapshot
  fallbacks in list + detail mapping). **This file is Codex-owned territory;
  the strings are display-only fallbacks, but flag the diff for Codex review
  per the cross-boundary rule.**
- `app/admin/reports/stock/page.tsx` (1)
- `app/admin/products/page.tsx` (1)
- `components/ProductionForm.tsx` (1)

Replace the literal string only; no logic changes.

## Merge gate (per `docs/COLLABORATION.md` E)

- `tsc --noEmit` 0 errors; full suite green (baseline 673); `next build` passes.
- One commit per item, prefix `Antigravity <type>:`. **No push.**
- Claude reviews all three diffs before this handoff is closed (user-facing UI
  change → Claude review required; Item 3's actions.ts portion → Codex review
  too).
- Stop and ping Claude: any raw color without a clear token equivalent, any
  ModifierForm reference found, anything that looks like it changes behavior.

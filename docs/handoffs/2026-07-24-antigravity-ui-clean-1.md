# Antigravity Handoff — UI-CLEAN-1: Design-Free Cleanup Sweep (2026-07-24)

> **READ FIRST**: `docs/COLLABORATION.md` — protocol, merge gate, commit conventions.
> Source audit: `docs/audits/2026-07-24-frontend-ui-ux-audit.md` (FE-3, FE-5, FE-7).

## Context

Frontend audit 2026-07-24 found three mechanical debts that need **zero design
decisions** — safe to do now without waiting for the redesign phase. The
2026-07-24 warm-palette retheme (`66c963c`) makes the leftover raw colors
visibly clash with token-based components, so FE-3 got more urgent this week.

Four items, one commit each. No visual redesign, no layout changes, no new
components. Order: Item 2 (deletions) → Item 1 (token swap) → Item 3
(strings) → Item 4 (select conversions).

> **AMENDED 2026-07-24 (same day, workflow audit
> `docs/audits/2026-07-24-workflow-forms-popups-search-audit.md`):** the dead-file
> problem is much bigger than one file — 9 legacy form copies in `components/`
> have zero importers, and ~42 of Item 1's 65 raw-color occurrences sit inside
> them. **Do Item 2 (deletions) FIRST, then Item 1 only on surviving files.**

## Item 1 — Token swap: raw palette occurrences in surviving files (FE-3)

Replace raw Tailwind palette classes (`gray/zinc/slate/red/rose/green/emerald/
amber/yellow/orange/blue/indigo-<n>`) with the design tokens already used
elsewhere (`text-text-*`, `bg-surface-*`, `border-border`, `bg-primary*`,
`success/warning/danger` semantic tokens) — same mapping discipline as
UI-REMED-1 (see `docs/reports/ui-remed-1-overnight-report.md` for precedent).

Files expected to survive Item 2, with occurrence counts from the audit grep
(re-run after the deletions to get the definitive list):

```
components/pos/CartPanel.tsx                 5
components/RecipeHistoryTimeline.tsx         4
components/backdated-ledger/status-badge.tsx 3
components/HistoryModal.tsx                  3
components/backdated-ledger/event-row.tsx    2
components/backdated-ledger/event-detail.tsx 2
components/SearchableSelect.tsx              1
app/admin/activity-log/components/ActivityLogClient.tsx 1
components/pos/ProductGrid.tsx               1
app/admin/products/ProductsClient.tsx        1
components/InventoryForms.tsx                1
app/admin/audit/backdated-ledger/page.tsx    1
app/admin/promotions/components/PromotionsClient.tsx 1
components/SupplierForm.tsx                  (only the SupplierModal export survives — see Item 2)
```

Rules:

- Semantically equivalent swap only — if a raw color has no obvious token
  equivalent, leave it and list it in the commit body instead of guessing.
- Skip test files.

## Item 2 — Delete the dead legacy form copies in `components/` (FE-5, DO FIRST)

Claude's import grep (`@/components/...` form, 2026-07-24) found zero importers
for all of these — they are pre-reorganization copies whose live versions moved
to `app/admin/*/components/`:

```
components/ModifierForm.tsx
components/SemiProductForm.tsx
components/ProductionForm.tsx
components/UserForm.tsx
components/EditUserForm.tsx
components/ProductCategoryForm.tsx
components/inventory/PurchasedItemForm.tsx
components/inventory/BaseIngredientForm.tsx
components/inventory/ConversionForm.tsx
```

Special case — do NOT simply delete: `components/SupplierForm.tsx`. Its
`SupplierModal` export IS live (imported by
`app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx:7` for
quick-add supplier). Options: keep only `SupplierModal` in the file, or move it
next to the PO form; pick whichever is the smaller diff and note it.

Still-live `components/` files that look similar but must NOT be deleted:
`components/ProductForm.tsx`, `components/HistoryModal.tsx`,
`components/InventoryForms.tsx` (all have live importers).

Independently re-verify EVERY file before deleting — both alias and relative
import forms:

```
grep -rn "components/<Name>" app components lib
```

If any reference exists for a listed file, skip that file and report instead.
`tsc`, full suite, and `next build` after the deletion commit prove nothing
dangling.

## Item 3 — "Unknown" → "Không rõ" (FE-7)

User-visible English fallbacks (6 after Item 2 — the 7th was in the dead
`components/ProductionForm.tsx`, gone with the deletions):

- `app/admin/orders/actions.ts` (4 occurrences — product/size snapshot
  fallbacks in list + detail mapping). **This file is Codex-owned territory;
  the strings are display-only fallbacks, but flag the diff for Codex review
  per the cross-boundary rule.**
- `app/admin/reports/stock/page.tsx` (1)
- `app/admin/products/page.tsx` (1)

Replace the literal string only; no logic changes.

## Item 4 — Convert data-driven raw `<select>`s to `SearchableSelect` (owner rule 2026-07-24)

**Owner's standing rule: any select offering ≥10 options must be a searchable
combobox.** `components/SearchableSelect.tsx` already exists and is used by all
7 data-heavy live forms — this item extends it to the stragglers.

Audit found 30 raw `<select>`s in `app/`. For each: if it renders a **static
enum under 10 options** (status filters, payment method, event type), leave it.
If it renders a **data-driven list** (products, variants, ingredients,
semi-products, categories that can grow past 10), convert to `SearchableSelect`
keeping the exact same value/onChange contract.

Known convert candidates (verify each before converting):

- `app/admin/promotions/components/PromotionForm.tsx` (4 selects — product/
  variant/category scoping)
- `app/admin/semi-products/components/SemiProductForm.tsx` (3 — recipe
  ingredient rows)
- `app/admin/products/cogs-estimate/CogsCalculator.tsx` (1 — product picker)
- `app/admin/products/modifiers/components/ModifierForm.tsx` (2 — recipe
  ingredient rows)

List every select you deliberately left as a plain enum in the commit body so
Claude's review can spot-check the classification.

## Merge gate (per `docs/COLLABORATION.md` E)

- `tsc --noEmit` 0 errors; full suite green (baseline 673); `next build` passes.
- One commit per item, prefix `Antigravity <type>:`. **No push.**
- Claude reviews all three diffs before this handoff is closed (user-facing UI
  change → Claude review required; Item 3's actions.ts portion → Codex review
  too).
- Stop and ping Claude: any raw color without a clear token equivalent, any
  ModifierForm reference found, anything that looks like it changes behavior.

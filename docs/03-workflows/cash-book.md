# Cash book flow (sổ thu chi)

```flow-decl
routes: /admin/finance/categories
files: app/admin/finance/categories/actions.ts, lib/finance/audit-columns.ts
tables: Cash_Categories
brCodes: BR-ACCESS-003
```

This doc covers only the piece built so far: the cash-category (nhóm thu chi)
management screen, task 4 of the plan at
`docs/superpowers/plans/2026-09-08-so-thu-chi.md`. The full cash book also
covers bank accounts and the cash-entry ledger itself
(`docs/superpowers/specs/2026-09-08-so-thu-chi-design.md`); those tables
(`bank_accounts`, `cash_entries`) already exist as of migration `0101` but have
no screen yet, so this doc's `flow-decl` intentionally does not declare them
until a later task adds the code that writes them.

## Five-question current-state description

1. **States, and how each is set.** A category has one status: `ACTIVE` or
   `INACTIVE`, set at creation (`ACTIVE`) and changed only by
   `setCashCategoryStatus`, which the owner reaches through the "Ngừng dùng" /
   "Dùng lại" button. There is no draft or approval step — a category is either
   in use or retired.

2. **Buttons per screen, and when to hide them.** The screen offers add, edit,
   retire/reinstate (all `requireAdmin`, i.e. ADMIN or MANAGER), and a permanent
   delete button gated on `requireOwner` (ADMIN only, `BR-ACCESS-003`) — the
   page only renders that button when the signed-in actor's role is `ADMIN`.
   Retire is the ordinary way to stop using a category; delete is a hard row
   removal blocked by Postgres (`ON DELETE RESTRICT` from `cash_entries`) the
   moment any entry already points at the category.

3. **What each list contains, and what is excluded.** The list shows every row
   in `cash_categories`, both `ACTIVE` and `INACTIVE` — nothing is hidden from
   the admin screen itself, only from whatever picker a later task builds for
   entering a cash-book line (which will offer `ACTIVE` categories only).

4. **Valid inputs, and what happens outside the range.** `name` is required and
   trimmed; `kind` is `EXPENSE` or `INCOME` (anything else posted falls back to
   `EXPENSE`); `affects_pnl` is a checkbox, on by default. Two `ACTIVE`
   categories may not share a name — compared via `findDuplicateActiveName`
   (`lib/shared/duplicate-name-guard.ts`, the same helper `app/admin/inventory`,
   `app/admin/products` and `app/admin/suppliers` already use), which
   lower-cases, NFC-normalises, folds a non-breaking space and collapses
   internal whitespace before comparing. The app returns a Vietnamese message
   naming the conflicting row before the row ever reaches Postgres's own
   partial unique index (migration `0101`, the same normalising expression as
   migration `0065`'s catalogue-table indexes), which stays as the backstop
   for a race between two concurrent saves. Only the level-1 outright refusal
   applies here — the level-2 diacritic-stripped warn-and-confirm flow
   (`findDiacriticStrippedMatch`) is out of scope for this screen; the owner
   keeps about five groups.

5. **Which data it serves, and which it deliberately does not.** This flow
   serves only the grouping the owner files a cash-book line under — it holds
   no amounts and is not itself money in or out. `getCashCategories()` is the
   read path a later task's entry-picker calls.

## Where it writes

`app/admin/finance/categories/actions.ts` writes `cash_categories` through the
`lib/db/tables.ts` adapter (`findAll`/`insert`/`update`/`remove`, sheet name
`Cash_Categories`, lowercased at that layer to the real table name). The
created/updated person columns come from `lib/finance/audit-columns.ts`
(`creationAudit`/`updateAudit`), not from Postgres — the server holds one
shared service-role connection and does not know who is acting.

> Measured against source: 2026-09-09.

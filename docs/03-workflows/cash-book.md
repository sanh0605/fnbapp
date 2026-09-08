# Cash book flow (sổ thu chi)

```flow-decl
routes: /admin/finance/categories, /admin/finance/bank-accounts
files: app/admin/finance/categories/actions.ts, app/admin/finance/bank-accounts/actions.ts, lib/finance/audit-columns.ts
tables: Cash_Categories, bank_accounts
brCodes: BR-ACCESS-003
```

This doc covers the two management screens built so far: the cash-category
(nhóm thu chi) screen, task 4 of the plan at
`docs/superpowers/plans/2026-09-08-so-thu-chi.md`, and the bank-account (tài
khoản ngân hàng) screen, task 5 of the same plan. The full cash book also
covers the cash-entry ledger itself
(`docs/superpowers/specs/2026-09-08-so-thu-chi-design.md`); that table
(`cash_entries`) already exists as of migration `0101` but has no screen yet,
so this doc's `flow-decl` intentionally does not declare it until a later
task adds the code that writes it.

## Five-question current-state description

The two screens (cash categories, bank accounts) are structurally identical
and deliberately not merged into a shared abstraction — categories will grow
an "affects P&L" flag, accounts a bank name and account number — so each
question below answers for both screens separately where they differ.

1. **States, and how each is set.** Both a category and a bank account have
   one status: `ACTIVE` or `INACTIVE`, set at creation (`ACTIVE`) and changed
   only by `setCashCategoryStatus` / `setBankAccountStatus`, which the owner
   reaches through the "Ngừng dùng" / "Dùng lại" button. Neither has a draft
   or approval step — a row is either in use or retired.

2. **Buttons per screen, and when to hide them.** Both screens offer add,
   edit, retire/reinstate (all `requireAdmin`, i.e. ADMIN or MANAGER), and a
   permanent delete button gated on `requireOwner` (ADMIN only,
   `BR-ACCESS-003`) — the page only renders that button when the signed-in
   actor's role is `ADMIN`. Retire is the ordinary way to stop using a row;
   delete is a hard row removal blocked by Postgres (`ON DELETE RESTRICT`
   from `cash_entries`) the moment any entry already points at it.

3. **What each list contains, and what is excluded.** Each list shows every
   row of its own table, both `ACTIVE` and `INACTIVE` — nothing is hidden
   from the admin screen itself, only from whatever picker a later task
   builds for entering a cash-book line (which will offer `ACTIVE` rows
   only).

4. **Valid inputs, and what happens outside the range.** For categories:
   `name` is required and trimmed; `kind` is `EXPENSE` or `INCOME` (anything
   else posted falls back to `EXPENSE`); `affects_pnl` is a checkbox, on by
   default. For bank accounts: `name` is required and trimmed; `bank_name`
   and `account_number` are both optional free text, trimmed, and stored as
   `null` (not an empty string) when left blank. In both tables, two `ACTIVE`
   rows may not share a `name` — compared via `findDuplicateActiveName`
   (`lib/shared/duplicate-name-guard.ts`, the same helper `app/admin/inventory`,
   `app/admin/products` and `app/admin/suppliers` already use), which
   lower-cases, NFC-normalises, folds a non-breaking space and collapses
   internal whitespace before comparing. The app returns a Vietnamese message
   naming the conflicting row before the row ever reaches Postgres's own
   partial unique index (migration `0101`, the same normalising expression as
   migration `0065`'s catalogue-table indexes, `idx_cash_categories_active_name`
   and `idx_bank_accounts_active_name`), which stays as the backstop for a
   race between two concurrent saves. Only the level-1 outright refusal
   applies to either screen — the level-2 diacritic-stripped warn-and-confirm
   flow (`findDiacriticStrippedMatch`) is out of scope; the owner keeps about
   five categories and a handful of accounts.

5. **Which data it serves, and which it deliberately does not.** Categories
   serve only the grouping the owner files a cash-book line under; bank
   accounts serve only which account a transfer went through. Neither holds
   an amount and neither is itself money in or out. `getCashCategories()` and
   `getBankAccounts()` are the read paths a later task's entry-picker calls.

## Where it writes

`app/admin/finance/categories/actions.ts` writes `cash_categories`, and
`app/admin/finance/bank-accounts/actions.ts` writes `bank_accounts`, both
through the `lib/db/tables.ts` adapter (`findAll`/`insert`/`update`/`remove`,
sheet names `Cash_Categories` and `bank_accounts` respectively, lowercased at
that layer to the real table name). The created/updated person columns come
from `lib/finance/audit-columns.ts` (`creationAudit`/`updateAudit`), not from
Postgres — the server holds one shared service-role connection and does not
know who is acting.

> Measured against source: 2026-09-09.

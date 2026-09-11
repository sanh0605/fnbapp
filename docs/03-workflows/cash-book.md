# Cash book flow (sổ thu chi)

```flow-decl
routes: /admin/finance/categories, /admin/finance/bank-accounts, /admin/finance
files: app/admin/finance/categories/actions.ts, app/admin/finance/bank-accounts/actions.ts, app/admin/finance/actions.ts, lib/finance/audit-columns.ts, lib/finance/cash-entry-rules.ts
tables: Cash_Categories, Bank_Accounts, Cash_Entries
brCodes: BR-ACCESS-003, BR-CASH-001, BR-CASH-002, BR-CASH-003, BR-CASH-004, BR-CASH-005
```

This doc covers all three cash-book screens: the cash-category (nhóm thu chi)
screen, task 4 of the plan at `docs/superpowers/plans/2026-09-08-so-thu-chi.md`;
the bank-account (tài khoản ngân hàng) screen, task 5; and the cash-entry
ledger itself (sổ thu chi, task 6, the main screen the other two feed) — spec
at `docs/superpowers/specs/2026-09-08-so-thu-chi-design.md`. This is
deliberately not an accounting system: no ledger, no double-entry, no
running balance.

## Five-question current-state description

The three screens are structurally different (two settings screens, one
ledger), so each question below answers for the ledger screen first, then
the two settings screens where they still apply.

1. **States, and how each is set.** A cash entry has one status, `ACTIVE` or
   `CANCELLED`, set at creation (`ACTIVE`) and moved to `CANCELLED` only by
   `cancelCashEntry` — there is no "un-cancel". A category or bank account
   has `ACTIVE`/`INACTIVE`, changed by `setCashCategoryStatus` /
   `setBankAccountStatus`. None of the three has a draft or approval step.

2. **Buttons per screen, and when to hide them.** The ledger offers add,
   edit and cancel (`requireAdmin`, i.e. ADMIN or MANAGER) and a permanent
   delete gated on `requireOwner` (ADMIN only, `BR-ACCESS-003`) — rendered
   only when the signed-in actor's role is `ADMIN`. Edit and cancel are
   hidden on a row already `CANCELLED` (`updateCashEntry` itself also
   refuses with "Dòng đã huỷ, không sửa được"); delete stays available on a
   cancelled row too, so ADMIN can still remove a mistaken entry outright.
   The two settings screens offer add, edit, retire/reinstate
   (`requireAdmin`) and the same ADMIN-only permanent delete. Deleting a
   category or account that any entry uses (cancelled entries included) is
   refused before the database is touched, with a Vietnamese sentence naming
   it and pointing to "Ngừng dùng"; the `RESTRICT` foreign key stays as the
   backstop. Reinstating a retired row is refused when an active row already
   carries the same name.

3. **What each list contains, and what is excluded.** The ledger reads one
   date range at a time (`getCashEntries(start, end)`, filtered server-side
   on `entry_date`, both `ACTIVE` and `CANCELLED` rows shown — a cancelled
   row stays visible with a badge, it just drops out of the totals), newest
   `entry_date` first, then newest id. A hand-edited range in the URL that is
   not two real calendar dates written `YYYY-MM-DD`, in order, falls back to
   "Tháng này" (`app/admin/finance/resolve-date-range.ts`; `2026-02-30` counts
   as not real). The two
   settings screens show every row of their own table regardless of status;
   only the ledger's own add/edit form narrows their pickers to `ACTIVE`
   rows (plus the row's own category/account if it has since been retired,
   so opening an old entry to edit never silently drops its group).

4. **Valid inputs, and what happens outside the range.** The ledger's six
   fields go through one shared rule, `parseCashEntry`
   (`lib/finance/cash-entry-rules.ts`): `entry_date` and `category_id`
   required (the add form defaults the date to today in Asia/Saigon);
   `amount` must be a positive whole number of đồng, typed as plain digits
   (`150000`) or dot-grouped thousands (`150.000`) — anything else ("1500.5",
   "150,000", "1e6", a minus sign) is refused, never rounded, and so is a value
   beyond `Number.MAX_SAFE_INTEGER` (`BR-CASH-005`). That server check is the
   backstop: the amount box itself (`components/ui/MoneyInput.tsx`) takes
   digits only, drops anything else typed or pasted, shows the dots as the
   owner types (`150000` → `150.000`), and submits plain digits. `payment_method` is `CASH` or
   `BANK_TRANSFER`; `bank_account_id` is required when `BANK_TRANSFER` and
   forced to `null` for `CASH` even if a stale value arrives from the form;
   `note` is optional. On the category screen, the Thu/Chi side cannot change
   once any entry uses the category (`BR-CASH-004`): `updateCashCategory`
   refuses and the form shows the select disabled. "Tính vào lãi lỗ" stays
   editable, behind an in-page confirm that says every past row is
   re-classified (`BR-CASH-003`). Names go through the shared duplicate-name
   guard on add, rename and reinstate.

5. **Which data it serves, and which it deliberately does not.** The ledger
   serves money the owner physically paid out (chi), other money he
   received that is not a sale (thu khác), and capital he put in himself
   (vốn góp) — never a POS sale, which the sales/orders flow already
   records. `summariseEntries` (also in `cash-entry-rules.ts`) turns a page
   of entries into `totalExpense`, `totalIncome` and `incomeOutsidePnl`
   (capital contributions and similar `affects_pnl: false` income) —
   deliberately three separate numbers, never netted into one, so the
   screen never implies a false "extra profit" figure by adding money that
   is not revenue. `incomeOutsidePnl` shows as a line inside the income
   total, not as a third card. Under the totals, one line per category gives
   its amount for the range; an entry whose category is missing from the
   list shows as a warning line instead of vanishing. The one dated
   exception to "never a sale" is the owner's two lost-revenue rows, dated
   2026-04-30 since the owner moved them on 2026-09-11 (`BR-CASH-001`).

## Where it writes

`app/admin/finance/categories/actions.ts` writes `Cash_Categories`,
`app/admin/finance/bank-accounts/actions.ts` writes `Bank_Accounts`, and
`app/admin/finance/actions.ts` writes `Cash_Entries` — all three through the
`lib/db/tables.ts` adapter (`findAll`/`findAllWhere`/`findById`/`insert`/`update`/`remove`,
lowercased at that layer to the real table name). The created/updated person
columns come from `lib/finance/audit-columns.ts` (`creationAudit`/`updateAudit`),
not from Postgres — the server holds one shared service-role connection and
does not know who is acting; `addCashEntry`/`updateCashEntry`/`cancelCashEntry`
spread these in themselves, since the generic `createEntity`/`updateEntity`
helpers in `lib/db/shared-actions.ts` only stamp `created_at`.

> Measured against source: 2026-09-11.

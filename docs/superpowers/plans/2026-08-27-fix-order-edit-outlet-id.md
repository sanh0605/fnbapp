# Order editing has been broken since 2026-08-25

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). **Production is broken now** — the owner cannot edit an order.

**This is a regression from my own outlets work.** Migration `0072` tightened a
column without checking every writer of the table it tightened.

---

## 1. What the owner sees

Editing order `260827002004` fails with:

```
Lỗi cập nhật đơn: supersede_order_v2_atomic: null value in column "outlet_id"
of relation "orders_v2" violates not-null constraint
```

## 2. Root cause, traced not guessed

- `0071` added `orders_v2.outlet_id` as nullable.
- **`0072` line 18: `alter column outlet_id set not null`.** Committed
  2026-08-25.
- `supersede_order_v2_atomic` was last defined in **`0046`**. Its
  `insert into public.orders_v2 (...)` names **26 columns and `outlet_id` is not
  among them** — the function predates the column and nothing updated it.

So every edit since 2026-08-25 has failed. **Measured: the last successful edit
is 2026-08-24**, and there are 15 superseded orders in total.

**The POS path is fine.** `create_pos_order_atomic` was redefined in `0072`
itself and sets `outlet_id`. Selling never broke; only editing did.

**Exactly one writer is affected.** Every migration that inserts into
`orders_v2` — `0023`, `0024`, `0040`, `0046`, `0047`, `0072` — is a redefinition
of one of those two functions, and only `0046`'s is stale.
`lib/historical/sheets-db-v2.ts` also inserts but is one-off tooling, not a live
path.

**No data was damaged.** The RPC is atomic, so a failed insert rolls the whole
transaction back: the original order stays `COMPLETED` rather than being left
`SUPERSEDED` with no successor. Verified — all 15 superseded rows point at a
real successor, 0 orphans.

## 3. The fix

A new migration that `create or replace`s `supersede_order_v2_atomic`, adding
`outlet_id` to the insert.

**Source it from the order being superseded, not from `p_new_order`.** The
function already reads the old row at `0046` line 716 (`into v_old_status,
v_old_version`); add `outlet_id` to that same select. An edit never moves an
order to a different outlet, and reading it from the database means the client
cannot omit or contradict it.

**Do not change `lib/order-edit-cart.ts`** to send an outlet. That would put the
value back in the client's hands, which is how a column ends up wrong rather
than missing.

Copy the function body forward from `0046` unchanged apart from this — resist
tidying it while there.

## 4. The lesson worth recording, because it will recur

Tightening a column to `NOT NULL` is a change to **every writer of that table**,
not to the table. `0072` was reviewed for triggers and for the minting path it
was rewriting; nobody listed the other functions that insert into `orders_v2`.

`fnbapp-bulk-data-change` already requires a trigger inventory. **A
constraint-tightening migration needs a writer inventory too** — grep every
`insert into <table>` across `supabase/migrations/` and every `insert(` against
it in `lib/` and `app/`, and state what each one does about the new constraint.
Add that to the skill.

## 5. Verification

- **Write the test first and prove it fails on the value**: superseding a
  COMPLETED order must produce a new row whose `outlet_id` equals the original's.
  Today it raises the not-null violation; say whether the pre-fix failure was
  the violation or a missing function.
- **Re-verify the invariant this touches:** after an edit, both versions still
  share one `order_no`, `created_at` is copied verbatim from the original
  (`CLAUDE.md` §10), and the new row's `outlet_id` matches the old row's.
- `scripts/verify-revenue.ts` unmoved — revenue counts `COMPLETED` with an empty
  `superseded_by`, so a broken edit path must not have moved it, and a fixed one
  must not either.
- Full `CLAUDE.md` §9 gates.

## 6. Done means

`CLAUDE.md` §9. **This one needs the owner to run the migration** — a separate
approval from pushing (`CLAUDE.md` §2) — and then to edit a real order himself
and see it save. `curl` proves nothing here; the failure was only visible from
inside a logged-in session, which is exactly how it survived three days.

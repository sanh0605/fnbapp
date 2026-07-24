# Materialized Inventory Balance Design

Date: 2026-07-25
Status: approved by owner; implementation pending

## Goal

Make current-stock reads fast without changing inventory accounting or MAC COGS.
`stock_ledger` remains the immutable quantity source of truth. A new balance
table is derived state only: it stores the current sum of `quantity_change` for
each inventory item.

## Non-goals

- Do not change how `Order_Lines_V2.cost_at_sale` is calculated or corrected.
- Do not replace historical ledger replay for MAC, COGS, or effective-time
  calculations.
- Do not hide negative stock; negative balances remain valid audit output.
- Do not add a warehouse/outlet dimension in this change.

## Decision

Use a PostgreSQL-maintained derived table, updated synchronously by an
`AFTER INSERT OR DELETE OR UPDATE OF item_reference, quantity_change` trigger
on `public.stock_ledger`.

This is preferred over updating the table in individual RPCs because ledger
rows are also created, deleted, and rebuilt by recovery and historical
reprocessing tools. A trigger covers every committed database mutation,
including atomic POS, PO, stock-adjustment, production, void/edit, stocktake,
and rebuild flows. An asynchronous job is rejected because it would expose
stale stock after an operational write.

## Schema and trigger contract

Migration `0038_materialize_inventory_balances.sql` will create:

```sql
public.inventory_balances (
  item_reference text primary key,
  quantity numeric(18,6) not null default 0,
  updated_at timestamptz not null default now()
)
```

`item_reference` stays polymorphic because it can identify either a base
ingredient or a semi-product. No foreign key is added: the existing ledger
also supports historical references and must remain auditable when catalog rows
are retired.

The trigger function applies a signed delta with an upsert:

- INSERT: add `NEW.quantity_change` to `NEW.item_reference`.
- DELETE: subtract `OLD.quantity_change` from `OLD.item_reference`.
- UPDATE: subtract the old row, then add the new row. This covers correction
  scripts that alter quantity or change an item reference.

All writes occur in the caller's transaction. A failed atomic RPC rolls back
both the ledger and balance update. A multi-batch historical operation can show
intermediate but always ledger-consistent balance between committed batches;
its final state needs no special reconciliation.

## Backfill, rebuild, and rollback

The migration backfills from `stock_ledger` in the same transaction:

```sql
insert into inventory_balances (item_reference, quantity)
select item_reference, sum(quantity_change)
from stock_ledger
where nullif(btrim(item_reference), '') is not null
group by item_reference;
```

The trigger is created before application reads are switched, so every future
ledger mutation is covered. Full-history rebuilds remain supported: their
DELETE and INSERT operations automatically apply the inverse and replacement
deltas. A dedicated privileged `rebuild_inventory_balances()` function can
truncate and re-aggregate the table for recovery, but no normal operation uses
it.

Rollback drops the trigger and derived table only. It never changes
`stock_ledger`; current-stock callers can return to full-ledger replay.

## Read path

`getRealtimeStock` and POS stock-status reads join catalog items to
`inventory_balances` and use zero when no balance row exists. Historical
computations keep using the ledger with their explicit effective-time bound.
This preserves MAC and delayed-PO/recipe behavior:

- A late PO receipt changes the current balance immediately when its ledger row
  is recorded. Backdated COGS recovery remains the existing, separate path.
- A retroactive recipe correction changes balance only when it replaces the
  affected consumption ledger rows; COGS recovery remains separate.

## Audit and acceptance criteria

Add a read-only audit that aggregates `stock_ledger` and full-joins it with
`inventory_balances`. It must fail for missing rows, extra rows, or any
quantity delta larger than 0.000001, and print sample item references.

Before deploy:

1. Unit-test delta handling for insert, delete, update, negative values, and
   new item references.
2. Verify migration SQL includes security-definer/revoked grants where a
   rebuild RPC is provided.
3. Run full test suite, TypeScript, build, and migration static tests.

After deploy:

1. Confirm the balance audit reports zero mismatches.
2. Confirm `audit-current-stock` reports the same three known negative items.
3. Confirm P&L MAC consistency remains zero delta.
4. Compare the first stock-report/POS reads against the prior ledger replay on
   production before removing the fallback implementation.

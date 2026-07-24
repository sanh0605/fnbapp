# Void shortfall ledger repair dry-run

Date: 2026-07-24

## Finding

The full-history order-ledger audit found six quantity mismatches across three
orders. `PHD001128` and `PHD001129` produced semi-product stock implicitly and
were later voided. The void path reversed only `SALES_CONSUME`, leaving each
order's `PRODUCTION_CONSUME` and `PRODUCTION_YIELD` effects active. The polluted
semi-product balance then changed the checkout ledger shape of `PHD001132`.

The forward path is fixed in commit `4f6ba40` by reversing all three
checkout-derived transaction types atomically.

## Repair scope

`scripts/repair-void-shortfall-ledger.ts` is limited to:

- `PHD001128`
- `PHD001129`
- `PHD001132`

It uses the full-history replay result and the existing
`rebuild_stock_ledger_for_order` RPC. It replaces the complete derived-ledger
set for each target order, does not change `cost_at_sale`, is dry-run by
default, and requires `--apply` for writes.

## Verified dry-run

Command:

```text
node_modules\.bin\vite-node.cmd scripts\repair-void-shortfall-ledger.ts
```

Result:

```text
Mode: DRY RUN (no writes)
Target orders: 3
Rows to delete: 9
Rows to insert: 3
  PHD001128: delete 4, insert 0
  PHD001129: delete 4, insert 0
  PHD001132: delete 1, insert 3
Dry-run checks passed. Re-run with --apply to write the repair.
```

No production write was performed.

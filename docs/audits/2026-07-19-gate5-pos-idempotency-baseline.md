# Gate 5 POS checkout idempotency baseline

Date: 2026-07-19

Mode: live read-only audits

Code baseline: `410906c`

## Result

The checkout-idempotency work starts from the same documented operational
state as Gate 4. Nine live audits were rerun without a mutating flag or RPC.
No new drift was found, so the Gate 5 stop-and-ping condition did not fire.

The frozen MAC baseline used by the test suite was verified separately at the
approved SHA-256
`cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3`.

## Fresh audit matrix

| Script | Fresh result | Gate 4 comparison | Verdict |
|---|---|---|---|
| `audit-order-ledger.ts` | 1,580 orders; 2,256 lines; 8,128 ledger rows; 301 mismatches; 0 orphan rows | Same 301 known replay mismatches and 0 orphans | Known replay drift; no new signal |
| `audit-current-stock.ts` | 44 tracked items; 3 negative: `ING-021` -729,821 g, `ING-024` -150 ml, `ING-003` -131 g | Same three items and balances | Existing physical-count backlog; no new signal |
| `audit-pnl-mac-consistency.ts` | Product/topping delta 0 VND; ingredient delta 0 VND | Same clean contract | Clean |
| `audit-void-orders.ts` | 11 voided and 10 superseded; 0 reversal, event, or quantity issue | Same clean contract | Clean |
| `audit-order-total-consistency.ts` | 1/1,559 mismatch: line-less order `UCK000269`, 15,000 VND | Same named historical gap | Known gap; no new signal |
| `audit-order-modifier-qty.ts` | 4 quantity-greater-than-one rows; 0 snapshot mismatches | Same clean contract | Clean |
| `audit-pos-inventory-state.ts` | 49 items; 0 mismatches | Same clean contract | Clean |
| `audit-report-v2-consistency.ts` | 1 mismatch; order-versus-line revenue delta 15,000 VND | Same `UCK000269` gap | Known gap; no new signal |
| `audit-stock-ledger-schema.ts` | 8,128 rows; 0 invalid types, signs, costs, or required fields | Same clean contract | Clean |

`audit-mac-drift-baseline.ts` was not rerun in this step because it writes a
date-stamped JSON file and would overwrite same-day immutable evidence. Gate 5
does not change the MAC engine or stored COGS, and the same-day Gate 4
cohort-aware result remains the applicable MAC evidence.

## Test baseline

- Full Vitest baseline: 96 files, 512 tests passed.
- The first isolated-worktree run exposed the repository's known line-ending
  mismatch for the frozen baseline blob (`5083...` instead of the approved
  `cd0a...`). The worktree was restored from the approved main working-copy
  bytes and marked assume-unchanged; no frozen artifact change is part of this
  task.
- No production data was written.

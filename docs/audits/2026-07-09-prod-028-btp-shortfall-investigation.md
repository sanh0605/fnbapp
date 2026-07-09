# PROD-028 BTP_SHORTFALL Active Drift Investigation

Date: 2026-07-09
Status: Read-only investigation complete

## Summary

The 8 new post-2026-07-02 `PROD-028` drift lines are caused by a backdated
purchase receipt for `NNL-007`, not by a recipe mapping gap and not by a
POS-vs-audit MAC algorithm mismatch.

Confirmed source:

- Product: `PROD-028` / `Trứng luộc`.
- Variant: `VAR-037` / `1 trái`.
- Recipe: `PROD-028` consumes `BTP-013` (`Trứng luộc`) x 1.
- Semi-product recipe: `BTP-013` consumes `NNL-007` x 1, batch yield 1.
- Affected sales: 8 `PROD-028` order lines from `2026-07-05T23:42:13.801Z`
  through `2026-07-06T01:23:07.816Z`.
- Backdated purchase: `PO-051` for `NNL-007`, stock ledger effective timestamp
  `2026-07-04T17:00:00Z`, but purchase order row `created_at` is
  `2026-07-06T04:38:14.956371Z`.

The affected sales happened after the PO's effective transaction date but before
the PO existed in the database. At sale time, POS could only price `NNL-007`
using the earlier MAC of 2,256 VND/unit. Current audit replay includes PO-051
because its stock ledger timestamp is backdated before the sale, raising
`NNL-007` MAC to 2,295.7497677519427 VND/unit.

No database rows were written.

## Reproduction

Command:

```powershell
node_modules\.bin\vite-node.cmd scripts\debug-prod-028-btp-shortfall.ts
```

The debug script traces two sample lines:

- `PHD000883` / `ol-08bbc0ba-6f00-4aa4-a71c-cec7e96ff08e` (`qty=2`, delta
  +79 VND).
- `PHD000893` / `ol-35ef2d85-9c6b-42e6-a94b-ca822e384423` (`qty=5`, delta
  +199 VND).

### PHD000883

Observed:

- Sale time: `2026-07-05T23:42:13.801Z`.
- Stored COGS: 4,512 VND.
- Current full-ledger replay: 4,591 VND.
- Current compact replay: 4,591 VND.
- Replay excluding PO-051: 4,512 VND.

Trace:

| Path | Unit MAC | Qty | Cost |
|---|---:|---:|---:|
| Stored sale-time COGS | 2,256 | 2 | 4,512 |
| Current replay including PO-051 | 2,295.7497677519427 | 2 | 4,591 |
| Replay excluding PO-051 | 2,256 | 2 | 4,512 |

The actual order stock ledger row matches replay quantity and source:

| Item | Qty | Source |
|---|---:|---|
| NNL-007 | -2 | `VARIANT_RECIPE:BTP_SHORTFALL:BTP-013` |

### PHD000893

Observed:

- Sale time: `2026-07-06T00:53:29.949Z`.
- Stored COGS: 11,280 VND.
- Current full-ledger replay: 11,479 VND.
- Current compact replay: 11,479 VND.
- Replay excluding PO-051: 11,280 VND.

Trace:

| Path | Unit MAC | Qty | Cost |
|---|---:|---:|---:|
| Stored sale-time COGS | 2,256 | 5 | 11,280 |
| Current replay including PO-051 | 2,295.7497677519427 | 5 | 11,479 |
| Replay excluding PO-051 | 2,256 | 5 | 11,280 |

The actual order stock ledger row matches replay quantity and source:

| Item | Qty | Source |
|---|---:|---|
| NNL-007 | -5 | `VARIANT_RECIPE:BTP_SHORTFALL:BTP-013` |

## Hypotheses

### H1: BTP recipe mapping gap

Rejected.

`BTP-013` has current semi-product recipe coverage:

| Semi-product | Name | Batch yield | Recipe |
|---|---|---:|---|
| BTP-013 | Trứng luộc | 1 | `NNL-007` x 1 |

The replay did not fail due to missing BTP recipe data. It correctly decomposed
the semi-product shortfall to `NNL-007`.

### H2: MAC fallback coverage drift between POS and audit code

Rejected for the 8 `PROD-028` lines.

Using the current ledger:

- Full audit path `computeMacCostForConsumptionRows(...)` returns the same value
  as compact POS-style `computeMacCostFromUnitCosts(...)`.
- Both produce 4,591 VND for `PHD000883` and 11,479 VND for `PHD000893`.

This means the current TypeScript POS pricing path and audit replay path agree
when they receive the same ledger state.

### H3: Sale-time cost_at_sale computation bug

Rejected as the primary cause for these 8 lines.

The stored values are exactly reproduced when PO-051 is excluded from the
replay:

- `PHD000883`: 4,512 VND.
- `PHD000893`: 11,280 VND.

That is the ledger state POS could see before PO-051 was created at
`2026-07-06T04:38:14.956371Z`.

### H4: Recipe change after sale

Rejected for the observed divergence.

The line recipe snapshot, current product recipe path, and actual stock ledger
rows all point to the same consumption structure: `BTP-013` shortfall decomposes
to `NNL-007`. The quantity/source comparison matched exactly.

### H5: BTP inventory timing / backdated input timing

Confirmed.

PO-051 is the divergence point:

| Field | Value |
|---|---|
| PO | PO-051 |
| Item | NNL-007 |
| Stock ledger effective timestamp | `2026-07-04T17:00:00Z` |
| Purchase order `created_at` | `2026-07-06T04:38:14.956371Z` |
| Quantity | 60 |
| Unit cost | 2,400 |

The 8 affected `PROD-028` sales occurred between those two timestamps. Current
MAC replay uses the effective stock ledger timestamp, so it retroactively prices
those sales as if PO-051 had existed at sale time. The actual sale-time POS path
could not include PO-051 before it was created.

## Active-source lines

| Order | Line ID | Sale time | Qty | Stored | Current replay | Delta |
|---|---|---|---:|---:|---:|---:|
| PHD000883 | `ol-08bbc0ba-6f00-4aa4-a71c-cec7e96ff08e` | 2026-07-05T23:42:13.801Z | 2 | 4,512 | 4,591 | +79 |
| PHD000887 | `ol-db72a765-56c5-4b29-884c-a522cb51eabe` | 2026-07-06T00:15:15.538Z | 2 | 4,512 | 4,591 | +79 |
| PHD000890 | `ol-769255d6-4063-46e8-bdd4-8b45108f57d0` | 2026-07-06T00:41:43.624Z | 2 | 4,512 | 4,591 | +79 |
| PHD000893 | `ol-35ef2d85-9c6b-42e6-a94b-ca822e384423` | 2026-07-06T00:53:29.949Z | 5 | 11,280 | 11,479 | +199 |
| PHD000894 | `ol-42cc0fcb-2830-4a64-9207-9fac5f763abf` | 2026-07-06T00:55:52.944Z | 1 | 2,256 | 2,296 | +40 |
| PHD000896 | `ol-11dbf85d-80dc-4ca3-80c0-f54f64563dfe` | 2026-07-06T01:11:08.981Z | 2 | 4,512 | 4,591 | +79 |
| PHD000897 | `ol-91b3ca39-dad8-4a2d-b387-f0ad7e6407f3` | 2026-07-06T01:16:09.910Z | 2 | 4,512 | 4,591 | +79 |
| PHD000899 | `ol-be44f399-b097-4ccb-a42c-d69e6ef22637` | 2026-07-06T01:23:07.816Z | 2 | 4,512 | 4,591 | +79 |

Total active-source impact: 8 lines / +713 VND.

## Timeline correlation

`PROD-028` first appears in observed order lines on `2026-06-01T01:02:30Z`.
The active source first appears after the 2026-07-02 audit when PO-051 was
created with a backdated effective date.

Relevant git history for POS/MAC files:

- `12dd2db` `Codex perf: make POS checkout atomic and compact`.
- `5a0ada2` `Codex perf: index MAC ledger for P&L`.
- Earlier MAC/consumption commits include `8236818`, `e0e9e97`, and
  `1cae265`.

The active `PROD-028` drift is not correlated with a new code commit after
Task 3. It is correlated with a data event: backdated PO-051 entered after the
affected sales.

## Root cause

The current data model has one timestamp on `stock_ledger.created_at`, and the
MAC replay treats it as the effective inventory timestamp. It does not also know
when that ledger row became visible to POS.

For normal forward-entered receipts, effective time and visibility time are
close enough. For backdated receipts, they diverge:

```text
PO effective timestamp  ->  affected sales  ->  PO row created
2026-07-04 17:00Z          2026-07-05/06       2026-07-06 04:38Z
```

POS correctly priced the sales from rows visible at sale time. Later audit
replay correctly follows the current effective ledger timeline. Those are two
different business semantics, so the drift is expected unless the system either:

1. recomputes impacted sales when a backdated cost input is entered; or
2. stores enough visibility metadata to replay sale-time-known ledger state.

## Recommended fix scope

Recommended next task: handle backdated purchase receipts explicitly.

Minimum viable fix:

1. When a completed PO has `transaction_date < created_at`, detect affected
   completed order lines whose sale time is between the PO effective timestamp
   and the PO creation timestamp and whose consumption includes the purchased
   item.
2. Produce a dry-run impact report.
3. Require explicit approval to recompute those affected `cost_at_sale` values
   or mark them as accepted audit drift.

Stronger schema fix:

- Add a distinct visibility timestamp for stock ledger rows, e.g.
  `posted_at` / `inserted_at`, while preserving `created_at` as effective
  inventory date.
- Audit/replay can then choose either effective-ledger semantics or
  sale-time-known semantics intentionally.

Do not fix `PROD-028` recipe. The recipe is coherent.

## Blast radius

Confirmed active-source blast radius:

- `PROD-028`: 8 lines.
- `NNL-007`: 17 eggs consumed across the 8 lines.
- Current replay delta: +713 VND.

Potential broader blast radius:

- Any backdated `PO_RECEIPT`, `STOCK_ADJUST`, or `PRODUCTION_YIELD` row inserted
  after sales but effective before those sales can create the same audit drift.
- The existing 170-line baseline may contain older instances of the same
  pattern, so Task 3 recovery should not assume all drift is one historical
  backfill class.

## Recommendation for Task 3 sequencing

Do not run Task 3 recovery as-is if the goal is a stable "no new drift" state.
First implement Task 3.2 for backdated purchase receipt impact detection and
policy.

Task 3 Option A lock can proceed in parallel only if the user accepts that the
lock is a snapshot of known drift, not a mechanism that prevents future drift.

Task 3 Option B recompute should be revised after Task 3.2, because recomputing
the 170-line baseline without addressing backdated receipts will not stop future
drift from appearing whenever another backdated cost input is entered.

## Verification

- Ran `scripts/debug-prod-028-btp-shortfall.ts`: read-only trace, no writes.
- Ran `scripts/audit-mac-drift-baseline.ts`: baseline remains 170 lines /
  +119,782 VND.

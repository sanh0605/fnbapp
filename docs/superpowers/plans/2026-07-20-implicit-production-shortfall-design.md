# Implicit Production-on-Shortfall — Design Proposal

Owner-confirmed root cause (2026-07-20, conversation record): when a sale
needs more semi-product (BTP) than is currently on hand, the system
"explodes" the shortfall directly into raw-ingredient consumption
(`SALES_CONSUME` on the raw item) — but this doesn't reflect reality.
Coffee beans can't be served to a customer; they must be brewed into
concentrate first. The current behavior exists only because staff have
no real-time way to log semi-product production as it happens, so the
system approximates COGS by charging the raw-ingredient-equivalent cost
directly. This causes the "301 known mismatches" pattern: any later
correction to when a real production batch actually became known to the
system makes a retrospective replay disagree with what was recorded,
because the replay incorrectly assumes information was available before
it actually was.

**Approved fix direction**: instead of exploding a shortfall into direct
raw-ingredient sale consumption, the system should record an **implicit,
automatic production step** at the moment of the shortfall — consume the
raw ingredient as production input, yield the semi-product, then have the
sale consume the semi-product like normal. This matches physical reality
(raw → brewed → served) and eliminates the root cause of the mismatch
pattern for every future order, not just the ones already found.

## Where NOT to make this change (scope discipline)

`allocateRecipeConsumption`/`buildLineConsumptionRows`
(`lib/inventory-consumption.ts`) are shared across at least 12 call
sites: POS checkout, admin order edit, admin reports (COGS breakdown),
backdated-ledger recompute, `btp-shortfall-reprocess.ts`,
`cogs-drift-audit.ts`, `hong-luc-migration.ts`, `mac-cogs-audit.ts`,
`order-ledger-audit.ts`, `report-v2-allocators.ts`. These functions
decide **how much** of each item a line's recipe implies consuming given
a balance snapshot — that logic is correct today and used by every audit
tool that needs to answer "what should this line have consumed." **Do
not change these functions or their return shape.** Changing them would
either break every audit/report call site or require updating all 12,
for no benefit — the allocation math itself isn't wrong, only what
happens with a "shortfall" row *when writing it to the ledger* is wrong.

COGS calculation (`computeMacCostFromUnitCosts`,
`computeMacCostForConsumptionRows` in `lib/mac-cogs.ts`) also stays
unchanged. It already computes a semi-product's unit cost by recursively
falling back to its recipe's raw-ingredient MAC cost
(`getMacUnitCostWithRecipeFallback`/`getMacUnitCostFromMap`) whenever the
semi-product's own ledger-based MAC is 0 (which it always is today,
since `PRODUCTION_YIELD` rows are written with `unit_cost: 0` — confirmed
in `app/admin/production/actions.ts`, the real production-order flow).
This means costing a line via "50 units of BTP-013" and costing it via
"30 units of BTP-013 + 20 units of its raw-ingredient equivalent" produce
the **same total COGS number**, because the semi-product's fallback cost
is defined as exactly that per-unit recipe-derived value. So this fix
changes *what the ledger records*, not *how much money is charged* — no
P&L impact, confirmed by the math, to be verified live before shipping.

## What actually changes

A new, narrow transformation applied **only at the 2 live-write call
sites** (`app/pos/actions.ts`'s `buildStockLedgerEntries`, and the
equivalent ledger-building code in `app/admin/orders/actions.ts` for
order edit/supersede) — not inside the shared allocation function itself:

For each line's `ConsumptionRow[]` (already computed, unchanged), detect
rows whose `source` contains `:BTP_SHORTFALL:` (the existing tag
`allocateRecipeConsumption` already attaches — see
`lib/inventory-consumption.ts:92`). Group these by the semi-product ID
embedded in the tag. For each such group:

1. Write the raw-ingredient rows as `PRODUCTION_CONSUME` (not
   `SALES_CONSUME`), `reference_id` = the order ID (no new
   `production_orders` row — kept lightweight/auditable via `source`/
   `notes` rather than a full production-order UI record), `source` =
   `AUTO_SHORTFALL_PRODUCTION:<semi_product_id>`.
2. Write one `PRODUCTION_YIELD` row for the semi-product, quantity =
   the shortfall amount, same `reference_id`/`source` tagging.
3. Fold that same shortfall quantity into the semi-product's own
   `SALES_CONSUME` (or `EDIT_CONSUME` for the edit path) row, instead of
   leaving it as a separate raw-ingredient consumption row.

Nested semi-products (a BTP recipe containing another BTP) already
recurse correctly in `allocateRecipeConsumption` — the same grouping/
folding logic applies at whichever level the shortfall tag identifies,
no special-casing needed beyond parsing the existing tag format.

## Concrete example (matching the one already confirmed in conversation)

Old (current) ledger for a 50ml sale with only 30ml BTP-013 on hand:

| transaction_type | item | qty |
|---|---|---:|
| SALES_CONSUME | BTP-013 | -30 |
| SALES_CONSUME | NNL-007 | -20 |

New (after this fix):

| transaction_type | item | qty |
|---|---|---:|
| PRODUCTION_CONSUME | NNL-007 | -20 |
| PRODUCTION_YIELD | BTP-013 | +20 |
| SALES_CONSUME | BTP-013 | -50 |

Net effect on both items' balances is identical either way (BTP-013 net
-30, NNL-007 net -20) — this is not a stock-quantity change, it's a
**transaction-type/attribution** change, which is exactly why it doesn't
touch COGS math and doesn't require correcting any historical row.

## Historical data: not touched

The 301 already-existing mismatches were written under the *old*
behavior and stay as-is — this fix only changes how *future* orders get
written. Retroactively rewriting historical ledger rows to the new shape
would be exactly the kind of silent-history-rewrite the project's
policy (and tonight's conversation) rejects. Once this ships, the
existing 301 becomes a closed, historical, non-growing set to classify
separately (see the earlier conversation about auditing them against
`backdated_ledger_events`) — this fix's job is to stop the count from
growing further, not to retroactively fix what's already recorded.

## Verification plan (Gate 4/5-level rigor, given this touches every future sale)

1. Unit tests for the new transformation function: a shortfall-tagged
   row set converts to the exact `PRODUCTION_CONSUME`/`PRODUCTION_YIELD`/
   folded-`SALES_CONSUME` shape shown above; a nested-semi-product
   shortfall recurses correctly; a line with *no* shortfall (the normal
   case) is completely unaffected (byte-identical ledger entries to
   today).
2. Confirm COGS math equivalence with a concrete test: same line, same
   inputs, compute `cost_at_sale` both the old way (raw rows) and the
   new way (folded BTP row) and assert they're equal.
3. Forced-failure test: what happens if the implicit production write
   fails partway (mirroring the Gate 4 rigor for every other write path)
   — since this all happens inside the existing atomic
   `create_pos_order_atomic` transaction (all ledger rows are written
   together, same as today), a partial failure already rolls back the
   whole order per the existing atomicity guarantee. Confirm this
   explicitly with a test, not just an assumption.
4. Live verification: process an isolated probe order through the real
   checkout path against production (same discipline as every atomic-RPC
   change tonight), confirm the ledger rows match the new shape, confirm
   `cost_at_sale` matches the pre-change calculation exactly, clean up
   fully afterward.
5. Rerun `audit-order-ledger.ts` after shipping — confirm the mismatch
   count for any *newly created* test/probe order is 0 (can't confirm
   the existing 301 changes, since those are historical and untouched
   by design).
6. Full suite, `tsc`, production build — same bar as every other change
   tonight.

## Open question before implementation starts

Should the implicit `PRODUCTION_CONSUME`/`PRODUCTION_YIELD` rows also
create a lightweight `production_orders`/`production_items` record
(so they show up in the admin production-history view), or stay as
plain `stock_ledger` rows only (visible via the ledger/audit tools,
but not the production-order UI)? Recommend: plain ledger rows only
for now — creating a full production-order record adds meaningfully
more scope (a new UI concern, approval/actor fields that don't really
apply to an automatic system action) for a case that's explicitly
framed as a stopgap until real-time production logging exists.

## Confirmed: the order-edit/supersede path needs the identical fix

Read `app/admin/orders/actions.ts:539-560` directly — it has its own
`buildStockLedgerEntries` (different function, same name, same file
scope) that calls the same shared `buildLineConsumptionRows` and writes
every row as `SALES_CONSUME` uniformly, same as the POS path. **Both
call sites need this fix, not just POS checkout** — an order that gets
edited/superseded and re-triggers a BTP shortfall would otherwise still
produce the old, physically-incorrect ledger shape.

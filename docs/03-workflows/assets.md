# Assets flow (tools, depreciation, disposal)

```flow-decl
routes: /admin/inventory/assets, /admin/inventory/asset-bands
files: app/admin/inventory/assets/actions.ts, app/admin/inventory/asset-bands/actions.ts
tables: asset_disposals, asset_depreciation_bands
brCodes: BR-COGS-008
```

This flow covers the equipment register — the durable tools the shop owns — and
the two things the owner does with it after acquisition: **dispose** of a tool
that is broken or retired, and **maintain the depreciation bands** that decide how
long each tool is written off over. Equipment is depreciated straight-line, in a
band chosen by its own unit price, frozen at purchase (`BR-COGS-008`).

**Where assets come from — the purchasing flow, not this one.** The `assets` row
itself is never created here. Completing a purchase order with an `EQUIPMENT`
line inserts the asset automatically (`lib/purchase-order-transaction.ts`, called
from `app/admin/inventory/purchase-orders/actions.ts`) — see
`docs/03-workflows/purchasing.md`. That is why `assets` is not in this flow's
declared `tables:`: the two files here only write `asset_disposals` and
`asset_depreciation_bands`. Depreciation itself is a pure calculation over the
frozen asset fields plus its disposals (`lib/asset-depreciation.ts`); it books no
table of its own.

## Five-question current-state description

1. **States, and how each is set.** An asset's business state is derived, not
   stored: `summarizeAsset` classifies it as still depreciating, term-ended (worth
   0đ but still owned), or disposed, from the frozen purchase fields plus the sum
   of its disposals. The register answers "what the shop owns," not "what still
   has value" — an asset whose depreciation term has ended stays listed at 0đ
   until it is disposed. A separate `status` flag (`ACTIVE`/`INACTIVE`) exists only
   to hide a genuine data-entry mistake; it is not how disposal is decided. A
   depreciation band simply exists in `asset_depreciation_bands`; there is no
   draft or approval step.
2. **Buttons per screen, and when to hide them.** `/admin/inventory/assets` offers
   a dispose action per asset (with a live preview of the amount that will be
   charged this month before confirming). It offers no delete for the asset row.
   `/admin/inventory/asset-bands` offers add, edit, and delete for bands — a
   flexible thing the owner controls without a code change (`CLAUDE.md` §8). An
   edit or delete that would leave a gap, an overlap, or an uncovered price range
   is refused, so those actions fail rather than hide.
3. **What each list contains, and what is excluded.** The asset list shows every
   owned asset, one row per purchase line (eight identical pumps bought together
   are one row with quantity 8, not eight rows). Rows flagged `INACTIVE` are
   excluded. Fully disposed assets fall out because their remaining quantity is
   zero. The band list shows every depreciation band, sorted by lowest price. It
   deliberately excludes the assets themselves.
4. **Valid inputs, and what happens outside the range.** A disposal needs a
   positive quantity no greater than what remains (asset quantity minus prior
   disposals) and a date on or after acquisition and not in the future; anything
   outside that is refused with a message, never silently clamped. A band needs a
   non-negative minimum price, an optional maximum (blank means unbounded), and a
   positive term in months; the resulting set of bands must still cover the whole
   price line with no gap or overlap, or the write is refused.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   equipment the shop owns and the rules for writing it off. It does not create
   assets (purchasing does) and does not re-derive a term after purchase — editing
   a band affects only assets created afterward, because `assets.term_months` is
   frozen at creation.

## Where it writes

Disposal is **insert-only** into `asset_disposals`: `disposeAsset` appends one row
and never mutates `assets.quantity` downward and never deletes, so remaining
quantity is always derived (asset quantity minus the sum of disposals) and a
mistaken entry is reversed by a compensating row rather than by editing the past.
The band screen writes `asset_depreciation_bands` via insert, update, and hard
delete — deletion is safe because `assets.term_months` is a frozen value carrying
no foreign key back to the band that produced it. The generated map at
`docs/generated/system-map.md` confirms exactly these two write relations for the
two declared files.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md

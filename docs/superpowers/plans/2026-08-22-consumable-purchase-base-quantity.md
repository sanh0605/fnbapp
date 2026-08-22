# A consumable purchase records purchase units where every count records base units

**Written 2026-08-22 by Opus 5.** Handoff to Sonnet 5 for `OPEN-ITEMS 56`.
Critique before coding (`CLAUDE.md` §1) — in particular §3's choice of gate and
§4's claim that all 164 existing lines are RAW.

Found while checking batch 3's own critique, which stated that the server
"already handles a missing conversion correctly for any non-RAW item". It does,
**for equipment** — where rate 1 is right because equipment has no conversions
at all. The same line is wrong for **consumables**, which have had conversions
since batch 1.

---

## 1. The defect

`lib/purchase-ledger-rebuild.ts:61`:

```ts
const isRaw = Boolean(input.item.base_ingredient_id);
const conversion = isRaw ? resolveConversion(input.line, purchasedItemId, input.conversions) : null;
```

With `conversion` null the function falls to `conversionRate = 1` and
`quantityChange = quantity`. That value is written to
`purchase_order_lines.base_quantity`, and `computeOnHandByPurchasedItem`
subtracts `stock_issues.base_quantity` from it — which stocktake and issue
slips write in **base** units (counted packages × `conversion_rate`).

**Worked example, real catalogue data.**

> `Ống hút nhỏ` (`SPM-053`), base unit **g**, conversions `kg = 1000 g` and
> `Bao = 500 g`.
> Buy **2 Bao** → `base_quantity` stored as **2**.
> Count **1 sealed bag** → the stocktake computes **500 g**.
> On hand: **2 − 500 = −498**.

`unit_cost` is wrong by the same factor: `landedCostTotal / quantity_change`
yields đồng per **bao**, not per **gram**, so `lib/issue-costing.ts` would value
every issue at 500× the true rate.

**`isRaw` is a stale proxy for "has conversions".** The two were the same thing
when this was written; batch 1 gave consumables their own conversions and they
stopped being the same thing. Identical in shape to `OPEN-ITEMS 47`.

## 2. Nothing is wrong in the data yet

All 25 consumables have **0** purchase lines. There is **no backfill** in this
task, and there must not be one — if a repair looks necessary, the premise has
changed and that is worth reporting rather than acting on.

Verified on live data that RAW is unaffected and must stay so: every line whose
`conversion_rate <> 1` already stores base units — `Sữa tươi Mlekovita` 60 chai
→ **60.000 ml**, `Trân châu trắng Bibi` 2 túi → **4.000 g**, `Bột cà phê truyền
thống Phin Đậm` 10 túi → **5.000 g**.

## 3. The fix

Resolve a conversion whenever the item **has** one, instead of whenever it is
RAW:

```ts
const itemHasAnyConversion = input.conversions.some(
  candidate => candidate.purchased_item_id === purchasedItemId,
);
const conversion = itemHasAnyConversion
  ? resolveConversion(input.line, purchasedItemId, input.conversions)
  : null;
```

**Gate on existence, not on `status`.** Equipment has literally zero rows, which
is the real discriminator. Filtering to ACTIVE would mean an item whose only
conversion was later deactivated falls back to rate 1 — silently reintroducing
this same defect for the one item most likely to have old purchase lines
pointing at that conversion. `resolveConversion` looks up by id without a status
filter, so an old line referencing a deactivated conversion still resolves,
which is the C17 spirit (`lib/purchased-item-onhand.ts`).

**The hole closes for free.** `resolveConversion` already throws
`Thiếu quy đổi cho dòng …` when nothing matches, so a consumable line that
somehow arrives without a resolvable conversion now fails visibly instead of
silently recording purchase units. Do not add a second guard; do not soften the
throw.

**Same stale proxy, second site.** `lib/historical/purchase-ledger-audit.ts:169`
has `item.base_ingredient_id ? Number(conversion.conversion_rate) || 0 : 1`. An
audit that disagrees with the path it audits reports false discrepancies, so fix
both in this commit. Check whether other callers exist before assuming these are
the only two.

## 4. Verification

- **Neutrality per row, not by argument** (`fnbapp-bulk-data-change` step 3).
  Every one of the **164** existing `purchase_order_lines` belongs to a RAW
  item — consumables have no lines and no equipment item exists. Replay
  `buildPurchaseReceipt` over all of them before and after, comparing
  `quantity_change`, `unit_cost` and `landed_cost_total`. **Report the count
  compared alongside the count that differed**; "0 differences" out of an
  unstated total is the failure mode this rule exists for. Confirm the 164
  yourself rather than taking it from here.
- **A test that fails first, and is not trivially failing.** A CONSUMABLE item
  with `Bao = 500 g`, buying 2 Bao, must yield `quantity_change` **1000** and a
  `unit_cost` per gram. Run it against the current code and report the wrong
  values it produces (expected: 2, and cost per bao). Note explicitly whether
  each new test fails for the right reason or merely because a symbol does not
  exist yet — batch 3's six validation tests all failed pre-fix, but five of
  them only because the extracted function was absent.
- **Equipment stays exactly as it is:** zero conversions → rate 1 →
  `quantity_change = quantity`. This is the case batch 3 depends on; breaking it
  would block the 63 equipment purchase orders the owner is about to enter.
- **RAW stays exactly as it is**, including a line pointing at a now-INACTIVE
  conversion.
- `scripts/verify-revenue.ts` unchanged — purchases are not revenue.
- No migration. No data change. Nothing to apply.

## 5. Out of scope

Entering any purchase; `OPEN-ITEMS 53`, `54` and `55`, which batch 3 raised and
which are separate; and any change to how `stock_issues` records quantities —
the issue side is correct and is the side this makes the purchase side agree
with.

## 6. Done means

`CLAUDE.md` §9 in full, plus §4. Do not push — the owner approves each push.

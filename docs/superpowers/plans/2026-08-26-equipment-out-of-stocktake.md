# Equipment must leave the stocktake by category, not by a per-item tick

**Written 2026-08-26 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1), in particular §2's claim that ticking equipment would
double-count it in the P&L.

## 1. The mistake this corrects

The owner was about to enter 72 equipment items and had been told to tick
**"Không quản lý tồn kho"** (`purchased_items.is_non_inventory`) on each. He
asked why. The reason given was sound — equipment carries no conversions, so an
unticked equipment item becomes a stocktake line with nothing to count — but the
remedy was wrong.

**That flag carries a second meaning.** `BR-COGS-007` makes purchases of
`is_non_inventory` purchased items the *"Nguyên liệu mua dùng ngay"* line: the
whole purchase cost expensed in the month it was bought. The rule's own text
notes this is "not yet reached by the expense line itself — batch 5 of Plan J is
what makes this column feed money".

Equipment is not expensed on purchase. It is **depreciated** over 12/24/36
months by the asset register (`lib/asset-depreciation.ts`, migration `0069`).

So ticking all 72 would, once batch 5 lands, put **11.660.817đ** into expense in
the months of purchase **and** continue charging roughly **700.236đ/month** of
depreciation for the same items. The same money, twice, in a report built to
answer *"quán tôi có lãi không?"*. Neither figure looks wrong alone, which is
what makes it dangerous.

## 2. The correct rule

**"Equipment is never stocktaken" is a property of the category, not a judgement
per item.** No spade needs counting; no scale needs counting. `CLAUDE.md` §7's
distinction applies: what varies with how the shop runs gets a screen, what is
fixed gets code. This is fixed.

Asking the owner to tick 72 boxes to express one category-wide fact is also 72
chances to miss one.

So: **`startStocktakeSession` must exclude `item_categories.system_type =
'EQUIPMENT'`**, alongside the two exclusions it already applies (a flagged
ingredient, or the item's own `is_non_inventory`).

Do **not** remove the checkbox — it is still right for CONSUMABLE items, where
the shelf question genuinely varies item by item (straws in sealed bags are
counted; carrier bags bought by the kilo are not). Only its use on equipment was
wrong. Consider whether it should stop being *shown* for EQUIPMENT at all, and
argue the answer rather than assuming it.

## 3. Verification

- **A test that fails first:** an ACTIVE `EQUIPMENT` purchased item with
  `is_non_inventory = false` must be absent from a new stocktake session. Against
  today's code it is present. Report whether it fails on a wrong value or a
  missing symbol.
- **The 77 items that exist today do not move.** Measured 2026-08-26: 52 RAW and
  25 CONSUMABLE, **0 EQUIPMENT** — so nothing in production changes yet, and the
  test above needs a fixture rather than live data. Say that plainly instead of
  reporting "no change" as if it were evidence.
- A CONSUMABLE with the tick stays excluded; a CONSUMABLE without it stays
  included. The existing behaviour must not shift.
- `CLAUDE.md` §9's four gates. No migration. Do not push.

## 4. Not in scope, but record it

When batch 5 builds the expense line from `is_non_inventory`, it must also
exclude anything the asset register already depreciates, or the double count
returns through a different door. That belongs in batch 5's own plan; note it
in `docs/OPEN-ITEMS.md` so it is not rediscovered by finding a wrong P&L.

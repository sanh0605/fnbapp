# The unit belongs to the item, not to its group

**Written 2026-08-29 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

The surviving half of `docs/superpowers/plans/2026-08-28-two-tier-categories-step-1.md`
— its stock-keying half died when the owner decided to retire the ledger.

**This is what is blocking him from entering 15 real purchase rows.**

---

## 1. The problem, in his words

> *"Đơn vị trong 'nhóm nguyên liệu' của cả 2 là trái, nhưng khi nhập hàng thì
> lại tính kg. Mà đơn vị của 'nhóm nguyên liệu' thì chỉ được chọn 1."*

Trái tắc and Trái chanh are counted in *trái* by their tier-2 group and bought
by the *kg*. A group has one unit, so the two cannot both be true, and he cannot
record the purchase at all.

## 2. Where the dependency actually lives — two screens, two rules

**Not one rule applied inconsistently. Two screens that disagree.**

| Screen | Where `base_unit` comes from |
|---|---|
| **Hàng Mua Vào** (`PurchasedItemForm.tsx`) | a selector on the form — but **only for CONSUMABLE and EQUIPMENT**. A RAW item inherits its group's |
| **Bảng Quy Đổi** (`ConversionForm.tsx:47`) | **always** the tier-2 group's unit; an item with no group is refused outright (line 56) |

That second screen is why a consumable cannot get a conversion there at all, and
why every raw material is nailed to its group. The state variable is even named
`selectedConsumableBaseUnitName` — the split is baked into the vocabulary.

**The tier-2 group must stop supplying the unit on both screens.** After this it
supplies nothing; it is a label to group a report by, which is what the owner
decided on 2026-08-28.

## 3. Why this is safe — and the one place it is not

**Every purchased item already carries its own base unit.** All 146 have
`uom_conversions` rows and every row sets `base_unit`; for the 52 raw materials
**all 57 match their group's unit, 0 mismatches** (measured 2026-08-28). The
group's unit is a duplicate that agrees, so removing it removes a copy.

**The danger is changing an existing item's base unit, not choosing a new one.**
`purchase_order_lines.base_quantity` and `stock_issues.base_quantity` are stored
in base units. Re-pointing an item from *trái* to *kg* silently reinterprets
every quantity ever recorded for it, and on-hand — purchases minus issues — goes
wrong without a single error.

**Measured 2026-08-29: 51 of 52 raw items already have purchase lines.** So this
is not a hypothetical.

## 4. The rule

**Free at creation. Locked once the item has been bought.**

- **Creating** an item of any category: choose the base unit. No inheritance
  from the group, no category branching.
- **Editing** an item that has any `purchase_order_lines` or `stock_issues` row:
  the base unit is shown **read-only**, with a Vietnamese sentence saying why —
  every recorded quantity is expressed in it.
- **Editing** an item with neither: still free.

**This is the same shape as the product rule the owner approved on 2026-08-29** —
untouched by history, so editable; touched by history, so frozen. Reuse the
shape deliberately; two rules that behave alike should look alike.

**Unlike the product rule, the database will not enforce this one.** There is no
constraint that notices a unit changing meaning. It has to be a real check, and
it has to be tested, because nothing else will catch it.

## 4b. The existing lock is narrower than this change needs — Sonnet found it

`updatePurchasedItem` and `updateConversion` already refuse to change a
conversion's `base_unit` when that **row** is referenced by a purchase line. Two
holes, and they are not equal:

**The one this change creates, and the serious one.** The check is **per
conversion row**. `addConversion` (`conversions/actions.ts`) validates only that
`base_unit` is non-empty and inserts — **it never compares against the item's
other conversions**. That is harmless today *only because* the unit is derived
from the group, so every row agrees by construction. **Removing that derivation
removes the thing that was holding it together**, and a second conversion row
carrying a different base unit would then be accepted silently. Verified at the
line.

**The one that is real but not yet exposed.** Neither check looks at
`stock_issues`, only `Purchase_Order_Lines`. Measured 2026-08-29: **0 items have
issues without purchases** — 91 purchase-only, 50 both, 5 with no history — so
nothing is unprotected today. Sonnet read the coverage figures as "2 RAW items
are issue-only"; they are `Đá viên` (no history at all) and `Khoai lang` (22
purchases, 0 issues), which is the opposite shape. **Close the hole anyway** —
the shared helper covers it for free and a stocktake can find stock for an item
never purchased through the app — but do not justify it with an exposure that
does not exist.

**One item-level check, called from both screens**, replacing two per-row checks
that have already drifted apart: does this item have **any** purchase line or
stock issue, and does the submitted `base_unit` match what its conversions
already carry. Verified this is well defined: **0 of 146 items have conversions
that disagree with each other** on `base_unit`.

**`base_ingredient_id` keeps its current RAW requirement.** §5.3 was ambiguous
and Sonnet read it correctly: this plan moves where the *unit* comes from and
nothing else. Whether a raw material must belong to a group at all is the
owner's design question, not a consequence of this one — it does not block him,
since both `Trái tắc` and `Trái chanh` already exist as groups.

## 5. The change

1. `PurchasedItemForm.tsx` — offer the base-unit selector for **RAW** too, and
   stop reading `baseIngredient.base_unit`. Rename
   `selectedConsumableBaseUnitName`; the name is the bug's fingerprint.
2. `ConversionForm.tsx` — take the base unit from the **item's existing
   conversions** (they all share one, and the code already relies on that), not
   from the group. Remove the refusal at line 56 so a consumable can be given a
   conversion on this screen too.
3. `base_ingredient_id` stays on the item, optional, for grouping. **Do not
   remove the column** — that belongs to the recipe-deletion work, not here.

## 6. Verification

- **Test first, failing on the value:** creating a RAW item with base unit `kg`
  whose group says `trái` stores `kg`. Today it stores `trái`. State whether the
  pre-fix failure was the value or a missing field.
- **The lock is tested, not just the freedom:** editing an item that has a
  purchase line cannot change its base unit. A guard nobody tested is a guard
  that will not hold — and this one has no database backstop.
- **On-hand unmoved for all 146 items**: diff the whole
  `computeOnHandByPurchasedItem` map before and after. This change exists near
  the number it must not touch.
- Full `CLAUDE.md` §9.

## 7. Done means

`CLAUDE.md` §9. Do not push without approval. **Then the owner creates Trái tắc
and Trái chanh in kg and records one real purchase** — 15 rows of his own cash
book are waiting on exactly this, and no test proves the screen let him.

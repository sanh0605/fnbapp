# A purchased item needs its own "not stock-managed" flag

**Written 2026-08-21 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` section 1) — in particular section 4's claim about where the
stocktake filter must change, and section 5's claim that no existing item's
eligibility moves.

Brought forward from `docs/superpowers/plans/2026-08-17-expenses-and-pnl.md`
§10/§11.1, which had parked `is_non_inventory` in batch 5. The owner hit it
early, from the shelf side rather than the accounting side, while preparing to
enter 27 consumables.

---

## 1. The gap, stated exactly

`is_non_inventory` exists as a column on **`base_ingredients`** and is set on
seven rows today: `Đá viên`, `Nước`, `Nước sôi`, `Muối hồng`, `Trái tắc`,
`Trái chanh`, `Khoai lang`. `BR-COGS-007` already gives it a meaning.

**A consumable has no `base_ingredient_id`**, so there is nowhere to put the
flag for one. That is the whole defect.

**The consequence is live, not theoretical.**
`app/admin/inventory/stocktake/actions.ts:205` builds a new session from:

```ts
const eligiblePurchasedItems = purchasedItems.filter(
  p => !nonInventoryBaseIngredientIds.has(p.base_ingredient_id),
);
```

A consumable's `base_ingredient_id` is `null`, which is not in that Set, so
**every consumable is offered for counting**. `SPM-053` and `SPM-054` (the two
straw items) already qualify. Enter the remaining 25 and the next stocktake
asks staff to count plastic spoons and bin bags — the owner's exact words:
*"anh càng không thể thuê 1 nhóm người chỉ để kiểm kê tồn kho của muỗng hay
túi rác"*.

## 2. What the owner actually decided, and the rule underneath it

The first split proposed to him was wrong, and the correction is the useful
part: the discriminator is **not** "is it a consumable". It is `BR-INV-007` —
**does a sealed pack of it sit on the shelf to be counted?**

Both straws and carrier bags are bought by the kilo, and they split opposite
ways: straws arrive in sealed 500 g bags (countable), carrier bags arrive as a
loose bundle (not). Spoons arrive as 3.000 loose pieces (not). Baking soda
arrives as a sealed 454 g bag (countable).

**Not stock-managed — 8 items**, the flag's targets:

`Muỗng nhựa - màu đen` · `Túi rác` · `Túi chữ T` · `Túi Chữ T 12.5x26 - 2kg` ·
`Túi PE 1 Ly Seal 17.5x32.5` · `Túi PE 2 Ly Seal Ép Ngăn 32x32.5` ·
`Túi xốp 1 Ly` · `Túi đựng khoai`

The other 20 consumables are counted normally. **Do not hard-code either
list** — the owner sets the flag per item as he enters them, and the list will
change. It is here only so the work can be checked against something real.

## 3. Scope

1. **Migration:** `is_non_inventory boolean not null default false` on
   `public.purchased_items`. Same name as the `base_ingredients` column, on
   purpose — one concept, one name.
2. **Form:** a checkbox on `PurchasedItemForm`, labelled in Vietnamese, with a
   one-line explanation of what ticking it does. Shown for **CONSUMABLE and
   EQUIPMENT**, not RAW — a RAW item inherits the decision from its ingredient
   and two sources for one answer is how they drift apart.
3. **Stocktake:** extend the filter at `stocktake/actions.ts:205` so an item is
   excluded when **either** its ingredient is flagged **or** its own flag is
   set. Additive, never replacing.
4. **`BR-COGS-007`:** its "Nguyên liệu mua dùng ngay" row says *"purchases of
   `is_non_inventory` ingredients"*. That is now too narrow. Widen it to cover
   flagged purchased items and record the 2026-08-21 decision and its reason,
   **in the same commit as the code** (`CLAUDE.md` section 2).

**Out of scope:** the P&L expense line itself (batch 5 — nothing reads this for
money yet), any change to how cost is computed, and entering the items.

## 4. Where this must NOT be done

Not in `filterByC17` (`lib/conversion-countability.ts`), which answers a
different question — whether an item *can* be counted at all, having at least
one countable conversion. Merging "cannot be counted" with "deliberately not
counted" would make `OPEN-ITEMS 37`'s guard unreadable and would hide a real
data problem behind a policy choice.

## 5. Verification

- **A stocktake test that fails first:** start a session with a purchased item
  carrying `is_non_inventory = true` and assert it is **absent** from the
  session's lines, while an unflagged sibling is present. Run it against
  current code and report that it fails; a filter test that never failed has
  not been shown to filter.
- **A render test** (`OPEN-ITEMS 38`, and 46's limit — assert rendering, not
  submission): the checkbox appears for `Vật tư tiêu hao` and for `Dụng cụ`,
  and does **not** appear for `Nguyên liệu`.
- **Nothing existing moves:** the 52 pre-existing purchased items must have the
  same stocktake eligibility before and after. Report the count compared, not
  just that it matched — a vacuous zero is the failure mode
  (`fnbapp-bulk-data-change` step 3).
- The migration adds a defaulted column, so list the target table's triggers
  first and prove no row was rewritten (`max(updated_at)` unmoved), the same
  way `0067` was checked.
- `scripts/verify-revenue.ts` unchanged.

## 6. Done means

`CLAUDE.md` section 9 in full. **Do not apply the migration to production** and
do not push — both are the owner's per-instance call. Leave the migration file
ready and say so.

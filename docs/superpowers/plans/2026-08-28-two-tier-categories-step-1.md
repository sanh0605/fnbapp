# Step 1 — one way to enter goods, and a group that only groups

**Written 2026-08-28 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

Step 1 of the three the owner set on 2026-08-27. Steps 2 and 3 (deleting
recipes, semi-products and their files) follow and are planned separately in
`docs/superpowers/plans/2026-08-27-remove-recipes-and-semi-products.md`.

---

## 1. What the owner decided, in his words

> *"Có thể gộp, nhưng gộp chỉ mang tính chất thống kê, không còn là nối dữ
> liệu. Hoặc nói cách khác, đó là danh mục cấp 2, còn danh mục cấp 1 là nguyên
> liệu, vật tư tiêu hao, dụng cụ. Từ đó, HÀNG MUA VÀO sẽ không phụ thuộc vào
> đơn vị của NHÓM NGUYÊN LIỆU nữa."*

| Tier | What it is | What it decides |
|---|---|---|
| **1** — `item_categories` | Nguyên liệu / Vật tư tiêu hao / Dụng cụ | How the money is treated: cost of sales, immediate expense, or depreciation |
| **2** — `base_ingredients` | Bột cà phê, Sữa tươi, Trái tắc | **Nothing.** A label to group a report by |

Confirmed with him against three real examples before this was written
(`CLAUDE.md` §5), including the one that started it: **Trái tắc becomes a
Nguyên liệu whose own unit is kg, while its tier-2 label stays "Trái tắc" and
no longer forces "trái".**

## 2. The whole dependency is one line

`lib/purchase-ledger-rebuild.ts:108`:

```ts
item_reference: input.item.base_ingredient_id || purchasedItemId,
```

A purchase of a raw material is recorded against the **ingredient**; anything
else against the **purchased item**. That single fallback is the "two ways of
entering" the owner is describing, and `stock_ledger` shows both:
**253 rows keyed on an ingredient, 129 on a purchased item.**

Change it to `purchasedItemId`, unconditionally.

## 3. Why this is nearly free — measured, 2026-08-28

**Every purchased item already carries its own base unit.** All 146 have
`uom_conversions` rows, and every one of those rows sets `base_unit`. For the 52
raw materials, **all 57 conversions match their group's unit exactly — 0
mismatches.** The group's unit is a duplicate that happens to agree, not a
source.

So severing the dependency removes a copy, not a fact. `purchased_items.
default_unit_id` exists and is **NULL on all 146 rows** — it has never been
used; do not start now, the conversions already answer this.

**No backfill is required for the on-hand figure.**
`lib/purchased-item-onhand.ts` computes on-hand as purchases from
`purchase_order_lines` minus issues from `stock_issues`, **keyed by
`purchased_item_id`** — it reads neither `stock_ledger` nor
`inventory_balances`. The live stock number is already per purchased item. The
253 ingredient-keyed ledger rows feed nothing it uses.

## 4. What this plan does NOT do, and why

**It does not re-key the 253 historical `stock_ledger` rows.** They can mostly
be traced — 170 come from purchase receipts and 45 of the remaining 83 join back
to a `stock_issues` row that names the item — but **38 cannot be resolved from
what is stored**, and a purchase order containing two brands of one ingredient
is ambiguous by construction, because the ledger row references the order, not
the line.

Re-keying them would be a production write, partly guessed, to fix a number
nothing reads. **Leave them.** If a later feature needs one consistent key, that
is its plan's problem and it will have a reason this one lacks.

**Sonnet must establish one thing this plan could not:** twelve files read
`stock_ledger` or `inventory_balances`. Enumerate which of them **display a
figure to the owner**, and say plainly whether any screen will show a raw
material's stock split by brand from now on while its history stays pooled under
the group. If one does, that is a real seam the owner should be told about
before this ships — not after.

## 5. The change

1. `lib/purchase-ledger-rebuild.ts:108` → always `purchasedItemId`.
2. The purchased-item form stops requiring a tier-2 group for Nguyên liệu. The
   field stays, optional, for reporting.
3. Nothing about `base_ingredients.base_unit` is read for a purchase any more.
   **Leave the column** — deleting it is step 3's business, not this one.

**Do not touch the issue-slip, stocktake or COGS paths.** They already key on
`purchased_item_id` (94 of 94 `stock_issues` rows carry one). This step brings
purchases into line with them; it does not move them.

## 6. Verification

- **Test first, failing on the value:** a purchase of a raw material writes a
  `stock_ledger` row whose `item_reference` is the **purchased item id**. Today
  it is the ingredient id. State whether the pre-fix failure was the value or a
  missing function.
- **A second test that must keep passing:** a purchase of a consumable is
  unchanged. Without it, "always use purchasedItemId" could pass while breaking
  the path that was already right.
- On-hand is unmoved for every item: run `computeOnHandByPurchasedItem` before
  and after and diff the whole map, not a sample.
- `scripts/verify-revenue.ts` unmoved. COGS unmoved. Full `CLAUDE.md` §9.
- Report the new split of `stock_ledger` keys, with its denominator.

## 7. Done means

`CLAUDE.md` §9. Do not push. **Then the owner enters one real purchase of Trái
tắc in kg** — that is the thing this step exists to unblock, and no test proves
it.

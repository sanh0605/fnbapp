# Equipment needs a base unit and conversions, like everything else

**Written 2026-08-26 by Opus 5**, from the owner's observation. Handoff to
Sonnet 5. Critique before coding (`CLAUDE.md` §1), in particular §3 — which
argues the depreciation-band risk is **real in principle but does not bite on
his current data**, and that overstating it would be the easier and worse story.

## 1. What the owner said

Entering the equipment catalogue, he asked why equipment has no unit at all:

> *"Muỗng nhựa định lượng 10g thì đáng lẽ đơn vị nhỏ nhất là 'cái'. Nhưng nếu
> anh nhập 1 thùng thì thay vì anh phải nhớ là 1 thùng 50 cái xong nhân theo số
> lượng … nó sẽ rất phiền và càng làm cho dữ liệu lịch sử không chính xác thực
> tế."*

He is right, and the reason he gives is the strongest one: a purchase line
should record **what the invoice says**. Forcing the arithmetic into his head
loses the fact that he bought a box, and stores a number he computed rather than
one he read.

Today `PurchasedItemForm.tsx` gates the base-unit selector and conversion rows
on `isRaw || isConsumable`. `EQUIPMENT` gets neither — a decision from batch 1
§B3 that was never argued, only asserted.

## 2. The concrete consequence

`lib/asset-purchase-allocation.ts:66-67`:

```ts
const unitCost = Math.round(allocatedTotal / line.quantity);
const band = findBandForUnitPrice(bands, unitCost);
```

`line.quantity` is in **purchase units**. Buy one box of ten bottles for
108.000đ and the asset register records **quantity 1** at **108.000đ each** —
so the register answers *"the shop owns 1 thing"* when it owns **10 bottles**.

`BR-COGS-008` and Plan J §8.2 say the register exists to answer *"quán đang có
những gì"*. One where there are ten is wrong on the register's own terms,
independently of any money question.

## 3. The band risk is real but does not bite today — checked, not assumed

The same line picks the depreciation term from `unitCost`, so a box price
instead of a unit price can land in the wrong band. That is a genuine hazard
and it is why this should be fixed before the equipment purchase orders are
entered.

**But it changes no term in the owner's actual history.** All 78 equipment
purchase lines were examined; **4** use a genuine multi-unit pack:

| Item | Pack | Line total | Band as a pack | Band per unit |
|---|---|---|---|---|
| `Chai nhựa HDPE 1000ml` | Combo 10 | 108.000đ | 12 months | 12 months |
| `Muỗng nhựa định lượng 10g` | Combo 5 | 18.417đ | 12 months | 12 months |
| `Bình đựng nước 1000ml` | Combo 2 | 116.000đ | 12 months | 12 months |
| `Thùng đá 11L và 25L` | Combo | 482.820đ | 24 months | see below |

None of the first three crosses a band boundary, so no historical term moves.
The rest of the "pack-looking" units — `Cây`, `Hộp`, `Bộ` — are the shape of the
object, not a quantity: a `Cây rửa ly` is one brush, not a bundle.

**`Thùng đá 11L và 25L` is a different problem and must not be solved here:**
it is *two different items* on one line, which no conversion expresses. Flag it
to the owner as a data question — probably two catalogue items — rather than
inventing a conversion for it.

So the honest case for this work is the owner's own: correct quantities, and not
making him do arithmetic. The band argument is a reason to do it **before** the
purchase orders, not evidence that anything is already wrong.

## 4. The change

1. **Show the base-unit selector and conversion rows for `EQUIPMENT`** in
   `PurchasedItemForm.tsx`, the same as `CONSUMABLE`. The gate becomes
   "not RAW-only", or simply all three categories — argue which reads better.
2. **`lib/asset-purchase-allocation.ts` must divide by the base quantity**, not
   the line quantity, and the asset's `quantity` must be the base quantity. One
   box of ten becomes ten units at a tenth of the price. Where the item has no
   conversion, base quantity equals line quantity and nothing changes.
3. Equipment still must not appear in stocktake. That is
   `docs/superpowers/plans/2026-08-26-equipment-out-of-stocktake.md`, which
   excludes by **category** — so giving equipment conversions does not drag it
   back in. **Land that one first or together**, never this one alone.

## 5. Sequencing, which matters more than the code

The owner is entering the 72 equipment names **now**. He should keep going:
adding a unit later through the edit form is cheap, and blocking 72 entries for
4 affected lines would be worse.

**What must not happen is entering the 63 equipment purchase orders before this
lands** — a purchase recorded as "1 combo" creates an asset row that is wrong,
and asset rows are not something to rewrite afterwards. Tell him this plainly.

## 6. Verification

- **A test that fails first:** an EQUIPMENT item in the form shows the base-unit
  selector; today it does not.
- **The allocation test with the owner's own numbers:** one line, 1 `Combo 10`,
  108.000đ, conversion `1 Combo 10 = 10 Chai` → asset `quantity` **10**,
  `unit_cost` **10.800đ**. Against today's code it is 1 at 108.000đ.
- An equipment item with **no** conversion still produces quantity = line
  quantity, unchanged.
- Equipment stays out of a new stocktake session.
- **`assets` holds 0 rows** (verified 2026-08-26), so there is no backfill —
  re-check immediately before implementing and say so.
- `CLAUDE.md` §9's four gates. Do not push.

## 7. Done means

`CLAUDE.md` §9 in full, plus §6.

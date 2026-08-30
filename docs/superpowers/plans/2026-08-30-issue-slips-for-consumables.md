# Issue slips have never worked for consumables

**Written 2026-08-30 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). **Blocking the owner now.**

---

## 1. What he hit

Recording an issue slip for cups and lids:

```
create_issue_slip_atomic: Dòng 1: Combo ly + nắp nhựa PP chưa gắn với
nguyên liệu gốc, không thể ghi phiếu xuất
```

`supabase/migrations/0060_issue_slip_multiline.sql:141` refuses any purchased
item with no `base_ingredient_id`. Consumables have none by design.

## 2. This is not a new bug — it has never worked

**Measured 2026-08-30: all 95 issue rows ever recorded are `Nguyên liệu`. Zero
consumables, ever.**

So the 26 consumables entered in batch 2 can be bought and never issued. Their
cost has only one route into the P&L — a stocktake variance — and
`BR-COGS-007` reads that as *hao hụt*, not *giá vốn*. **Cups consumed by selling
drinks have been landing in the shrinkage line, or nowhere.**

That is worth stating to the owner in those terms: this is not a screen refusing
a click, it is a cost that has never had a correct path.

## 3. Why the guard exists — and why it can go

The ingredient is used for exactly three things in that function:

| Line | Use |
|---|---|
| 141 | the guard itself |
| 175 | look up a unit **name**, for an error message |
| 194 | **`stock_ledger.item_reference = v_base_ingredient_id`** |

**The guard exists to key a `stock_ledger` row** — the ledger the owner decided
on 2026-08-28 to retire (`docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md`).
`stock_issues` itself is keyed on `purchased_item_id` and is the authoritative
record; `computeOnHandByPurchasedItem` reads it, not the ledger.

**So the thing blocking him is removed by work he has already approved.**

## 4. The change

A migration replacing `create_issue_slip_atomic`:

1. **Delete the `base_ingredient_id` guard.**
2. **Stop writing the `stock_ledger` row.** This is the retirement plan's phase C
   applied to one function, out of its planned order because this one blocks
   him. Say so in the commit rather than letting it look like scope drift.
3. **Get the unit name from the item's own `uom_conversions.base_unit`**, not
   from the ingredient — every item has conversions and they all agree on one
   base unit (verified: 0 of 146 disagree). The error message must keep working
   for a consumable, which today it could never reach.

Everything else in the function — the running-balance seed, the
purchase-before-issue check, the over-issue refusal — stays byte-identical.
Copy it forward, the discipline `0074` used.

**`reverse_manual_issue_atomic` carries the same guard**
(`0058_reverse_manual_issue.sql:74`). A consumable slip that cannot be reversed
is worse than one that cannot be written. **Fix both or neither.**

## 5. Verification

- **Test first, failing on the value:** an issue slip naming a consumable
  succeeds. Today it raises the exception in §1 — say whether the pre-fix
  failure was that exception or a missing function.
- **The refusals that must survive:** issuing more than is on hand still fails;
  issuing before any purchase still fails. Those guards are the real protection
  and this change sits next to them.
- **Reversal tested on a consumable**, not only creation.
- **On-hand unmoved for all 146 items** before and after — diff the whole map.
- `stock_ledger` gains **no new rows** from an issue slip after this. Assert the
  count across a real slip.
- Full `CLAUDE.md` §9.

## 6. Done means

`CLAUDE.md` §9. **The migration needs the owner's approval to run, separately
from any push.** Then he records one real issue slip for cups — the one in his
screenshot — and it saves.

**And tell him what it means for his numbers:** every cup, lid, straw and bag
consumed since April has never been issued. Nothing in this plan backfills that.
Whether to, and how far back, is his decision and belongs in its own plan.

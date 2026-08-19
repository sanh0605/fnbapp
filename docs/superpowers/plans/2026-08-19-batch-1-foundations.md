# Batch 1 — Foundations (technical plan)

**Written 2026-08-19 by Opus 5.** Implements batch 1 of
`docs/superpowers/plans/2026-08-17-expenses-and-pnl.md` §10. That document
holds the decisions and the owner's reasoning; this one holds the design.

Two items. §10's third — excluding `is_non_inventory` from the issue-costing
engine — **moved to batch 5** by the review (§11.1): it blocks nothing here.

**Nothing in this batch is visible on a screen.** Its whole purpose is that
batch 2 can create the 26 consumable items without creating the next
`Sữa yến mạch`.

---

## A. Duplicate-name guard

### A1. Scope: within a table, never across

Seven catalogue tables today: `purchased_items`, `base_ingredients`,
`semi_products`, `products`, `item_categories`, `units`, `suppliers`.

**Across tables the same name is normal and must stay legal.** Measured
2026-08-19: pooling all 226 names gives **16** collision groups against **3**
within tables. `Đá viên` is `SPM-005` (bought) and `ING-001` (the ingredient
it becomes); `Dâu sấy` is `SPM-033`, `ING-028` and `PROD-035`. A global rule
refuses the next ordinary catalogue entry.

### A2. Two layers, and neither replaces the other

**The database index is the guard.** It cannot be bypassed by a script, a
second code path, or a future screen nobody remembers to check.

**The application check is the message.** A raw unique-violation is unreadable;
the owner must see *"Tên này đã có rồi"* naming the row that holds it.

Building only the app check leaves the hole open. Building only the index
ships an error he cannot act on. Both, or the item is not done.

### A3. Normalisation

The five steps §9.2 approved, as one Postgres expression:

```
lower(
  regexp_replace(
    btrim(
      normalize(replace(name, chr(160), ' '), NFC)
    ),
    '\s+', ' ', 'g'
  )
)
```

Innermost first: non-breaking space (`chr(160)`) becomes an ordinary space;
Unicode composition is normalised so `ế` typed two ways compares equal; ends
trimmed; internal whitespace runs collapsed; case folded.

**Verify every function used is `IMMUTABLE`** before building the index — an
expression index requires it, and the migration fails loudly if not. Do not
work around a failure by dropping a step; report it.

### A3b. Two levels — block on the same name, warn on the same letters

**Owner decision 2026-08-19, revising §9.2.** He asked for `Ca phe` to be
caught as a duplicate of `Cà phê`, which stripping diacritics does. Shown the
cost of stripping, he chose a warning rather than a refusal.

**The cost, measured, not argued.** Strip diacritics and **`Dứa` and `Dừa`
become the same word** — pineapple and coconut. This catalogue already holds
`Thạch dừa` (`NNL-009`, `SPM-047`), so a blanket rule would one day refuse
`Thạch dứa` on a drinks menu with no explanation the owner could act on. Same
for `Cam`/`Cám`, `Chanh`/`Chánh`, `Sả`/`Sa`.

| Level | Trigger | Behaviour |
|---|---|---|
| **1 — refuse** | §A3's expression matches an existing live row | Blocked outright. Same name, nothing to ask. |
| **2 — warn** | only the **diacritic-stripped** forms match | Show the existing row, ask *"món khác đúng không?"*, proceed only on confirmation |

Typing `Ca phe` hits level 2, he answers *"tôi gõ nhầm"*, and the mistake is
caught. Adding `Thạch dứa` hits level 2, he answers *"món khác"*, and it saves.

**The confirmation is recorded as a field, not a note** — same reasoning as
`Không nhớ` in the parent plan §9.3: a later question like *"which items were
created despite a warning"* has to be answerable by a query.

**Level 2 lives in the application, not the database.** It needs a human answer,
so it cannot be an index. `unaccent` is available but **not installed** on this
project, and installing it for this would add a dependency for nothing — the
strip is a few characters of TypeScript. Note that `đ`/`Đ` (U+0111/U+0110) are
**not** decomposable, so NFD plus combining-mark removal misses them and they
need an explicit replacement; a strip that leaves `đ` alone would not match
`Ca phe` against `Cà phê` in names containing đ.

**Level 1 stays the unbypassable guard.** The index enforces it whatever code
path writes.

### A4. The partial predicate

`WHERE status = 'ACTIVE'`.

This is what makes the guard installable today. All three existing duplicate
pairs have exactly one live row:

| Name | Rows |
|---|---|
| Sữa yến mạch | `ING-033` ACTIVE · `NNL-004` INACTIVE |
| Cà phê đá | `PROD-001` ACTIVE · `PROD-010` DELETED |
| Cà phê caramel kem muối | `PROD-036` ACTIVE · `PROD-037` DELETED |

**Confirm before writing the migration** that all seven tables have a `status`
column and that `ACTIVE` is the live value in each. If any differs, stop and
report rather than guessing a predicate.

It also gives retirement its meaning: a retired name becomes reusable, which
is what `CLAUDE.md` section 2's mark-inactive rule needs.

### A5. Verification

- The migration **fails** if run against data containing a live collision —
  demonstrate this on a scratch copy by making two rows ACTIVE with the same
  name, then revert. An index that has never refused anything is not known to
  work.
- Each of the five normalisation steps gets a test that fails without it:
  `" Sữa yến mạch"`, `"Sữa yến mạch "`, `"Sữa  yến mạch"`, `"SỮA YẾN MẠCH"`,
  the NBSP form, and the decomposed-`ế` form.
- A cross-table pair stays legal: creating a `base_ingredients` row named
  `Đá viên` while `SPM-005` exists must **succeed**.
- `scripts/verify-revenue.ts` unchanged — this touches no money.

---

## B. Conversions for consumables

### B1. Four gates, not one

The owner needs `1 bao = 500 g` on ống hút. Four separate conditions block it,
and opening fewer than all four fails silently rather than loudly:

| # | Where | What it gates |
|---|---|---|
| 1 | `PurchasedItemForm.tsx:224` | whether the conversion rows **render** |
| 2 | `PurchasedItemForm.tsx:82` | whether `units_json` is **built and sent** (appended at line 110) |
| 3 | `items/actions.ts:81` | `if (base_ingredient_id && unitsJson && base_unit)` on **create** |
| 4 | `items/actions.ts` update path | the same condition on **update** |

Gate 1 alone — the fix as §8.3 originally described it — renders inputs that
accept typing, report success and discard the data with no error. Gates 3 and 4
were found while writing this plan; the review had caught 1 and 2.

### B2. The design gap: where a consumable's base unit comes from

For a RAW item the form derives `base_unit` from the linked ingredient
(`activeBaseIngredient?.base_unit`). **A consumable has no ingredient**, so
there is nothing to derive it from — and `uom_conversions.base_unit` is
required.

So this is not only an ungating: **the form needs a base-unit selector shown
for consumables**, and gates 3 and 4 must stop requiring `base_ingredient_id`
and require the base unit instead.

Concretely, for the item the owner named:

> `Ống hút đen nhọn P6` · loại **Vật tư tiêu hao** · đơn vị gốc **g**
> quy đổi: `1 bao = 500 g`

### B3. What must not change

- The base-ingredient requirement stays **RAW-only**. A consumable must not be
  forced to invent an ingredient.
- Equipment gets neither section (§8.3).
- No existing RAW item's conversions change. `uom_conversions` has 57 ACTIVE
  rows across 52 items; that count and every rate stays identical.

### B4. Verification

- **A rendered test, not a source grep** (`OPEN-ITEMS 38`): choose
  `Vật tư tiêu hao`, fill a conversion, submit against a mocked action, and
  assert `units_json` **is present in the payload** with the typed values.
  That assertion is the one that fails today, and it is the whole point.
- End to end against a scratch record: create a consumable with `1 bao = 500 g`,
  reload, confirm the `uom_conversions` row exists with `base_unit` = g.
- Editing an existing RAW item saves its conversions exactly as before.
- `computeOnHandByPurchasedItem` returns the same numbers for all 52 items.

---

## C. Out of scope, deliberately

- Creating any consumable or equipment item — that is batch 2 and 3.
- The `is_non_inventory` costing exclusion — moved to batch 5 (§11.1).
- Any screen, report or migration touching money.
- The duplicate guard on tables that do not exist yet (expense categories,
  recurring templates) — they get it when they are created, and this plan's
  helper is what they will use.

## D. Done means

`CLAUDE.md` section 9 in full, plus §A5 and §B4 above. Two commits, one per
item, so either can be reverted alone.

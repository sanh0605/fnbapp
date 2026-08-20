# Consumable base unit: a name is being stored where an ID is required

**Written 2026-08-20 by Opus 5** after the owner tested batch 1 item B on
production. Handoff to Sonnet 5. Critique it before writing code, per
`CLAUDE.md` section 1 — including the claim in section 4 that this is
untestable by DOM submission.

---

## 1. The defect, as observed

The owner created a consumable, chose base unit `Cái`, and the conversion row
rendered:

> `Bao` = `10` **cơ bản**

It must read `Cái`. `cơ bản` is the fallback shown when `baseUnitName` resolves
to empty, so the form does not recognise the unit the user just picked.

**Root cause, in one line:** `unitOptions` is keyed by unit *name*
(`units.map(u => ({ id: u.name, label: u.name }))`, `PurchasedItemForm.tsx:220`
area), so `selectedConsumableBaseUnitId` holds `"Cái"`, while every consumer of
it treats it as a unit *ID* (`"U-003"`).

Two consequences follow from the same mismatch, in opposite directions:

| # | Path | Symptom | Severity |
|---|---|---|---|
| 1 | create | `baseUnitName = units.find(u => u.id === baseUnitId)?.name` → `undefined` → renders `cơ bản`; and `fields.base_unit` is submitted as `"Cái"` | **`uom_conversions.base_unit` gets a name where every existing row holds an ID** (`U-005`, `U-003`, `UNT-017`) |
| 2 | edit | state is seeded from `initialConversions[0].base_unit`, which *is* an ID, into a select whose values are names | the "Đơn vị gốc" field renders **empty** on an item that has one |

Nobody has hit #2 yet only because no consumable has a conversion to open.

**The RAW path is unaffected and must stay untouched.** There
`baseUnitId = activeBaseIngredient?.base_unit`, already an ID, so its lookup
succeeds. All 57 ACTIVE `uom_conversions` rows were written through that path
and are correct.

## 2. What is NOT claimed

`SPM-053 "Ống hút nhỏ"` exists (created 09:38, `NHH-002`, no
`uom_conversions` rows). **Whether that item lost its conversion to this
defect or to the deploy not being live yet at 09:38 is unknown**, and the
screenshots do not settle it — the two that show the new form are timestamped
09:40. Do not write either version into a commit message as fact. The fix is
required on the evidence of section 1 alone.

## 3. The fix

**Make the state hold what the select produces — a name — and resolve to an ID
at the point of use.** This is the smaller change and it matches an idiom
already present in this same file: the conversion-row seeding at
`PurchasedItemForm.tsx:~100` already converts a stored ID to a name with
`units.find(u => u.id === pUnit)?.name || pUnit` for `purchased_unit`. The
consumable base unit is the one place that conversion was not applied.

1. Rename `selectedConsumableBaseUnitId` → `selectedConsumableBaseUnitName`
   so the type it carries is stated in its name. This mismatch survived review
   because the name asserted the opposite of the content.
2. Seed it on edit by converting the stored ID to a name, the same way
   `purchased_unit` already is.
3. Derive `baseUnitId` for consumables as
   `units.find(u => u.name === selectedConsumableBaseUnitName)?.id`.
4. Leave the RAW branch, the validation message, and
   `showConversionSection` behaviour exactly as they are.

**Also close the hole rather than only the instance.** In
`buildConversionSubmission`, reject a `baseUnitId` that does not match any
`units[].id`, returning `{ ok: false, error }` — mirroring the per-row unit
validation directly above it, which already refuses an unrecognised
`purchased_unit`. A future caller passing a name then fails visibly instead of
writing a corrupt row. One condition, not a framework.

## 4. Verification — and why the existing tests passed through this

`PurchasedItemForm.submission.test.ts` passes `baseUnitId: "U-G"` in directly.
The extraction that made the submission logic testable put the defect
**outside** the tested unit: the bug is in the component computing that value,
and the pure function never sees it. Nineteen assertions were green while
production wrote a name into an ID column. A test that cannot fail on this
class of defect does not cover it.

So the required tests are **render assertions on the component itself**, not
more cases for the pure function:

- Render, choose `Vật tư tiêu hao`, choose base unit `g`; assert the text
  beside the conversion row's rate reads **`g`**, not `cơ bản`. This must fail
  before the fix — run it against the current code and report that it does.
- Render in edit mode with `initialConversions[0].base_unit` set to a real
  unit ID; assert "Đơn vị gốc" displays that unit's **name**. Also must fail
  first.
- Add the `buildConversionSubmission` case for section 3's new guard: a
  `baseUnitId` of `"Cái"` (a name) returns `ok: false`.

`OPEN-ITEMS 46` says a function-valued `<form action>` cannot be submit-tested
under react-dom 18.3.1 + jsdom. That constrains submission, **not rendering** —
both assertions above are on rendered output and need no submit. If you find
that claim wrong, say so; do not silently fall back to testing the pure
function again.

Then the real proof, which no unit test replaces: after deploy, create one
consumable with a conversion through the UI and read `uom_conversions` — its
`base_unit` must be a unit ID matching the shape of the 57 existing rows, and
reopening the item must show the base unit filled in.

## 5. Done means

`CLAUDE.md` section 9 in full. Money is untouched, but run
`scripts/verify-revenue.ts` anyway to say so with a number rather than an
argument. Do not push; the owner approves each push separately.

# The outlet screen should edit an outlet, not just rename it

**Written 2026-08-26 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1), in particular §2's claim that changing an outlet's brand
cannot disturb a past order.

## 1. What is wrong, and whose fault it is

`app/admin/outlets/components/OutletForm.tsx` wraps the brand, address and
start-date fields in `{!isEdit && (…)}`, so editing an existing outlet offers
only the name. The button says **"Đổi tên"**.

That is exactly what
`docs/superpowers/plans/2026-08-25-outlet-screen-and-nav-guard.md` §2 asked for,
and **that plan was too narrow**. Its author fixed on one idea — *the code is
frozen, the name is not* — and never asked the next question about the other
three columns. There is no technical reason for the restriction. The owner
found it by opening the screen.

## 2. What is actually safe to edit, traced rather than assumed

`outlets.brand_id` is read in exactly two places, both at the moment of sale:

- `app/pos/actions.ts:76` — `{ ...input, brand_id: outlet.brand_id }`, stamping
  the brand onto the order being created;
- `app/pos/page.tsx:36` — choosing the session's menu and promotions.

Everything downstream reads `order.brand_id` — the value **frozen on the order**
— not the outlet's current one (`app/admin/reports/actions.ts:126`, `:368`, and
the report filter at `:60`). So changing an outlet's brand moves **future sales
only** and cannot rewrite a past order or a closed month. Same freeze principle
already proven for `created_at` and `outlet_id`.

`address` and `start_date` feed nothing but display.

**`code` stays immutable.** It is embedded in the order code of every sale ever
minted at that outlet; changing it would make thousands of existing codes
describe an outlet that no longer matches.

## 3. The change

Show brand, address and start date when editing, alongside the name. Retitle the
action **"Sửa điểm bán"** and the dialog to match.

Keep `code` displayed but not editable, with one line saying why — the same
treatment the name got for the opposite reason.

**One consequence to surface in the UI, not just in this document.** Drafts are
filtered by brand (`app/pos/actions.ts:263`, `:302`). Change an outlet's brand
while unpaid drafts exist there and those drafts stop appearing at that till —
nothing is lost, but nothing is shown either. When the brand field is changed on
an outlet that has drafts, warn before saving, naming the count. If checking for
drafts turns out to cost a query the form does not otherwise make, say so and
propose the cheaper alternative rather than adding it silently.

## 4. Verification

- **A render test that fails first:** open the form in edit mode and assert the
  brand, address and start-date fields are present. They are absent today.
- Editing an outlet's brand changes only that row; a test asserting an existing
  order's `brand_id` is untouched by the edit.
- `code` is not submittable — assert that posting a changed code does not alter
  the stored one, rather than only that the input is disabled.
- The create path keeps working unchanged, including `max(code) + 1` and the
  never-reuse rule.
- `CLAUDE.md` §9's four gates. No migration. Do not push.

## 5. Done means

`CLAUDE.md` §9 in full, plus §4.

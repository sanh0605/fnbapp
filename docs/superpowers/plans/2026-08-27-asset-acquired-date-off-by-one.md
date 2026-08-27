# Fix `acquired_date`: every asset is dated one day early

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Owner approved the fix on 2026-08-27 ("Sửa bây giờ") after
being shown the figure in §3.

**Three one-line code fixes, and a recompute of 82 production rows.**
The recompute is a production write — `fnbapp-bulk-data-change` applies.

---

## 1. The defect

`app/admin/inventory/purchase-orders/actions.ts:210`:

```ts
acquired_date: effectiveDate.slice(0, 10),
```

`effectiveDate` (line 62) is `new Date(transaction_date).toISOString()` — a
**UTC** string. `transaction_date` is Saigon midnight. So:

```
2026-03-27 00:00:00+07  ->  "2026-03-26T17:00:00.000Z"  ->  slice = "2026-03-26"
```

Line 122 writes the full timestamp to `transaction_date` and is **correct**.
Only the date-only slice on 210 is wrong. This is the `OPEN-ITEMS 55` class in
a second place, and it is recorded as `OPEN-ITEMS 64`.

## 2. Measured, not argued

**All 84 assets, 2026-08-27:**

| | |
|---|---|
| Assets with a resolvable purchase order | **82** |
| Of those, dated exactly one day early | **82** |
| Of those, dated correctly | **0** |
| Assets whose `purchase_order_line_id` does not exist | **2** (`TS-009`, `TS-010` — `OPEN-ITEMS 65`) |

**Pre-existing, not caused by the 53-order import.** The 19 assets that predate
it are wrong the same way. The import took the count from 19 to 84.

Confirmed on real rows rather than inferred: `PO-101` stores
`2026-03-27 00:00:00+07`, its assets carry `2026-03-26`.

## 3. What it actually costs, and what it does not

`lib/asset-depreciation.ts:198` reads `acquired_date` through
`parseYearMonth` — **only the month is used.** So a one-day shift is financially
inert *unless it crosses a month boundary*.

**10 assets do**, all bought on the 1st and recorded on the last day of the
previous month:

| Bought | Recorded | Items |
|---|---|---|
| 2026-06-01 | 2026-05-31 | Kẹp gắp răng cưa Inox 190mm, Vợt múc trân châu inox, Dụng cụ lọc trà |
| 2026-07-01 | 2026-06-30 | Bình bơm, Muỗng vét kem, Cốc đong 100ml, Đầu đánh bọt Uniblend DC 201, Thảm bar pha chế 600x300mm, Cân tiểu ly, Khay đựng ly ống hút |

**72.727đ of depreciation sits in the wrong month.** The other 72 assets move
by a day within the same month and change no figure at all — say so in the
report rather than letting 84 changed rows imply 84 changed schedules.

## 4. The fix

`lib/datetime.ts:70` already has `toSaigonIsoString(d: Date): string`, which
returns Saigon wall-clock. Use it:

```ts
acquired_date: toSaigonIsoString(new Date(effectiveDate)).slice(0, 10),
```

Do not hand-roll an offset and do not add a helper — `lib/report-time.ts`'s
`saigonBucketKeys` and `lib/datetime.ts`'s `getSaigonParts` both already exist,
and a third spelling of the same idea is how this bug got two homes.

**Write the test first and prove it fails on the unfixed code**
(`CLAUDE.md` §9). It must fail on the **value** — asserting `2026-03-27` and
getting `2026-03-26` — not on a missing import. State which in the report.

The case that matters is the month boundary: a purchase at Saigon midnight on
the 1st must not produce the previous month.

## 5. The backfill

Recompute `acquired_date` for every asset from its order's Saigon date:

```sql
update public.assets a
   set acquired_date = (o.transaction_date at time zone 'Asia/Ho_Chi_Minh')::date
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id = l.purchase_order_id
 where l.id = a.purchase_order_line_id
   and a.acquired_date <> (o.transaction_date at time zone 'Asia/Ho_Chi_Minh')::date;
```

**Expected: exactly 82 rows.** `TS-009` and `TS-010` cannot be repaired this
way — their line references do not resolve — so they keep their current dates
and stay recorded as `OPEN-ITEMS 65`. Do not invent a date for them.

**Triggers on the table being written** (`fnbapp-bulk-data-change` step 1,
queried 2026-08-27): `assets` carries exactly one, `trg_assets_touch`, a
`BEFORE UPDATE` `touch_updated_at`. It stamps `updated_at` and does nothing
else. `asset_disposals` carries none. Nothing cascades, nothing is queued.

Dry-run by default, `--apply` to write, print the exact count and the 10
month-movers before writing.

## 6. Verification

- Re-run §2's comparison: **82 of 82 matching, 0 early, 0 late.**
- `assets` count still **84**, `sum(total_cost)` still **14.720.817đ** — this
  moves dates only, and a moved total means something else was touched.
- Depreciation per month still **801.641đ** across all 84 assets; report the 10
  assets' before/after month explicitly.

  **Corrected 2026-08-27, Sonnet caught it.** This line said 639.518đ "in
  aggregate". 639.519đ is the **65 new** assets' monthly charge, not the
  aggregate of all 84 — the 19 that predate the import add 162.122đ. A figure
  computed for one set was carried into a sentence about a larger one.

  **Both corrections here have the same cause**, and it is the one
  `CLAUDE.md` §5 already names: the figures were computed in Python with float
  division and banker's rounding, while the system rounds each asset then sums.
  72.728 → **72.727**, 639.518 → **639.519**. Third time this class has bitten.
  Compute money with the tool that will run it — SQL or the repo's own
  `buildAssetSchedule`, never a scratch script in another language.
- `sum(total_amount)` on `purchase_orders` still **87.908.288đ**.
- `scripts/verify-revenue.ts` unmoved.
- A second `--apply` updates **0 rows** — the `where` clause makes this true by
  construction, so prove it by running it, not by pointing at the clause.

## 7. Two more sites of the same class — also in scope

**Owner approved these on 2026-08-27 after being shown what each one does.**
Same defect, same fix, same helper.

**`app/admin/reports/daily/actions.ts:37`** — `new Date().toISOString().slice(0, 10)`
as the default date. Between 00:00 and 07:00 Saigon this opens **yesterday's**
report. Worse than it first looks: the value feeds `getDigestDateOffsets(date)`
on line 38, so *today*, *yesterday* and *same weekday last week* all shift
together — the comparison still looks internally consistent while being a day
off, which is why nobody would notice it from the screen.

**`app/admin/inventory/assets/components/DisposeAssetForm.tsx:20`** — same
expression as the default disposal date. A `"use client"` component, so this is
the **browser's** clock, but `toISOString()` is UTC there too and the outcome is
identical: a disposal recorded before 07:00 is dated the previous day. Fix it to
Saigon rather than to browser-local — the shop is in Saigon and every other date
in the system already means Saigon.

**Neither needs a backfill.** The daily report computes nothing persistent, and
`asset_disposals` rows were entered by hand with a visible date the owner could
see and correct. Confirm the second claim by querying `asset_disposals` rather
than assuming it — if any row's `disposed_date` is a day before its
`created_at`'s Saigon date, say so and stop rather than backfilling unasked.

**Swept for a fourth site and found none.** Every other
`new Date().toISOString()` in `app/`, `lib/` and `components/` stores a full
timestamp, which is correct regardless of zone — the defect only appears when a
UTC string is *sliced to a date*. `app/admin/inventory/assets/actions.ts:27`'s
`currentSaigonMonth` looks like the same shape but is right: it shifts the
instant by +7h before reading UTC, and says so in a comment. `lib/historical/*`
is one-off tooling and stays out.

That makes **four** private spellings of "Saigon time" in this repository
(`toSaigonIsoString`, `saigonBucketKeys`, `getSaigonParts`, `currentSaigonMonth`)
before counting the three broken ones. Consolidating them is not this plan's
job — but note it in the report, because a fifth is how this bug gets a fourth
home.

## 8. Done means

`CLAUDE.md` §9 in full. Dry run first and show the reviewer the detail. Do not
`--apply` until the count is confirmed at 82. Do not push.

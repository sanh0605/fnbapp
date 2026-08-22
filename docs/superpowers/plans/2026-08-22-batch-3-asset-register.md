# Batch 3 — Asset register and depreciation (technical plan)

**Written 2026-08-22 by Opus 5.** Implements batch 3 of
`docs/superpowers/plans/2026-08-17-expenses-and-pnl.md` §10. That document holds
the owner's decisions; this one holds the design. Handoff to Sonnet 5 —
critique before coding (`CLAUDE.md` §1), in particular §3.2's
per-line-not-per-unit choice and §6's reconciliation.

---

## 1. Already decided — do not re-open

From the parent plan, all owner decisions, recorded 2026-08-19:

- **No minimum threshold.** *"cái nào cứ cầm nắm để sử dụng được thì đều phải
  có tính khấu hao"* (§8.1). Everything is depreciated; there is no
  expense-it-outright tier.
- **Term bands, editable in a screen, not code** (§8.1, `CLAUDE.md` §8):
  under 200k → 12 months, 200k–500k → 24, above 500k → 36. Vietnamese CCDC
  practice caps allocation at 36 months, so the defaults stay inside it.
- **The term is frozen when the item is created** (§9.1): *"anh chỉ thay đổi
  luật chứ không đồng nghĩa luật đó phải áp dụng lại cho tất cả những gì đã
  được áp dụng trước đó."* Editing a band affects only items created after the
  edit. Each item's term stays individually editable.
- **The register answers "what does the shop own"** (§8.2): an item whose term
  has ended **stays listed at 0đ**; only marking it broken or disposed removes
  it, charging the remaining value to that month.
- **Purchasing is the existing flow** (§8.3). `NHH-003 Dụng cụ` already exists,
  `PurchasedItemForm` already branches on `system_type`, the purchase-order
  screen does not filter by category, and `base_ingredient_id` is nullable.

**New decision, owner 2026-08-22:** the band is chosen by **unit price**, not
by the line total. *"Anh cũng nghiêng về giá một cái."* Eight pumps bought
together at 95.150đ each are eight small 12-month items, not one 761.200đ
36-month asset. This was genuinely open — the parent plan says "value" without
saying value of what — and it moves six purchase lines by a whole band.

## 2. Measurements, replacing the parent plan's

The parent plan's §8.1 figures are **stale**; the owner has edited the sheet
since. Measured 2026-08-22 from the current sheet, with the method itself
verified (§6):

| | Parent plan (2026-08-17) | **Now** |
|---|---|---|
| Equipment items | 71 | **72** (71 plus one `Tài liệu`) |
| Total cost | 11.163.120đ | **11.660.817đ** |
| Purchase lines | 92 | **93**, every one at 12 months today |

Under the bands, **by unit price**:

| Term | Items | Cost | Monthly charge |
|---|---:|---:|---:|
| 12 months | 57 | 5.844.845đ | **487.070đ** |
| 24 months | 9 | 3.715.972đ | **154.832đ** |
| 36 months | 1 (`Xe cà phê lưu động`) | 2.100.000đ | **58.333đ** |
| **Total** | **67** | | **700.236đ/month** |

Against **971.735đ/month** at the flat 12 months the sheet uses today. The
parent plan quoted 583.449đ against 930.260đ — superseded, both by the newer
data and by the unit-price rule.

Five items are excluded from that total because they carry no price or no
quantity — see §7.

## 3. Data model

Three new tables. Nothing existing changes shape.

### 3.1 `asset_depreciation_bands` — the editable table

```
id, min_unit_price (bigint), max_unit_price (bigint, null = no upper bound),
term_months (int), status, created_at, updated_at
```

Seeded with the three bands above. **A screen to edit them is part of this
batch, not a later one** — the rule (`CLAUDE.md` §8) is that a flexible thing
without a screen is a hardcoded thing wearing a table.

Bands must not overlap or leave gaps; validate on save and refuse with a
Vietnamese message naming the band that collides.

### 3.2 `assets` — one row per purchase line, not per physical unit

```
id, purchased_item_id, purchase_order_line_id (nullable),
name_snapshot (text), acquired_date (date),
unit_cost (bigint), quantity (int), term_months (int),
status, created_at, updated_at
```

**Why per line rather than per physical unit.** Eight pumps bought on one line
share a price, a date and a term; eight rows would be eight identical rows
differing only in an id. Partial disposal — the case that argues for per-unit
rows — is handled by `quantity` plus §3.3. If a genuine need for per-unit
identity appears later (a serial number, a warranty), it is an added table, not
a rewrite.

**`term_months` is stored, not derived** — that is §9.1's freeze. Do not
compute it from the band table at read time; read the band table once, at
creation, and write the number down.

**`unit_cost` is the allocated cost per unit**, i.e. after shipping and voucher
are spread across the order (`BR-COGS-006`). Take it from what the purchase
flow already computes; do not re-implement the allocation here.

**`name_snapshot`** so a renamed or retired catalogue item does not rewrite the
register's history — same reasoning as `recipe_snapshot_json`.

### 3.3 `asset_disposals` — history, never a delete

```
id, asset_id, quantity (int), disposed_date (date),
reason (text), created_by_id, created_by_name, created_at
```

Marking something broken **inserts a row**; it never updates `assets.quantity`
downward and never deletes. Remaining quantity is `assets.quantity` minus the
sum of disposals — derived, so the history stays readable and a mistaken
disposal is reversible by a compensating row rather than by editing the past.
`CLAUDE.md` §2 forbids deleting master data; this is the same principle one
level down.

## 4. The monthly charge — one pure function

`lib/asset-depreciation.ts`, pure and testable without a database, mirroring
how `lib/issue-costing.ts` is structured.

For one asset, in a given month:

1. Units still held that month = `quantity` minus disposals dated before it.
2. Straight-line charge = `units_held × unit_cost / term_months`, for months
   from `acquired_date`'s month through `term_months − 1` after it.
3. A disposal in that month additionally charges the **remaining undepreciated
   value** of the disposed units.

**Worked example 1 — the ordinary case, real numbers.**

> `Bình nhựa có bơm 1000ml`: 8 cái, 761.200đ allocated → **95.150đ/cái** →
> under 200k → **12 months**.
> Monthly charge: `8 × 95.150 / 12` = **63.433đ**. Twelve months at 63.433đ is
> 761.200đ — the full cost, with nothing stranded.

**Worked example 2 — disposal, matching the parent plan §8.2 exactly.**

> A `ca đong` costing 45.000đ on 12 months charges 3.750đ/month. It breaks in
> month 3. Months 1, 2 and 3 charge 3.750đ each = 11.250đ; month 3 also charges
> the remaining **33.750đ**. Total charged **45.000đ** — exactly what was paid.

**Worked example 3 — the one long-term asset.**

> `Xe cà phê lưu động`: 1 cái, 2.100.000đ → above 500k → **36 months** →
> **58.333đ/month**. Under the sheet's current flat 12 months it would be
> 175.000đ/month, writing off in a year a cart that will obviously outlive it.

Rounding: charge in whole đồng, and make the **final month absorb the
remainder** so the charges sum to the cost exactly. Assert that in a test — a
straight-line schedule that does not sum back to its own cost is the classic
defect here.

## 5. Screens

**Phone first, and phone only for this batch** (`CLAUDE.md` §8, owner
2026-08-17). Desktop is a later pass and may stay rough.

1. **Sổ tài sản** — one card per asset: name, quantity held, acquired date,
   cost, term, months elapsed, remaining value. No horizontal table. Filter by
   còn dùng / đã hết khấu hao / đã thanh lý.
2. **Đánh dấu hỏng hoặc thanh lý** — from a card: quantity, date, reason. Show
   the amount that will be charged this month **before** confirming.
3. **Bảng thời hạn khấu hao** — the §3.1 editor.

Vietnamese labels; `inputMode="numeric"` on every number field.

## 6. Verification

- **The reconciliation that can fail, on real data.** The owner's sheet totals
  per product equal the sum of its `Giá nhập thực tế` — the allocated cost —
  and that was verified 2026-08-22 to reproduce **95 of 95** products exactly.
  After the equipment purchases are entered, this system's own allocation
  (`BR-COGS-006`) must reproduce the same 72 figures. **Report the count
  compared, not just that it matched.**
- **Do not copy `Giá nhập thực tế` into the system.** Enter unit price,
  quantity, and the order's shipping and voucher; let the existing flow
  allocate. Copying an already-allocated figure allocates twice, and the check
  above would then be comparing the sheet to itself.
- Each worked example in §4 becomes a test, including example 2's disposal.
- A schedule-sums-to-cost test across every band.
- Band-table edit: an item created before the edit keeps its term (§9.1). That
  test must fail if someone derives the term at read time.
- `scripts/verify-revenue.ts` unchanged — none of this touches revenue.
- Migration checks per `fnbapp-bulk-data-change`: list triggers, prove no
  existing row is rewritten. **Do not apply; the owner approves each run.**

## 7. Cancelled orders, and the answers the owner gave

**Cancelled orders are excluded by setting `Giá nhập thực tế` to 0**, not by
removing the row. The sheet holds **13 cancelled lines** across **2 cancelled
orders**. This was missed on the first read — the status column was not looked
at — and the owner withheld the hint deliberately, to see whether the whole
sheet had been read. It had not.

**Do not enter cancelled orders into the system.** They contribute 0 to every
per-product total, so excluding them leaves §6's 95/95 reconciliation intact.

Four of the five items previously flagged as "no usable figure" explain
themselves once status is read:

| Item | Explanation |
|---|---|
| `Thảm bar pha chế 30x40cm` | its only line is `NH000024`, **cancelled** |
| `Chai nhựa xịt 900ml` | its only line is `NH000047`, **cancelled** |
| `Phin cà phê lớn` (0 cái) | a spare catalogue row; the real one holds 4 cái / 455.625đ under another code |
| `Standee` (0 cái) | a spare catalogue row; `Trụ standee` holds 2 cái / 500.000đ |

**One is still unexplained and is the owner's to answer:**
`Ống bơm hút chất lỏng 1000mm`, line `NH000045`, status **Thành công**, 34.999đ
after discount but **0đ** actual. Probably a free item carried by a voucher. If
so it enters the register at 0đ and generates no charge, while still being
listed as owned — which is exactly what §8.2's "what does the shop own" asks
for, and is the case that proves the register is not merely a cost table.

**Owner decisions, 2026-08-22:**

- `Bộ công thức pha chế Kenbar` (497.697đ) is **equipment**, not a separate
  type. At 497.697đ per unit it falls under 500k, so **24 months**. The sheet's
  `Tài liệu` type needs no counterpart in the app.
- `NH000010` (bình thuỷ tinh) needs **three** cells corrected, not one: with
  the line at 528.000đ before and after discount, `Đơn giá nhập` must be
  264.000đ (not 132.000đ) and `Chiết khấu` must be 0 (not 264.000đ). The
  allocated 411.840đ is unaffected — it is 528.000đ less a 116.160đ voucher
  share. **Attribution corrected:** this row was raised here and confirmed by
  the owner, not found by him; an earlier draft said otherwise.

## 8. Out of scope

Entering the 72 items or the 63 purchase orders — that is data entry, after
this ships; the expense subsystem (batch 4); the P&L itself (batch 5), which is
what finally consumes the monthly charge; and disposal proceeds or resale
value, since nothing here models money coming back.

## 9. Done means

`CLAUDE.md` §9 in full, plus §6. Do not apply the migration and do not push.

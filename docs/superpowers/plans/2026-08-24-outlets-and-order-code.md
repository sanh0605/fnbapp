# Outlets — the thin slice (implementation plan)

**Written 2026-08-24, rewritten 2026-08-25 by Opus 5.**

**This implements a slice of an already-approved design:**
`docs/superpowers/specs/2026-07-28-multi-outlet-design.md` (ARCH-1, "approved
by owner"). Read that first. This plan adds only what the spec does not cover
and narrows it to what the owner asked for on 2026-08-25.

**The first draft of this file was written without reading that spec** and
contradicted it in three places. Recorded so the contradictions do not leak
into implementation:

| First draft said | The approved spec says |
|---|---|
| The cashier picks an outlet at the till | Outlet and brand resolve **automatically** from the staff member's assignment; ordinary staff see no picker. Only a manager picks manually |
| Checkout must **refuse** when an outlet has two brands | It cannot arise: a brand occupies a **daily time window** at an outlet, so at any instant one brand applies. The owner said the same thing directly: *"2 thương hiệu có 2 thời gian bán khác nhau nên không thể nào có chuyện này xảy ra"* |
| `?brandId=` stays a normal URL parameter | It survives internally but is **set by the system**, never read from a user-editable query string |

The spec also already answers, so nothing here re-decides them: stock stays
shared across outlets (an explicit non-goal); `outlet_id` is written once at
sale time and **never revisited**; and the backfill sets `outlet_id` on
historical orders from their brand.

---

## 1. Scope — the owner's three objectives, 2026-08-25

> 1. Thay đổi lại hết tất cả mã đơn theo công thức mới
> 2. Thay đổi lại thương hiệu thành điểm bán khi vào POS
> 3. Thương hiệu đã được gắn trực tiếp vào mỗi điểm bán … cứ bán ở điểm nào thì tính vào thương hiệu đó

**Deliberately excluded, on his instruction** (*"hiện anh chưa cần quản lý nhân
viên do chưa tuyển nhân viên"*): `Staff_Slot_Assignment` tickets, the transfer
flow, manager-to-outlet links, and automatic time-based resolution at login.
Those stay in the spec, unbuilt.

**Consequence to build for:** because staff tickets do not exist yet, outlet
selection has to be manual for now. Shape it as the spec's *manager* path — a
picker over outlets — so that when tickets arrive they add automatic resolution
in front of it rather than replacing it.

**Not included, and the owner should confirm:** the per-outlet sales table he
asked for on 2026-08-24 is **not** among the three objectives he listed on
2026-08-25. It is cheap once `outlet_id` exists on every order, but it is not
built here without a word from him.

## 2. What the data says, measured 2026-08-25

| | |
|---|---|
| Rows in `orders_v2` | **2.355** |
| Distinct `order_no` | **2.339** — 15 codes are shared by more than one row |
| Places the code is stored | **exactly one**: `orders_v2.order_no` |
| Copies in `pos_snapshot_json`, `order_events.delta_json`, line snapshots, `data_recovery_changes` | **0, 0, 0, 0** |
| Occurrences in the owner's Google Sheet | **0** |
| Code chains spanning two calendar days | **0** |
| Code chains spanning two brands | **0** |

**An edited order keeps its code across versions.** `PHD000632` is three rows:
version 1 `SUPERSEDED`, version 2 `COMPLETED`, version 2 `VOIDED`. The rename
must therefore operate **per code**, never per row.

**The zero-spanning-days result is a fact about today, not a guarantee.** Edit
an order the morning after and its versions straddle two dates. So the new code
must be derived from the **earliest row of the chain**, which is correct in both
worlds — not because the case bites now, but because it silently will.

## 3. Data model

### 3.1 `outlets`

```
id, code (text '001', unique, immutable), name (unique),
brand_id (references brands), address,
status, start_date, end_date, created_at, updated_at
```

- **`code` is assigned from `max(code) + 1` and never from a freed gap.** Owner,
  verbatim: *"Điểm bán 4: 004 (không thay thế vào lại điểm bán đã ngừng hoạt
  động)."* Retiring sets `status`/`end_date`; it never deletes and never
  releases the number.
- `name` unique, per the spec's duplicate-prevention rule.
- **`brand_id` here is the thin-slice stand-in for the spec's
  `Outlet_Brand_Slot`.** One brand per outlet, all day. When time windows are
  needed, a `outlet_brand_slots` table supersedes this column; nothing else in
  this plan depends on the column's shape.
- Seed `001` and `002`, linked to `BR-001` (Phin Đi) and `BR-002` (Uchako).
  Names: use the owner's if given, otherwise `Điểm bán 1` / `Điểm bán 2` — the
  name is editable, only the code is frozen, so a placeholder costs nothing.

### 3.2 `orders_v2` gains two columns

- **`outlet_id`** — the spec's column, set once at sale and never revisited.
- **`legacy_order_no`** — the pre-rename code, copied before `order_no` is
  overwritten. Cheap, and the only way to answer *"which order was
  `PHD001619`?"* once the rename has run. Nothing else preserves it: the code
  lives in exactly one column and the owner's own book never recorded it.

## 4. Objective 1 — rename all 2.355 orders

New format, owner's specification as revised 2026-08-24:

```
NĂM(2) + THÁNG(2) + NGÀY(2) + ĐIỂM BÁN(3) + THỨ TỰ(3)

260824001001   2026-08-24, outlet 001, first order that day
260824001002   same day and outlet, second
260824002001   outlet 002, same day, its own first
260825001001   next day, counter back to 001
```

Date-first is what makes the all-digit code safe: it begins with the two-digit
year, so there is no leading zero for a numeric round trip to eat, and it sorts
chronologically as plain text. **The outlet segment in the middle still carries
leading zeros**, so `order_no` stays text everywhere and string slicing is never
replaced by arithmetic.

### The derivation, exactly

1. Group `orders_v2` **by `order_no`** — one group is one order, however many
   versions it has.
2. The group's date and outlet come from its **earliest** row by `created_at`
   (§2's reason).
3. Date is `created_at` in **`Asia/Ho_Chi_Minh`**, formatted `YYMMDD`. The
   timezone is not optional; `OPEN-ITEMS 55` is a live bug of this exact kind.
4. Sequence = `row_number()` over groups sharing an outlet and date, ordered by
   the group's earliest `created_at`, then by `order_no` to break ties
   deterministically. A rerun must produce identical output.
5. **Every row in the group** receives the same new `order_no`.

### Running it

`fnbapp-bulk-data-change` in full. Specifically: `orders_v2` carries one
trigger, `trg_orders_v2_touch` (`BEFORE UPDATE`, `touch_updated_at()`), which
feeds no queue and starts no automation — but it **will** move `updated_at` on
every renamed row. Declare that in the report; do not disable the trigger.

Dry run by default, `--apply` to write, print the exact counts and the first
several before/after pairs, and re-read afterwards.

### Verification

- **Revenue unmoved.** `scripts/verify-revenue.ts` before and after: April
  2.190.000đ, May 7.675.000đ, June 22.157.000đ, July 18.661.000đ.
- **2.355 rows renamed, 2.339 distinct new codes** — report both numbers, not
  just "done". A count that does not match is the whole point of counting.
- **Every one of the 15 multi-row chains still shares exactly one code.**
  Assert per chain, not in aggregate.
- **New codes are unique** across completed non-superseded orders, and the
  existing partial unique index — today `(brand_id, order_no)` — is reconsidered:
  the new format is unique on its own, so the index should express that while
  keeping the same partial condition so a superseded version still coexists.
- **`legacy_order_no` is populated for all 2.355 rows** and matches what
  `order_no` held before.
- **Idempotent:** running the script twice produces no second change.

## 5. Objective 2 — the till opens by outlet

Today `app/admin/layout.tsx:184` opens a modal of brands and navigates to
`/pos?brandId=BR-001`. The brand is chosen **once per session**, not per order.

Change the modal to list **outlets**, and carry the outlet instead. Per the
spec, the brand must not be user-suppliable: resolve it **server-side from the
outlet**, and ignore any brand in the query string rather than trusting it.

No extra tap for staff — one choice at open, exactly as today.

## 6. Objective 3 — the brand follows the outlet

`orders_v2.brand_id` keeps being written on every order, derived from the
outlet's `brand_id`. The owner is explicit: *"cứ bán ở điểm nào thì tính vào
thương hiệu đó."*

Everything that reports by brand keeps working untouched, which is what the
owner's standing instruction about preserving revenue requires.

## 7. Verification beyond §4

- A rendered test that the till modal lists outlets and that opening one carries
  the outlet through to a created order's `outlet_id` and `brand_id`.
- A test proving a brand supplied in the URL is **ignored** in favour of the
  outlet's own brand.
- New-order minting is **not** in this plan's §4 rename — but if Stage B's
  minting lands in the same batch, prove the counter with the owner's own
  example and prove two simultaneous orders at one outlet cannot collide,
  against the real advisory lock rather than by argument.
- `npm run build`, and the three other gates in `CLAUDE.md` §9.

## 8. Done means

`CLAUDE.md` §9 in full. Do not apply migrations, do not run the rename against
production, do not push — each is the owner's separate approval.

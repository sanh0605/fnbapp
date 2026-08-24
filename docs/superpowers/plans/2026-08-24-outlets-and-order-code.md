# Outlets, a new order-code format, and a per-outlet sales breakdown

**Written 2026-08-24 by Opus 5.** Owner asked for this ahead of Plan J batches
4–6. Handoff to Sonnet 5 — critique before coding (`CLAUDE.md` §1), in
particular §5's split into two stages and §4.3's refusal-rather-than-guess rule.

This pulls part of the parked `ORG-MULTI-OUTLET` roadmap item forward
(`docs/FEATURE-CATALOG.md`, `BR-U-002`). It does **not** deliver outlet-scoped
permissions or data isolation; those stay parked.

---

## 1. What the owner specified

**Order code:** `NĂM (2) + THÁNG (2) + NGÀY (2) + ĐIỂM BÁN (3) + THỨ TỰ (3)`,
twelve digits, no separators.

```
260824001001   2026-08-24, outlet 001, first order that day
260824001002   same day and outlet, second order
260824002001   outlet 002, same day, its own first order
260825001001   next day, the counter is back to 001
```

**Revised by the owner 2026-08-24, after §4.1 was raised** — his first
specification put the outlet first (`001260824001`). Moving the date to the
front is the better fix and the reason is worth keeping: it **removes** the
leading-zero hazard rather than defending against it. See §4.1.

**Outlet codes are never reused.** *"Điểm bán 2 (ngừng hoạt động) … Điểm bán 3
→ số này sẽ không đổi thành 002 và vẫn giữ nguyên 003. Điểm bán 4: 004 (không
thay thế vào lại điểm bán đã ngừng hoạt động)."* A retired code retires with the
outlet.

**Nothing is shown to the cashier on success:** *"Khi nhân viên bấm tạo đơn
thành công sẽ không thông báo mã đơn mà chỉ thông báo thành công."*

**Two outlets today, one brand each, and that is a staffing constraint rather
than a rule:** *"nếu đủ thì có thể 1 điểm sẽ bán cả 2 thương hiệu."* Existing
orders map exactly — `PHD` → outlet **001**, `UCK` → outlet **002**.

**Deferred by the owner, not by this plan:** tagging products to brands so each
outlet's till shows a shorter menu. The brand↔outlet link with active periods
belongs to that work, not this one.

## 2. Measurements this design rests on

| | |
|---|---|
| Orders today | **2.355** — 1.616 `PHD`, 739 `UCK` |
| Busiest single day, either brand | **38** orders (Uchako); Phin Đi peaks at 31 |
| Days ever above 40 orders | **0** |
| Trading hours | 06:00–23:00; **4** orders in total fall after midnight across the whole history, and they look like test rows |

So three digits for the daily counter allows 999 — twenty-six times the busiest
day ever recorded — and no sale straddles midnight, so a calendar date and a
trading day are the same thing here. Both were checked rather than assumed.

## 3. What already works and must not be rebuilt

`orders_v2.id` is `ord-<uuid>` and is what every foreign key points at.
`order_no` is a **display code only**, so changing its format breaks no
relationship.

The minting function already serialises correctly
(`supabase/migrations/0047_pos_atomic_exact_cost.sql:153`):

```sql
perform pg_advisory_xact_lock(hashtext('pos:order_no:' || v_brand_code));
select coalesce(max(...), 0) + 1 into v_next_number ...
```

An advisory lock per code prefix, then `max + 1`. The new scheme needs the same
shape with the lock key becoming outlet + date. **Do not replace this with a
sequence** — a sequence cannot reset per day per outlet without a second
mechanism, and this one is already proven under real concurrency.

`orders_v2` carries exactly one trigger, `trg_orders_v2_touch`
(`BEFORE UPDATE`, `touch_updated_at()`). Nothing feeds a queue, so §5.1's
backfill raises no downstream automation — but it **will** move `updated_at` on
2.355 rows, which is expected, must be stated in the report, and must not be
worked around by disabling the trigger.

## 4. Three traps, named

### 4.1 All-digit codes and leading zeros — designed out, not guarded against

The original outlet-first form `001260824001` would survive a round trip
through a number as `1260824001`: leading zeros gone, code pointing at nothing.
Today's `PHD001619` cannot suffer this, because of its letters.

**The owner's reordering removes the hazard.** A date-first code begins with the
two-digit year, which is not `00` until 2100, so there is no leading zero for
any conversion to eat. The full value (`260824001001` ≈ 2,6 × 10¹¹) also sits far
inside a JavaScript safe integer, so even a stray numeric round trip returns the
same digits.

**Keep the text discipline anyway.** "The year never starts with zero" is a fact
about this century, not an invariant of the code — and the outlet segment in the
middle *does* carry leading zeros, so string slicing must never be replaced by
arithmetic. Treat `order_no` as text everywhere, and audit the existing 243
`order_no` references for numeric coercion rather than assuming there is none.

### 4.2 Two formats will coexist for ever

2.355 orders keep `PHD…`/`UCK…`; everything after the switch is twelve digits.
Nothing may assume a single shape. `app/admin/orders/actions.ts:212` already
special-cases a third, older `#123` form, which is the precedent: it tests the
prefix before rewriting, and it is safe as written because a twelve-digit code
never starts with `#`. Verify that reading rather than trusting this sentence.

### 4.3 An outlet with two brands has no single brand to record

`orders_v2.brand_id` is written on every order today and feeds existing reports.
With the outlet as the thing the cashier picks, brand must come from the
outlet — which works only while each outlet has exactly one active brand, the
situation the owner explicitly expects to end.

**So derive it, and refuse rather than guess.** If an outlet has more than one
active brand, the checkout must fail with a Vietnamese message saying the brand
work is needed — not pick the first, not write null. A loud failure is what
makes the deferred work happen before it can corrupt a month of reports.

## 5. Two stages, deliberately

Stage A touches no money path and can ship alone. Stage B changes the checkout
function.

### 5.1 Stage A — outlets exist, history is labelled, the report splits

1. **`outlets`**: `id`, `code` (3-char text, `'001'`, unique, immutable),
   `name`, `status`, `start_date`, `end_date`, timestamps. Codes are assigned
   from `max(code) + 1` and **never** from the first free gap.
2. **Screen** to add, rename and retire an outlet — retiring sets `end_date`
   and `status`, never deletes, and never frees the code. The name stays
   editable precisely because the code is what is frozen.
3. **Seed** `001` and `002`. Use the owner's names if he has given them by then;
   otherwise `Điểm bán 1` and `Điểm bán 2`, which he can rename on the screen at
   no cost.
4. **`orders_v2.outlet_id`**, nullable, backfilled: `brand_id = 'BR-001'` →
   `001`, `'BR-002'` → `002`. Follow `fnbapp-bulk-data-change` in full: dry run
   by default, `--apply` to write, print the exact counts first, and report the
   `updated_at` movement as a side effect rather than omitting it.
5. **Sales report** gains a per-outlet table. Because of step 4 it covers the
   full history from 2026-04-20, not only from the switchover.

**Stage A's verification is a reconciliation that can fail:** every completed
order must end up with exactly one outlet, and the per-outlet revenue totals
must sum to the figures `scripts/verify-revenue.ts` already gates —
April 2.190.000đ, May 7.675.000đ, June 22.157.000đ, July 18.661.000đ. Report
the count of orders compared, not only that the totals matched.

### 5.2 Stage B — the new code, and the till

1. **Checkout RPC**: lock on `'pos:order_no:' || outlet_code || yymmdd`, then
   `max(right(order_no, 3)::int) + 1` over that outlet and date, then
   `to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || outlet_code ||
   lpad(seq, 3, '0')`. The timezone is not optional — `OPEN-ITEMS 55` is an
   existing bug of exactly this kind. Note the free consequence of the
   date-first order: codes now sort chronologically as plain text, which the
   outlet-first form did not.
2. **Uniqueness**: today's index is `(brand_id, order_no)` where completed and
   not superseded. Under the new format `order_no` is unique on its own by
   construction. Change the index to match the new guarantee; keep it partial on
   the same condition so an edited order's superseded version still coexists.
3. **The till picks an outlet** where it picks a brand today — no extra tap.
   Brand is derived per §4.3.
4. **On success, show only "Thành công"**, no code. The code stays visible
   wherever an order is looked up afterwards.
5. **A test that fails first**, using the owner's own example rewritten into
   the final order: two orders at outlet 001 on 2026-08-24 must mint
   `260824001001` and `260824001002`, an order at outlet 002 the same day must
   mint `260824002001`, and the first order the next day must return to
   `260825001001`.
6. **Concurrency**: two orders minted simultaneously at the same outlet and day
   must not collide. Prove it against the real advisory lock, not by reasoning
   about it.

## 6. Out of scope

Outlet-scoped permissions and data isolation (`BR-U-002`, still parked);
tagging products to brands and the shorter per-outlet menu (owner deferred it);
renaming any existing order code — the 2.355 old codes stay exactly as they
are, and nothing in this plan rewrites one.

## 7. Done means

`CLAUDE.md` §9 in full, plus §5.1's and §5.2's own checks. Stage A and Stage B
are separate commits so either can be reverted alone. Do not apply migrations,
do not push.

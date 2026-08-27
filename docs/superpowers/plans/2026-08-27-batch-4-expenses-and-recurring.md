# Batch 4 — Expense entry, recurring items, and two engine fixes

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

Batch 4 of `docs/superpowers/plans/2026-08-17-expenses-and-pnl.md` §10, whose
six-batch order the owner approved 2026-08-19. Batches 1–3 are done.

**This batch writes no historical data.** The owner enters his own rows —
*"Tự nhập"*, 2026-08-27. One migration backfill is proposed in §4 and is the
only production write; it needs its own approval.

---

## 1. What the owner decided, and when

| Decision | When |
|---|---|
| Expense categories and recurring items are **tables with screens**, never constants | 2026-08-19 |
| **All recurring items behave identically** — the system only reminds; he types the amount every time | **2026-08-27, reversing §9.3** |
| A blank date means **the moment of entry** | 2026-08-27 |
| Ice, calamansi, lime, sweet potato, potato bags are **cost of goods**, not operating expense | 2026-08-27 |
| Those are entered through **purchase orders**, not the expense screen | 2026-08-27 |
| He enters the 24 operating-expense rows himself | 2026-08-27 |

**§9.3 of Plan J is superseded.** It specified per-template default amounts
(wifi 200.000, rent 5.000.000 pre-filled; gas and electricity blank). The owner
removed the distinction: **no template carries an amount.** The table holds a
name and nothing else about money.

**§9.3's examples are also wrong about this business** and must not be used as
seed data. Measured from his own cash book 2026-08-27: **there is no rent and
no wifi.** He sells from carts. His only fixed cost is *Gửi xe*, 150.000đ a
month, and it is the only thing in 39 rows marked `Định phí`. The real
recurring set is **gas, điện, nước, gửi xe**.

## 2. Measured before designing, not assumed

His cash book holds **110 rows**. Of the 106 marked `Chi`:

| | Rows | Money |
|---|---:|---:|
| Already in the system as purchase orders (carry a `Mã phiếu đối chiếu`) | **67** | — |
| Cost of goods, to be entered as purchase orders by the owner | **15** | 3.366.000đ |
| Operating expenses, needing this batch's screen | **24** | 3.665.000đ |

**Re-entering the 67 would double-count.** Plan J §2 says purchases are not
re-entered; this is the concrete list that rule protects.

Already in the system and waiting for the P&L line that reads it: **4.781.800đ**
of `is_non_inventory` purchases across 38 lines — 1.896.000đ of it sweet potato,
bought correctly through purchase orders since June, **with zero issue slips and
none needed**.

## 3. Fix one — stop writing stock for goods that are never counted

**The defect, measured 2026-08-27:** `NNL-012` (Khoai lang) carries an
`inventory_balances` row of **79.700 g** — near 80 kilos that do not exist. It
is 21 purchases accumulated with nothing ever removed, because the item is
`is_non_inventory`: never counted, never issued, so the balance only grows.

`buildPurchaseOrderWritePlan` writes one `stock_ledger` row per line
unconditionally. **Skip it when the item is `is_non_inventory`** — either its
own flag or its linked ingredient's, the same additive test
`app/admin/inventory/stocktake/actions.ts` already uses for stocktake
eligibility. Reuse that test; do not write a second one.

**Forward-only.** The 38 existing lines keep their ledger rows and the phantom
balances stay until a separate cleanup — the owner's explicit sequencing
2026-08-27: *"anh sẽ nhập luôn, rồi làm sạch lại tồn kho ảo sau."* He is
entering ice and calamansi before this ships, so **those will add phantom
balances too**, knowingly. Say so in the report with the count, rather than
letting him discover it.

**Money does not move either way.** COGS is measured from `stock_issues`
(`BR-COGS-005`); `inventory_balances` feeds no cost figure. Prove that rather
than asserting it: `scripts/verify-revenue.ts` and the COGS check must be
byte-identical before and after.

## 4. Fix two — stamp the treatment on the line, so history stops moving

`is_non_inventory` is a bare boolean with no effective date (`OPEN-ITEMS 50`).
Once `BR-COGS-007`'s second line reads purchases of flagged items, un-ticking an
item in November silently reclassifies every purchase of it back to June, and
closed months move.

**Stamp each `purchase_order_lines` row at write time** with how the item was
classified then. This is **not a question to the owner** — the screen must never
ask. It records the answer the item already gives.

The owner set this exact principle himself for depreciation on 2026-08-19:
*"nếu anh đổi thời gian khấu hao thì các sản phẩm đã set khấu hao trước đó vẫn
giữ nguyên."* Same rule, second place.

**Backfill: 297 existing lines, stamped from each item's current flag.** This is
a production write and needs its own approval — dry run, exact count, and the
`is_non_inventory` line total re-measured at **4.781.800đ** before and after.
It cannot recover what an item was flagged as in June, only what it is today;
say that plainly rather than implying the history is recovered.

## 5. The expense screen

**Table:** date, amount, category, fixed/variable, note. Categories and the
fixed/variable list are their own tables with their own screens (§9.2), each
with the duplicate-name guard batch 1 shipped — normalise, then refuse a
duplicate **among live rows only**, scoped **per table**.

**Seed categories from his own book, not from Plan J's examples:** `Vận hành`,
`Điện, nước, gas`, `Marketing`. Nothing else appears in 39 rows. He adds more
himself.

**A blank date means the moment of saving** — the same rule already settled for
`start_date`. The field stays optional; the server assigns the timestamp at
write time.

**Both devices, per `CLAUDE.md` §7 as amended 2026-08-26.** Phone: one card per
row, `inputMode="numeric"` on the amount. Desktop: a real table, sortable by
date and amount. Two layouts written separately — not one that stretches.

**The screen needs a nav entry** (`CLAUDE.md` §7). `nav-guard.test.ts` fails if
it is missing, which is the point.

## 6. Recurring items

**Table: a name, and whether it is active. No amount, no default.**

Each month the system shows what has not been entered. Opening one gives an
empty amount box and an empty date box. He types the amount, optionally picks a
date, saves.

**Cadence is monthly and only monthly.** Every row in his book is monthly and
nothing suggests otherwise — but Plan J §11.3 notes this was assumed and never
stated, so it is stated here: **anything else is not built**, and adding it
later means revisiting "same day-of-month as last period".

**Two ways to leave the date alone, and they mean different things:**

| | Records |
|---|---|
| Leave the date blank | The moment of saving |
| Press **Không nhớ** | The same day-of-month as last period, **flagged as inferred**, with who and when |

The owner said *"các logic khác giữ nguyên"* on 2026-08-27, so `Không nhớ`
survives his change to the amounts. **It is kept because it answers a question
free text cannot** — his own reason: *"tháng nào bạn A quên nhiều nhất"* must be
answerable by query. If he decides one of the two is redundant, removing
`Không nhớ` is a small deletion; removing the blank-date rule is not, because it
is a system-wide convention.

**No backfill queue.** He enters April–August himself from his sheet, with real
dates. The reminder starts from the month this ships.

## 7. Correcting an expense — the one open decision

**Not decided, and it is `Plan J` §11.3's first gap.** Issue slips have
`BR-INV-009`: never edit, never delete, add a compensating row dated **today**.

**That rule's reasoning does not transfer.** It exists because
`lib/issue-costing.ts` replays issues chronologically, so a row inserted into
the past revalues the running average of everything after it. **An expense
feeds no replay** — it is an amount on a date. Editing it changes that row and
nothing else.

So the choice is genuinely open, and it is the owner's:

- **Edit in place, with an edit history** *(recommended)*. A typo in July's
  electricity is fixed in July. The cost: a month he has already looked at can
  change.
- **Reverse and re-enter**, matching `BR-INV-009`. Consistent with the one
  correction path that exists, but it pushes July's correction into today's
  month for no protection in return.

**Do not build either until he answers.**

## 8. Verification

- `CLAUDE.md` §9 in full, including `npm run build`.
- **Fix one:** buy an `is_non_inventory` item in a test and assert **zero**
  `stock_ledger` rows for it, and that a normal item still writes one. Prove the
  test fails on the unfixed code, on the **value**.
- **Fix two:** the 297-line backfill dry run reports its count; the
  `is_non_inventory` purchase total is **4.781.800đ** before and after.
- `scripts/verify-revenue.ts` unmoved. COGS unmoved.
- Nav test passes with the new screen, and would fail without it — prove it by
  removing the entry once.
- The duplicate-name guard refuses a second live `Vận hành` and **allows** one
  whose twin is retired.

## 9. Done means

`CLAUDE.md` §9. Do not push. **And name what a green suite cannot show:** the
owner must open the expense screen on a phone and on a desktop after deploy,
logged in — the 2026-08-09 stocktake failure passed all four gates and broke on
every load.

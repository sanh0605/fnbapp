# Plan D — Make counting and issuing work under the new costing

**Written 2026-08-07 by Opus 5, after the Plan C cutover went live.**
Owner review: the cutover replaced how cost is measured, but left the two
screens that feed it half-built. The owner found this himself, in the plainest
possible terms: *"Anh chưa thấy chỗ để tạo phiếu xuất và vẫn chưa thấy chỗ kiểm
kê được làm đúng, hiện vẫn đang dùng code cũ."* He was right on both, and the
audit found three more.

---

## 1. Why this plan exists

Plan C moved cost measurement from "guess at sale time via the recipe" to
"measure when goods leave stock". Goods now leave stock by exactly two routes:
**a stocktake** and **a manual issue slip**. The first is half-converted. The
second does not exist.

Until this plan lands, `stock_issues` stays empty and every cost figure reads
0đ — recorded in `CLAUDE.md` section 7 point 4 as a true state, not a fault.

---

## 2. The five gaps, each measured

### Gap 1 — the count list offers every item twice

`app/admin/inventory/stocktake/actions.ts:114-121` builds the session from
**both** base ingredients **and** purchased items. Measured 2026-08-07: **39
ingredient lines + 50 purchased-item lines = 89 lines**, where the shop has
about 50 real things to count.

Condensed milk alone appears four times: `Sữa đặc` (generic) plus `Sữa đặc
Vinamilk`, `Sữa đặc Ngôi Sao Phương Nam`, `Sữa đặc La rosee`. Coffee powder the
same.

The two kinds are not cosmetic duplicates — **they feed different systems**
(`0053_stocktake_purchased_items.sql:289-320`):

| Line type | Writes | Produces cost? | Corrects stock quantity? |
|---|---|---|---|
| `PURCHASED_ITEM` | `stock_issues` only | **yes** | **no** |
| `BASE_INGREDIENT` | `stock_ledger` only | no | yes |

Nothing on screen tells them apart. The owner is being asked to pick, without
being told he is picking.

### Gap 2 — there is no issue slip screen at all

Searched the whole of `app/`: no route, no directory, no action. `stock_issues`
allows `source in ('STOCKTAKE','MANUAL')` (`0052_stock_issues.sql`) and **no
TypeScript anywhere writes it** — the only writer is the stocktake RPC.

Practical consequence: a can of milk thrown away, or stock used for something
other than a sale, **cannot be recorded**. Between counts, that loss is
invisible, and at the next count it silently becomes part of the counted
variance with no explanation attached.

### Gap 3 — counting by brand fixes cost but never fixes the stock number

The blocking one. Quantity and cost live at different levels:

- **Quantity**: ingredient level. All **138** surviving `PO_RECEIPT` rows and all
  **39 of the 50** `inventory_balances` rows are keyed on base ingredients
  (measured). The other 11 are semi-products, all at 0 since Task 5; **no**
  balance row is keyed on a purchased item.
- **Cost**: purchased-item level. `stock_issues.purchased_item_id`.

And the purchased-item branch of `apply_stocktake_session_atomic` writes
`stock_issues` **only, never `stock_ledger`** — stated in its own comment at line
152 and confirmed in the body at 289-320.

So under the owner's chosen scheme, counting `Sữa đặc Vinamilk` produces a
correct cost and leaves `Sữa đặc`'s quantity at its inflated post-cutover value
**for ever**. `Sữa tươi` would sit at 134.000 g no matter how carefully he
counts.

### Gap 4 — one duplicated ingredient

Two `base_ingredients` share the name `Sữa yến mạch`:

- `ING-033` — real, carries the purchased item `Sữa yến mạch Oatside` (SPM-038)
- `NNL-004` — orphan: 0 purchased items, 0 ledger rows, 0 stock

**The owner caught this.** The audit had reported "one ingredient with no
purchased item" as a curiosity; he replied *"Sữa yến mạch đã có rồi mà nhỉ?"* and
he was right — the ingredient exists and is bought, under a different id.
Checked across the whole table: this is the **only** duplicated name, and the
`NNL-`/`ING-` prefixes are not an abandoned migration (8 `NNL-` ingredients carry
brands, 7 carry ledger rows). One orphan, not a pattern.

### Gap 5 — the screen asks for base units, which invites arithmetic errors

`StocktakeClient.tsx` renders every quantity in the ingredient's base unit
(g, ml). The owner's instruction: *"Anh thì muốn xuất theo đơn vị mua vào cho
chính xác."*

The data agrees with him, decisively:

| Purchased item | Bought as | Stored as |
|---|---|---|
| Sữa đặc Vinamilk | 1 **Hộp** | 1.284 g |
| Sữa đặc Ngôi Sao Phương Nam | 1 **Hộp** | 380 g |
| Sữa đặc La rosee | 1 **Lon** | 1.000 g |

Two items both called "Hộp", one 3,4× the other. Asking for grams makes the
owner hold those numbers in his head and multiply while counting. That error
lands directly in cost.

All 57 conversions exist and are `ACTIVE` — nothing to declare first.

---

## 3. Owner decisions carried by this plan

1. **Count by purchased item, not by generic ingredient** (2026-08-07). *"Trên kệ
   có 3 hộp Vinamilk và 2 hộp La rosee thì anh ghi riêng."*
2. **Enter in purchase units, store exact base units** (2026-08-07), restating
   the 2026-07-30 rule that rounding belongs to the screen and storage keeps
   exact values.
3. **Never delete master data** — `NNL-004` is marked inactive, not removed.
4. **Count sealed packages only** (2026-08-07). An opened package is not counted
   and not estimated. The owner's own example: *"túi dâu 100g đã dùng hết, túi
   dâu 500g đang dùng, túi dâu 1000g chưa dùng thì anh sẽ chỉ nhập … Túi 1.000 g
   [1]."*

   **What this rule actually is: cost is recognised when a package is opened,
   not as it is consumed.** Say that plainly rather than treating it as a data-
   entry convenience, because it decides what the numbers mean:

   - The stock figure means **sealed stock**. It understates what is physically
     on the shelf by whatever sits in the open packages.
   - Cost runs slightly ahead of true consumption, by at most one open package
     per item.
   - **The error is bounded and does not accumulate.** Each package is expensed
     exactly once, at the first count where it is no longer sealed. Nothing is
     counted twice and nothing is missed.

   It also removes the need to weigh or estimate anything, which is what makes
   it defensible: a rule the owner can actually follow beats a more precise one
   he cannot. Supersedes the decimal-entry idea drafted in C4 below.

   **Checked for goods with no package to seal.** Only two purchased items are
   bought loose (`conversion_rate = 1`): `Khoai lang`, already excluded because
   `NNL-012.is_non_inventory = true`; and `Trứng gà`, whose base unit is `trái`,
   so every unit is whole and countable and the rule applies unchanged. No
   exception is needed.

5. **An issue slip records the time of day, not just the date** (2026-08-08).
   Settles K5/I6, and the owner's own worked example is what forced it.

   He posed a sequence where a purchase and an issue land on **the same day**
   (08/01: issue 2.500 g, then receive 5.000 g). Replayed both ways:

   | Same-day order | Cost recognised | Value left in stock |
   |---|---|---|
   | Issue first (as he wrote it) | **112đ** | **28đ** |
   | Purchase first | **100,33đ** | **39,67đ** |

   Both **conserve** — each sums to the 140đ actually paid. But they split it
   differently, by about 12% on his figures, so the same day's transactions
   produce a different profit depending on an order the data never recorded. The
   tie was flagged in K5 as a risk; his example proved it moves real money.

   **The other side already carries a time.** Measured 2026-08-08:
   `purchase_orders.transaction_date` is `timestamptz` and **0 of 63** completed
   purchases sit at midnight — real times, entered as they happened. So adding a
   time to the issue slip completes the ordering rather than half-solving it.

   The default is now, editable when writing a slip after the fact. The explicit
   tiebreak from K5 stays for genuine equality — it is the last resort, no longer
   the mechanism.

---

## 4. The unit problem, and the shape that solves all of it

The owner asked the sharpest question of the session: *"Đối với sản phẩm có 2
đơn vị khác nhau khi nhập thì sẽ xuất thế nào?"*

It is not hypothetical. Measured: **48 purchased items have one purchase unit, 3
have two, 1 has three.** Two distinct shapes:

**Shape A — different unit names.** Safe, self-describing.
- `Bột cà phê MR.PHIN Robusta Dak Mil`: **Túi** 500 g, **Combo 2** 1.000 g
- `Đá viên`: **Túi** 5.000 g, **Bao** 20.000 g

**Shape B — same unit name, different size.** The dangerous one.
- `Dâu sấy`: **three** conversions all named **Túi** — 100 g, 500 g, 1.000 g, all
  three used in real purchases
- `Kem whipping Anchor`: **two** named **Hộp** — 250 ml and 1.000 ml, both used

Asking "how many Túi of Dâu sấy?" has three answers that differ by **ten times**.

**Purchases are not affected** — `purchase_order_lines.conversion_id` records
exactly which conversion each line used, so history is unambiguous. The hole is
only on the issue side, which is the side that does not exist yet.

### The solution: count by package, not by unit name

One line per **conversion**, labelled with the size derived from
`conversion_rate` — no master-data rename required:

```
Dâu sấy — Túi 100 g              [   ]
Dâu sấy — Túi 500 g              [   ]
Dâu sấy — Túi 1.000 g            [   ]
Kem whipping Anchor — Hộp 250 ml [   ]
Kem whipping Anchor — Hộp 1 l    [   ]
```

The count list becomes **57 lines** (one per active conversion) rather than 52
items or today's 89 — five lines longer than the item count, and **no line with
two meanings**.

---

## 5. Every case this must handle

The owner asked for completeness: *"bao gồm cả tất cả trường hợp có thể xảy ra."*
Each row is a test to write, not just a note.

### Counting

| # | Case | Required behaviour |
|---|---|---|
| C1 | Item with one conversion (48 items) | One line, as today |
| C2 | Two conversions, different unit names | Two lines, distinguished by name |
| C3 | Two or three conversions, **same** unit name (`Dâu sấy`, `Kem whipping Anchor`) | One line each, distinguished by the size label |
| C4 | Opened package, partly used | **Not counted, not estimated** (owner rule, §3.4). Whole packages only — reject decimals rather than silently rounding them |
| C5 | Nothing left in a size | Entering **0** and leaving the line blank mean the same thing, by owner rule. See C6 for how that is made safe |
| C6 | Line left blank | Blank = 0, **but only inside an item the owner marked as counted.** See below — this is the one place where the owner's rule and safety pull apart |
| C7 | Conversion exists but was never purchased (`Đá viên`) | Line still shown; theoretical is 0; counting a positive number triggers C9 |
| C8 | Conversion set `status <> 'ACTIVE'` | Excluded from new sessions; existing sessions keep their line so an open count is not silently altered |
| C9 | Counted more than ever purchased | Refuse, name the sibling brands (`BR-INV-005`, already built) |
| C10 | Counted more than theoretical but ≤ purchased | **No rule exists** (`docs/OPEN-ITEMS.md` item 32). Decide it in this plan — see §7 |
| C11 | Semi-products | Never offered (`BR-INV-006`) |
| C12 | `is_non_inventory` ingredients | Never offered, as today |
| C13 | Ingredient with no purchased item (`NNL-004`) | Cannot be counted; resolved by marking it inactive, not by a special case |
| C14 | A purchased item added while a session is open | Not added to the open session; appears in the next one |
| C15 | Two sessions open at once | Already guarded by `open_stocktake_session_atomic`; keep the guard and test it |
| C16 | Session opened, then abandoned | Must not alter any balance; re-opening starts clean |
| C17 | **Purchased item** (not conversion) set `status <> 'ACTIVE'` while stock is still physically on the shelf | **Settled 2026-08-07, before D3, by Sonnet's review.** Keep offering it while its computed on-hand is above zero, and stop only once a count brings it to zero — same shape as C8, applied one level up. Verified again independently: all 52 purchased items and all 57 conversions are `ACTIVE` today, so nothing is wrong right now — this is a landmine, not a bug, and the column can change at any time. Implemented in D4's session-building query, not D3's pure function (which only knows about conversions already handed to it) |

#### C6 in full — the one place where "blank means zero" can cost real money

The owner will routinely leave lines blank: under §3.4 he only types a number
where a sealed package exists, and for `Dâu sấy` that is one line out of three.
So blank has to mean zero, or nothing would ever be corrected.

But blank must **not** mean zero for an item he never reached. If `Dâu sấy` is
forgotten entirely and every line reads blank-as-zero, the system records an
issue of the full 4.100 g and books **2.443.600đ** of cost that never happened.
A forgotten shelf and an empty shelf would look identical.

**Resolution — confirm per item, not per line.** The owner works through one
product at a time at the shelf, so the confirmation belongs at that grain:

- He types `1` on `Dâu sấy — Túi 1.000 g`, leaves the other two blank, and marks
  **`Dâu sấy` counted**.
- Inside a confirmed item, every blank line is **0**. That is exactly the
  workflow he described, with no extra typing.
- An item never confirmed is **not counted**: no issue, no correction, stock
  untouched.
- Closing the session lists the unconfirmed items by name, so a missed shelf is
  visible rather than silent.

**"Item" here means the purchased item — `Sữa đặc Vinamilk`, not `Sữa đặc`.**
The two grains are easy to blur and they are not the same: confirmation happens
per purchased item (C6), while the quantity correction happens per ingredient
(S1), which for condensed milk means all **three** purchased items must be
confirmed before `Sữa đặc` moves at all.

**Two behaviours, settled 2026-08-07 before D3 by Sonnet's review — both were unstated, neither found to have a flaw:**

- **Editing a line after its item was confirmed.** The edit clears the
  confirmation and he re-confirms. A badge reading "counted" over a figure that
  changed underneath it is the kind of quiet disagreement this plan exists to
  remove.
- **Closing a session with items still unconfirmed.** Allowed. The
  behaviour is already exactly S2 — unconfirmed is the same as partly counted, so
  those ingredients are left alone. Said so here rather than leaving a
  reader to derive it, and the screen shows the list at close so the choice is deliberate.

This is a design decision, not an owner decision — it delivers the rule he gave
while removing the one way that rule could invent cost out of a forgotten shelf.
Flagged to him because the failure it prevents is measured in money.

### Correcting the stock quantity (Gap 3)

| # | Case | Required behaviour |
|---|---|---|
| S1 | Every **`ACTIVE`** conversion line (see C8) of every **`ACTIVE`** purchased item of an ingredient was confirmed counted (see C6) | Correct that ingredient's quantity to the summed base quantity |
| S2 | **Only some** of an ingredient's lines were confirmed | **Do not touch that ingredient's quantity.** A partial sum is not a count. Report which ingredients were skipped and why |
| S2b | An ingredient's purchased item is **not** `ACTIVE` but still has stock | See C17 — this decides whether S1 can ever be satisfied for that ingredient again |
| S3 | Ingredient whose purchased items were all counted at 0 | Quantity goes to 0 — legitimate, not a special case |
| S4 | Correction writes a ledger row | One `stock_ledger` row per corrected ingredient, so `trg_stock_ledger_inventory_balances` keeps `inventory_balances` right. This is the only new writer to that table |
| S5 | Correction and issue must agree | For a counted item, `issue base_quantity` and the ingredient correction must derive from the **same** counted figure, computed once |
| S6 | **A manual issue (or a reversal) for one of an ingredient's purchased items lands between when its line was counted and when the session is applied** | **Bug, found 2026-08-08 by D8, fixed in the same task — see below** |

**S6 in full — the two levels disagreed by exactly the interleaved amount, confirmed live, not argued.** D5's second pass (§8, `apply_stocktake_session_atomic`) computed the ingredient's correction as `summed_counted − a FRESH re-read of the ingredient's stock_ledger sum at apply time`. The purchased-item level, by contrast, uses the **frozen** `theoretical_at_count` snapshot taken when the line was saved. Those are two different baselines, and by construction the ingredient formula collapses to `new_ledger_sum = summed_counted` **no matter what the fresh baseline was** — silently discarding any event (a manual issue, a reversal) that touched the ledger between count-time and apply-time.

Live proof, `Dâu sấy` (`SPM-033`/`ING-028`), inside `BEGIN...ROLLBACK`: opened a session, counted `SPM-033 = 1.000` (snapshot `theoretical_at_count = 4.100`), then — **mid-session, before applying** — issued a real manual slip of `500` for the same item. Applied the session:

| Level | Formula used | Result |
|---|---|---|
| Purchased item (`stock_issues`, cost-correct) | `total_purchased − total_issued` (fresh, automatically layers the manual issue) | **500** — matches physical truth (1.000 counted, minus 500 issued afterward) |
| Ingredient (`stock_ledger`, old formula) | `summed_counted − fresh_ledger_read` | **1.000** — the manual issue's `-500` vanished entirely |

The two numbers for the *same physical stock* disagreed by exactly 500đ worth of Dâu sấy — the interleaved manual issue's own amount. Gap 3's whole purpose was making these two levels agree; under this scenario they did not.

**Fix.** The ingredient correction must be built the same way the purchased-item level already is: the sum of each of this session's purchased-item lines' own **frozen** `count_variance` (`counted_qty − theoretical_at_count`), applied as a delta on top of the fresh ledger baseline — not an independently recomputed `summed_counted − fresh`. This makes the ingredient-level write **structurally** the mirror image of the issues just written for the same lines (`ingredient_variance = −Σ issued_amount` for this session's lines under that ingredient), so the two levels cannot drift apart by construction, regardless of what else touches the ledger in between. Re-verified live after the fix: same scenario, both levels now read **500**.

**Also covers the owner's concern 3 (reversal then count), checked separately — this had never been tried before.** Live, same fix: a mistaken manual issue (500) immediately reversed (net ledger effect 0, `ING-028` back to exactly `4.100`), then a stocktake session counting `4.000` (a small real shortfall). Both levels agreed exactly at **4.000** — the fix is not specific to "a manual issue" as the interleaving event; it is correct for *anything* that touches the ledger between count-time and apply-time, including a reversal.

### Issue slips

| # | Case | Required behaviour |
|---|---|---|
| I1 | Spoilage / waste | `source = 'MANUAL'`, reason recorded in `note` |
| I2 | Internal use (staff drinks, recipe testing) | Same path, different reason |
| I3 | Entry unit | Same package-size shape as counting (§4) |
| I4 | Issuing more than on hand | Refuse. `lib/issue-costing.ts` already throws `issue exceeds quantity on hand`; the screen must refuse **before** writing, with the shortfall named |
| I5 | Issue dated before any purchase | Refuse — `lib/issue-costing.ts` throws `issue precedes any purchase` |
| I6 | Back-dated issue slip | Allowed, but it changes past periods. Warn on screen and state which months move |
| I7 | Mistaken slip | **Never delete.** Mark it reversed and write a compensating entry **stamped now, valued at the running average now** — see below. Both rows stay visible, linked |

#### I7 in full — decided 2026-08-08, and it was already decided

The open question was whether a reversal should compensate **at the original
moment** (so the books read as if the slip never happened) or **at today's
price** (so the correction lands in the current period).

**Today's price, in the current period.** Three reasons, in order of weight:

1. **The owner already chose this shape.** `BR-INV-008` puts found goods back in
   the period they are found, not the period they were wrongly issued, and he was
   told that plainly before agreeing. A mistaken slip is the same event — goods
   recorded as leaving that never left. Deciding it the other way would leave two
   near-identical corrections behaving differently.
2. **Plan C spent a week removing the machinery that rewrote closed periods**,
   and retired it because a nightly job silently restating history is dangerous
   in a way nobody notices until it is far too late. Reversing at the original
   moment rebuilds exactly that, by hand.
3. **It cascades.** The replay is chronological, so an event inserted in the past
   changes the running average for every issue after it. One corrected slip
   would silently revalue months of later ones.

**A reversal is mechanically a "goods found" event** — same path, same sign, same
valuation at the live running average — carrying a note that names the slip it
reverses. `BR-INV-008` is already built, so this needs a link and a label, not a
second mechanism.

**Money still conserves, and the average still does not move.** The identity is
structural: a reversal adds *v* to stock value and removes the same *v* from
recognised cost, so `total paid = stock value + net cost recognised` holds for
any valuation rate. Using the **live** average additionally leaves the average
itself unchanged, which is the invariant `BR-INV-008` was chosen to protect.

**What the owner gives up, stated plainly:** the month containing the mistake
keeps its wrong figure for ever. That is the price of never rewriting a closed
book, and it is the same price he already accepted for found goods.
| I8 | Issue slip and stocktake on the same day | Ordering by timestamp must be deterministic; the replay in `lib/issue-costing.ts` sorts by `at`, so equal timestamps need a stable tiebreak |
| I9 | Issue slip must also correct the ingredient quantity | Same rule as S1/S4 — an issue reduces both the issue book and the ingredient balance |
| I10 | **The same purchased item appears on two lines of one slip** | **Decided 2026-08-08 (D9).** Allowed, not merged and not refused — see below |
| I11 | **Reversing a slip that has more than one line** | **Decided 2026-08-08 (D9).** Stays per-line — see below |

**I10 in full.** Checked the mirrored screen first rather than deciding from
nothing: `PurchaseOrderForm.tsx` does not merge or refuse two lines naming
the same purchased item either — it just lets both stand. Following the
same rule keeps the two screens genuinely symmetric, not symmetric except
for one hidden difference the owner would discover the hard way.

The real risk is not the duplicate line itself, it is validating it wrong.
Two lines for the same item must be checked **against each other**, not
independently against the same stale on-hand figure — a slip for `100` and
another for `100` of an item with `150` on hand must refuse the second
line, even though each alone would pass a naive per-line check against a
snapshot taken before either was written. `create_issue_slip_atomic`
tracks a running remaining-balance per purchased item **as it processes
the slip's lines in order**, seeded once per item from the on-hand-as-of-
`issued_at` figure (I4's own formula) and decremented after each line that
passes — so a later line sees what earlier lines in the *same slip* already
committed to, before anything is written. Each line still produces its own
`stock_issues` row; nothing is merged.

**I11 in full.** A slip can now be wrong on one line out of many. Forcing
a whole-slip reversal to fix one line means re-entering every correct line
by hand — extra typing that itself risks a new mistake, to correct a
mistake that was never there. `reverse_manual_issue_atomic` (D7b) already
operates on one `stock_issues.id`; a line written by a multi-line slip is
still exactly one `stock_issues` row, so the existing mechanism needs **no
change at all** to reverse a single wrong line out of five. No whole-slip
"undo everything" convenience button is added — reversing five correct
lines to fix one wrong one is not a shortcut, it is five new corrections
to get right.

### Costing

| # | Case | Required behaviour |
|---|---|---|
| K1 | A purchase moves the running average; an issue does not | Already proven in `lib/issue-costing.ts`; re-assert after the change |
| K2 | Period cost needs two runs and a subtraction | `computePeriodIssuedValue`, now in `lib/issue-costing.ts` |
| K3 | No money column is ever persisted | `stock_issues` carries quantity only. Must stay that way |
| K4 | Rounding | Display only. `displayMoney` rounds cost **up** (2026-07-30) |
| K5 | **Two events on the same timestamp** | Write an **explicit** tiebreak inside `computeIssueCosting`, with tests that force a purchase/issue tie and an issue/issue tie |
| K6 | **Found stock (`BR-INV-008`) when on-hand is exactly zero** | **Settled and implemented 2026-08-07.** `computeIssueCosting` tracks `lastUnitCost` separately from `value/quantity` (which is `0/0` once the pool is empty), set whenever a real issue computes a rate. A found event (`base_quantity < 0`) values itself at `value/quantity` when `quantity > 0`, or `lastUnitCost` when `quantity === 0` -- either way the weighted average is provably unchanged (`(V + f·A)/(Q + f) = A` when `A = V/Q`). `quantity === 0` also forces `value = 0`, clearing float residue without losing the remembered rate. A found event with no purchase ever recorded (`quantity <= 0 && lastUnitCost === null`) still throws -- no lot ever existed to find. 5 tests in `lib/issue-costing.test.ts`: empty-then-found with the average unchanged, found at a different rate than the lifetime average (proves `lastUnitCost` is read, not recomputed), found while quantity is still positive, found-with-no-purchase throws, and an explicit before/after rate comparison |
| K7 | **`getPnLDataV2` must actually report a non-zero COGS** | **Verified 2026-08-08, D8's own first priority.** `stock_issues` had been empty since Plan C's cutover, so this exact function had never once produced a non-zero figure -- the whole point of Plan C/D, unexercised. Two proofs, not one: (a) a permanent test in `app/admin/reports/actions.test.ts` calling the real `getPnLDataV2` with a mocked nhập→xuất tay→kiểm kê chain, hand-verified to 150.000đ; (b) a live `BEGIN...ROLLBACK` building the same three-step chain through the real RPCs against real `Dâu sấy` data, with the captured rows fed through the real `computeIssueCosting` -- money conserved exactly (`issued_value + closing_value` = the exact total ever paid, to the cent), proving the real engine handles a real, partly-backdated RPC-produced chain correctly, not just clean fixture numbers |
| K8 | **A purchase must be valued at what was paid, not the bare line subtotal (`BR-COGS-006`)** | **Found 2026-08-09 by the owner refusing a number, fixed the same day, D11 -- method corrected the same day again after a second owner question.** `buildIssueCostingPurchases` fed `purchase_order_lines.subtotal` straight into the replay; shipping, tax, vouchers and discounts live only on the order header and reached no line, overstating every purchase-derived cost figure by 3.623.494đ (7,4%) across all 63 completed orders. First implementation reused `allocateOrderDiscount` -- the owner asked why not divide each line directly against the order total, and was right: on all 20 real orders carrying a header charge, the direct form and the running-remainder form give identical numbers with 0 residue either way, and the adjustment is not always a discount (`PO-056` carries +40.000đ, shipping with no voucher, the other 19 negative) -- a shape `allocateOrderDiscount` does not fit, since it is built for a positive amount to subtract, capped so a line cannot go below zero. `lib/purchase-order-cost-allocation.ts` (`allocatePurchaseOrderCost`) now divides directly (`round(adjustment × line.subtotal ÷ sum_of_line_subtotals)` per line, independently), with one guard: a rounding residue goes to the largest line, satisfying `BR-COGS-003` for either sign without a capacity-capped allocator built for a different problem. Verified live against real production data, not just unit fixtures: `PO-031` (single line) reproduces exactly 241,78đ/g; `PO-059` (3 real lines, both shipping and a voucher) reconciles to `total_amount` to the dong, 0 residue; `PO-056` (the one real order with a positive adjustment) correctly *increases* every line's cost rather than decreasing it; a hand-built case (adj=100 across 3 equal lines, where independent rounding undershoots by 1) proves the residue guard actually fires and still reconciles exactly. 5 tests in `lib/purchase-order-cost-allocation.test.ts`, 1 integration test in `app/admin/reports/actions.test.ts` proving the fix through the real `getPnLDataV2` with `PO-031`'s exact numbers -- the raw-subtotal figure it explicitly rejects (1.570.000đ) is the exact bug the owner caught. **Re-ran the whole of §5's K section afterward, per the owner's own instruction: zero existing tests needed their expected numbers changed** -- none of them had ever set `shipping_fee`/`voucher_amount`/`discount_amount` in their fixtures, which is exactly how this bug went unnoticed until real data forced it into view. The adjusted figure is derived at read time only -- never persisted |

**K5 in full — there is no tiebreak today, only luck.** `computeIssueCosting`
sorts on `at` alone. It behaves correctly for two accidental reasons, neither
written down nor tested: purchases are pushed into the array before issues, and
JS sort has been stable since ES2019, so a purchase happens to win a tie; and
two issues at the same instant fall back to whatever order `findAllNoCache`
returned, which is `id` order.

This is not theoretical. `apply_stocktake_session_atomic` takes **one**
`v_confirmed_at := now()` and stamps every issue in the session with it, so exact
ties happen on every count — harmless only because the replay groups by
purchased item, so those ties never meet. **D7 removes that protection**: two
manual issue slips for the same purchased item on the same day will tie for real,
and will tie *hard* if I6's date picker offers a date without a time. Decide the
order deliberately — purchase before issue, then by id — rather than inheriting
it from an array.

### Mobile (D10, added 2026-08-08)

Not in the original 35 — no case in this table named a device before the owner
asked *"Em có thiết kế ưu tiên theo kiểu mobile first không?"* and answered his
own question: he counts **on a phone, standing at the shelf**. Both screens in
this plan are the only two used away from a desk; both need every row below.

| # | Case | Required behaviour |
|---|---|---|
| M1 | A table wider than a phone screen | **No horizontal table on a phone.** One card per package line, stacked — not `overflow-x-auto` on a `<table>`, which still requires a sideways scroll one-handed |
| M2 | Entering a quantity on a phone | `inputMode="numeric"` on **every** quantity field, both screens, so the phone opens the number pad instead of the full keyboard |
| M3 | Tapping a control on a phone | Every actionable control sized for a thumb (44px minimum, this app's own existing `Button` `md`/`lg` sizes), including the per-purchased-item confirm button (C6) — not just the primary submit |
| M4 | Standing at a shelf partway through | **Visible progress**: how many confirmed out of how many, kept legible without scrolling back to the top |

**What must survive this unchanged, on pain of making the phone unusable for
the one thing it exists to do here:** `saveStocktakeLine` persists each
package line to the server the moment it is confirmed
(`StocktakeClient.tsx`). A phone that locks, sleeps, or drops signal
mid-count loses nothing already confirmed. Rebuilding the layout must not
collapse this into a submit-at-the-end form — that would trade the one
property that makes counting on a phone viable for a cleaner-looking diff.

---

## 6. Worked example — `Dâu sấy`, the hardest case, real numbers

Chosen deliberately: three conversions all called "Túi". If this works, the
48 single-unit items are easier by construction.

**Purchases on record** (`ING-028`, base unit g, all `COMPLETED`):

| Bought | Base qty | Paid |
|---|---|---|
| 1 Túi × 100 g | 100 g | 57.000đ |
| 2 Túi × 500 g | 1.000 g | 696.600đ |
| 1 Túi × 1.000 g | 1.000 g | 510.000đ |
| 1 Túi × 1.000 g | 1.000 g | 550.000đ |
| 1 Túi × 1.000 g | 1.000 g | 630.000đ |
| **Total** | **4.100 g** | **2.443.600đ** |

Weighted average = 2.443.600 ÷ 4.100 = **596 đ/g exactly**.

Current balance is **4.100 g** — everything bought, nothing taken out, the
expected post-cutover state.

**The owner counts.** This is his own worked example, verbatim: the 100 g bag is
finished, the 500 g bag is **open and in use**, the 1 kg bag is still sealed.
Under §3.4 only the sealed one is counted.

| Line | Entered | Base |
|---|---|---|
| Dâu sấy — Túi 100 g | blank (or 0) | 0 g |
| Dâu sấy — Túi 500 g | blank (or 0) — **open, not counted** | 0 g |
| Dâu sấy — Túi 1.000 g | **1** | 1.000 g |
| **Counted total** | | **1.000 g** |

…and he marks `Dâu sấy` as counted (C6), which is what makes the two blanks
mean zero rather than "not reached".

**What must happen:**

- Issue recorded: 4.100 − 1.000 = **3.100 g**
- Cost of that issue: 3.100 × 596 = **1.847.600đ**
- Ingredient correction: `Dâu sấy` quantity 4.100 g → **1.000 g**
- Remaining stock value: 1.000 × 596 = **596.000đ**
- Cross-check: 2.443.600 − 1.847.600 = **596.000đ** ✓

Note what the 3.100 g contains: the finished 100 g bag, plus the whole 500 g bag
even though some of it is still on the shelf. That is §3.4 working as intended —
the open bag was expensed the moment it stopped being sealed, and it will not be
counted or charged again at any later count.

Every figure above is a number the implementer can compare against before
running anything on the shop's data.

---

## 6b. Worked example — D7, the owner's own seven-step sequence

Chosen by the owner deliberately (2026-08-08): *"nhập 01/01, xuất 02/01, nhập
05/01, xuất 06/01, xuất+nhập 08/01, xuất 09/01, đếm 15/01"* — a sequence built
to hit four hard paths at once: two package sizes in one warehouse, the pool
emptying and refilling twice, a same-day tie, and an over-count. This is
hypothetical data (nothing like it has happened yet — `stock_issues` is still
empty), so it uses a real item with a real two-size shape (`Kem whipping
Anchor`, `Hộp 250 ml` / `Hộp 1.000 ml`, §4) and round illustrative money, the
same way the owner's own same-day example in §3 decision 5 did.

Every figure below was produced by `computeIssueCosting` itself (a throwaway
script, not hand arithmetic, then cross-checked by hand) — this is what the
implementer compares D7's code against, and what the test in D7's task
below is built from.

| When | Event | Base qty | Money | Running quantity | Running value | Rate |
|---|---|---|---|---|---|---|
| 01/01 09:00 | Nhập, Hộp 1.000 ml × 5 | +5.000 ml | 5.000.000đ | 5.000 ml | 5.000.000đ | 1.000đ/ml |
| 02/01 09:00 | Xuất (toàn bộ) | −5.000 ml | cost 5.000.000đ | **0 ml — cạn lần 1** | 0đ | — |
| 05/01 09:00 | Nhập, Hộp 250 ml × 10 | +2.500 ml | 3.750.000đ | 2.500 ml | 3.750.000đ | 1.500đ/ml |
| 06/01 09:00 | Xuất (toàn bộ) | −2.500 ml | cost 3.750.000đ | **0 ml — cạn lần 2** | 0đ | — |
| 08/01 **08:00** | Nhập, Hộp 1.000 ml × 4 | +4.000 ml | 4.800.000đ | 4.000 ml | 4.800.000đ | 1.200đ/ml |
| 08/01 **14:00** | Xuất (cùng ngày, giờ sau) | −1.000 ml | cost 1.200.000đ | 3.000 ml | 3.600.000đ | 1.200đ/ml |
| 09/01 09:00 | Xuất | −1.500 ml | cost 1.800.000đ | 1.500 ml | 1.800.000đ | 1.200đ/ml |
| 15/01 10:00 | Đếm được 1.800 ml (lý thuyết 1.500, ≤ tổng mua 11.500) | **found +300 ml** (`BR-INV-008`) | +360.000đ (tại giá hiện hành 1.200đ/ml) | 1.800 ml | 2.160.000đ | **1.200đ/ml — không đổi** |

Cross-check: total money in = 5.000.000 + 3.750.000 + 4.800.000 = **13.550.000đ**.
`issued_value` (net of the found event) = **11.390.000đ**, `closing_value` =
**2.160.000đ**. 11.390.000 + 2.160.000 = 13.550.000 ✓.

**What the 08/01 line proves.** Timestamped only to the day, this is a real
tie — exactly the case §3 decision 5 exists to close. Timestamped to the hour,
it resolves itself with no tiebreak needed: nhập 08:00 lands first, so the
14:00 xuất draws from 4.000 ml on hand and succeeds. Run the same two events
with the xuất timestamped *before* the nhập (proving the danger, not just the
fix): `computeIssueCosting` throws `issue precedes any purchase` — I4/I5
firing exactly as they should on a pool that is genuinely empty at that
instant. Confirmed live against the real function, not asserted.

**What 15/01 is not.** It is not I7 — nothing here was entered by mistake.
It is `BR-INV-008` on a purchased item that empties and refills, showing the
rule already proven in §6 for `Dâu sấy` holds the same way after a pool has
gone to zero more than once.

---

## 7. The one rule this plan must decide (C10)

`docs/OPEN-ITEMS.md` item 32: what happens when the count is **above** the
theoretical figure but **below** everything ever purchased?

It is not an error. It means the theoretical figure drifted low — the usual
cause is stock used and never recorded, then the next count finding more than
expected. Under the old engine this was impossible to interpret; under the new
one it is simply a negative issue.

But `stock_issues.base_quantity` carries `check (base_quantity > 0)`
(`0052_stock_issues.sql`), so a negative issue **cannot be stored**.

**First proposal, now withdrawn.** It was: accept the count, correct the
ingredient quantity upward, record **no issue row**, and note the discrepancy on
the session so it is visible rather than silent.

**Sonnet's challenge killed it, and the reasoning is worth keeping.** For a
purchased item, "theoretical" is recomputed from scratch every time as
`purchase_order_lines − stock_issues` (`0053_stocktake_purchased_items.sql:
244-256`) — it never reads `stock_ledger`. Correcting the *ingredient* quantity
therefore changes nothing the purchased-item calculation looks at. So the same
discrepancy reappears **at every future count, for ever**. What was described to
the owner as "a note so it is visible" would in fact be a prompt that never
stops asking, about a difference already resolved. The costing itself stays
correct — no event reaches `computeIssueCosting`, so the average does not move —
but the experience is wrong, and describing it as a one-off note would have been
misleading.

**What the case actually is.** Under the sealed-only rule, counting more than
theoretical almost always means **a sealed package was missed at an earlier
count** and so was expensed then. Now it turns up. Goods thought consumed have
reappeared.

**Revised proposal, for the owner:** record it as **hàng tìm lại được** — a
return that puts the quantity back at the average it left at, which closes the
discrepancy permanently and leaves the average unchanged. That requires
`stock_issues.base_quantity` to accept a negative value, so the `> 0` check
(`0052_stock_issues.sql`) has to be reconsidered rather than defended: the
earlier "a negative issue is a different event wearing the wrong name" reads
well but leaves the loop open.

**Alternative worth putting to him:** refuse the count and ask him to check for a
purchase that was never entered — the other common cause. Safer, but it blocks
him on a screen when the goods are physically in front of him.

**Undecided. This is D2, and it goes to the owner as a business question with
both options and the permanent-prompt consequence stated plainly.**

---

## 7b. I7's open question — routed by the owner to Opus, 2026-08-08

**Decided 2026-08-08 — see "I7 in full" under §5 and `BR-INV-009`.** Today's
average, in the current period, reusing `BR-INV-008`'s mechanism exactly.
D7b is unblocked. The rest of this section is kept for the record of how the
question was put, not as a live open item.

I7 says a mistaken issue slip must be marked reversed and answered with a
compensating entry, never deleted. That leaves one thing undecided: **what
rate values the compensating entry?** Sonnet found the question is not
cosmetic — it changes how much money the reversal returns — and asked the
owner with a concrete pair of numbers. The owner's answer: *"Hỏi Opus."*

**The example put to him, kept here so Opus has it verbatim:**

01/01 nhập 1.000 đơn vị, 1.000.000đ (1.000đ/đv). 03/01 xuất **nhầm** 500 đơn vị
(đáng lẽ không xuất) → trừ 500.000đ, còn 500 đv / 500.000đ. 06/01 nhập thêm 500
đơn vị, 750.000đ (1.500đ/đv) → đơn giá bình quân đổi thành 1.250đ/đv. 10/01
phát hiện phiếu ngày 3/1 sai và đảo nó.

**Option A — bù đúng thời điểm gốc (Sonnet's recommendation).** Ghi bù ngay
sau thời điểm phiếu sai (3/1), dùng đúng đơn giá lúc đó (1.000đ/đv): trả lại
đúng 500.000đ đã trừ nhầm. Mọi sự kiện sau đó phát lại đúng như phiếu sai
chưa từng tồn tại — đơn giá bình quân sau khi nhập thêm ngày 6/1 tự động ra
lại đúng 1.250đ/đv. Đây cũng là điều I6 đã dự liệu khi yêu cầu cảnh báo
"tháng nào sẽ đổi số": một phiếu sai từ đầu thì sửa nó phải đổi số các tháng
đã đóng, không né được.

Kỹ thuật: dùng lại đúng cơ chế số âm đã xây cho `BR-INV-008`
(`computeIssueCosting`'s found-stock branch) — không cần thêm phép tính mới
trong engine, chỉ cần ghi dòng bù đúng vào thời điểm ngay sau phiếu gốc
(mốc giờ, không phải "bây giờ").

**Option B — bù theo đơn giá hiện hành lúc phát hiện (như hàng tìm lại
được).** Ghi bù vào 10/1 theo giá đang có lúc đó (1.250đ/đv): trả lại 625.000đ,
không phải 500.000đ đã trừ nhầm — sinh lệch 125.000đ, và các ngày 3–9/1 (đã
đóng) vẫn giữ số sai. Cùng cơ chế `BR-INV-008` đang dùng, nhưng `BR-INV-008`
là hàng thật phát hiện hôm nay; đây là sửa một phiếu sai ngay từ đầu — Sonnet's
view is the two are not the same case even though the code path could be
made to look identical.

**No longer blocking.** D7a landed without this answer, as planned. D7b
(the reversal RPC) proceeds now that `BR-INV-009` is written.

---

## 8. Tasks

Ordered so each is verifiable before the next. **Fix and verify every listed gap
before writing screen code** — the owner's instruction: *"Xử lý từng lỗi cho đến
khi hoàn tất rồi mới bắt đầu code."*

- **D1** Resolve `NNL-004` (Gap 4). Mark inactive, never delete. Confirm no
  recipe, purchase, or ledger row references it first.

  **Done 2026-08-07** (`scripts/deactivate-nnl-004.ts`). Dry run: 0 recipe
  references (scanned all 139, `ingredients_json` is jsonb so filtered in
  JS rather than trusting an `ilike` that silently mismatches the column
  type), 0 purchased items, 0 `stock_ledger` rows, no `inventory_balances`
  row. Owner approved `--apply` scoped to the exact commit; re-verified all
  four zeros fresh at run time rather than reusing the dry run (the plan
  itself was still under review in between, though nothing this specific
  check depends on had changed). Applied: `NNL-004` status `INACTIVE`, row
  intact. Confirmed after: `ING-033` (the real "Sữa yến mạch") untouched —
  still `ACTIVE`, still holds `SPM-038` "Sữa yến mạch Oatside" — and the
  purchased-item count-list size unchanged at 50 (`NNL-004` never had a
  purchased item to remove).

  **Found on the way, unrelated to this task, reported rather than
  fixed:** `deleteBaseIngredientAction`
  (`app/admin/inventory/base-ingredients/actions.ts`, wired to a live
  button in `BaseIngredientsClient.tsx`) issues a real `DELETE` on
  `base_ingredients` via `lib/sheets_db.ts`'s `remove()` — a standing
  violation of `CLAUDE.md` section 2's never-delete rule, live today,
  unrelated to Plan D. Not touched here; D1's own script does not use it.
- **D2** Decide C10 with the owner (§7), and write it into
  `docs/BUSINESS-RULES.md` before any code depends on it.

  **Done as `BR-INV-007`/`BR-INV-008`** (`7b1446f`), except one edge:
  valuing a "found" event when the purchased item's on-hand is currently
  zero (no `V/Q` to draw on). Owner routed this to Opus rather than
  choosing an option now — pending, does not block D1/D3.
- **D3** Build the package-line model (§4): one line per active conversion, size
  label derived from `conversion_rate`. Pure function, unit-tested against
  `Dâu sấy` and `Kem whipping Anchor` before any screen uses it.

  **Done 2026-08-07** — `lib/stocktake-package-lines.ts` (`buildPackageLines`),
  6 tests in `lib/stocktake-package-lines.test.ts` against both items' real
  conversion shapes (measured live, not invented): `Dâu sấy` → `["Túi 100 g",
  "Túi 500 g", "Túi 1.000 g"]`, `Kem whipping Anchor` → `["Hộp 250 ml",
  "Hộp 1.000 ml"]`, plus the single-conversion common case, C8 (inactive
  conversion dropped), multi-item grouping, and the empty-input case.
  Size label is always base-unit + thousand-separator (no auto-scaling to
  kg/l) — §4's own mockup used the scaled form for one item and not the
  other, so it was never an actual rule, and the schema defines no scaling
  table to implement it against. C17 and both C6 behaviours settled per
  their own rows above; the pure function itself only needed C8's filter.
- **D4** Drop `BASE_INGREDIENT` lines from new sessions (Gap 1). Existing open
  sessions keep theirs (C8/C16).

  **Done 2026-08-07** (`app/admin/inventory/stocktake/actions.ts`,
  `startStocktakeSession`). `BASE_INGREDIENT` lines removed from the items
  array entirely; new sessions offer `PURCHASED_ITEM` lines only.
  `getStocktakeSessionData` untouched, so an already-open session still
  displays whatever lines it was created with, satisfying C8/C16 by
  construction rather than a special case. C17 implemented alongside: a new
  `filterByC17` helper only queries purchases/issues when an inactive
  purchased item actually exists (today: never, verified again), keeping an
  inactive item's line while its computed on-hand (purchased minus issued,
  same formula as `apply_stocktake_session_atomic`) is still positive.
  Updated the one existing test that asserted the now-retired
  `BASE_INGREDIENT`-included shape, with the reason stated in its own
  comment rather than deleted quietly; added 2 tests for C17 (kept while
  on-hand > 0, dropped once it reaches 0).
- **D5** Make the purchased-item branch also correct the ingredient quantity
  (Gap 3), obeying S1–S5. Migration; list the triggers on `stock_ledger` first.

  **Done 2026-08-07** — `supabase/migrations/0055_stocktake_ingredient_correction.sql`.
  Triggers re-verified fresh, immediately before writing the migration:
  `stock_ledger` still carries only `trg_stock_ledger_inventory_balances`,
  unchanged — the mechanism this correction relies on to update
  `inventory_balances`, not touched.

  `apply_stocktake_session_atomic` gained a second pass, after the existing
  per-line one: for every base ingredient owning at least one counted
  `PURCHASED_ITEM` line this session, correct it only if **every** purchased-
  item line for that ingredient in this session (confirmed or not) has
  `counted_qty` set (S1/S2) — completeness checked against this session's
  own lines, not a freshly re-queried set, since C14 already puts a
  purchased item added mid-session out of scope and D4/C17 already decided
  which purchased items a session offers (S2b closed by construction, no
  extra code needed here). The correction and the per-line issue read the
  exact same `stocktake_lines.counted_qty` values (S5) — one `SUM` for the
  ingredient, the line's own value for the issue, never two independent
  computations of the same figure.

  Ingredient corrections are folded into the *existing* `ledger_count`/
  `ledger_ids`/`rows`, tagged `item_type = 'BASE_INGREDIENT'`
  (`item_reference` = the ingredient id) — D4 already removed real
  `BASE_INGREDIENT` lines from every new session, so the tag was free to
  reuse for this without touching `StocktakeItemType` or the row shape
  `lib/stocktake-transaction.ts` already validates
  (`ledgerCount + issueCount === rows.length`). A skipped ingredient (S2)
  is **not** added to `rows` — it writes nothing, and that would have
  broken the same invariant — it goes in a new, separate
  `skipped_ingredients` field instead, parsed into `skippedIngredients` on
  the TypeScript side.

  **Verified against the real `Dâu sấy` example, not a fixture** — a real
  stocktake session (`STK-003`), one line (`SPM-033`), counted `1000`,
  `apply_stocktake_session_atomic` called with `p_dry_run = true`, then the
  session cancelled: `issueCount 1`, `ledgerCount 1`, `SPM-033` issue
  variance **-3.100**, `ING-028` ingredient-correction variance **-3.100**,
  projected quantity **1.000** — implied cost `3.100 × 596 =`
  **1.847.600đ**. All three of the plan's own target figures reproduced
  exactly. Confirmed after, independently: the cancelled session left no
  trace — `ING-028` still exactly `4.100 g`, `stock_ledger` still 138 rows,
  `stock_issues` still 0 rows.

  6 new/updated tests: 2 in `lib/stocktake-transaction.test.ts`
  (`skippedIngredients` parses separately from `rows`; an ingredient-
  correction row parses like any other row and the count invariant still
  holds with one issue + one ingredient correction present).

  **Deliberately out of scope for this migration, not silently rolled in:**
  `stock_issues.base_quantity`'s `check (base_quantity > 0)` and
  `save_stocktake_line_atomic`'s unconditional refusal of
  `counted_qty > theoretical` — both still block `BR-INV-008`
  ("hàng tìm lại được") end to end. K6 (`lib/issue-costing.ts`) proved the
  *engine* is ready; wiring it into this RPC and the constraint is separate
  work, not requested as part of D5.
- **D5b** Wire up `BR-INV-008` (goods found). **Added 2026-08-07 — the plan
  approved the rule and gave no task that builds it.** Sonnet found the hole
  after D5: two things still refuse it, `stock_issues.base_quantity > 0`
  (`0052_stock_issues.sql`) and `save_stocktake_line_atomic`'s rejection of a
  count above theoretical. K6 has already made `computeIssueCosting` ready; the
  RPC and the constraint have not caught up.

  **This must land before the owner's first real count, not after.** The
  post-cutover state makes an over-count likely rather than exotic: theoretical
  is inflated for every ingredient, and the first count is the one most likely to
  find a sealed package the system does not expect. Reaching that refusal with
  goods in hand and no way through is the worst possible introduction to the new
  screen.

  **Worked example, owner-approved before any code, real `Dâu sấy` data
  (§6):** total purchased 4.100 g / 2.443.600đ, 596đ/g exact.

  | Step | Counted | Result |
  |---|---|---|
  | 1 (ordinary, D5 already handles it) | 1.000 g | Issue 3.100 g, cost 1.847.600đ, `ING-028` → 1.000 g, 596.000đ left |
  | 2 (D5b — the actual case) | 1.200 g (> theoretical 1.000, ≤ purchased 4.100) | Found 200 g at the **live** average (quantity was still > 0): 200 × 596 = 119.200đ. `ING-028` → 1.200 g, 715.200đ. Average 715.200 ÷ 1.200 = **596đ/g, unchanged** |
  | 3 (illustrates K6's `lastUnitCost` branch, not re-tested live — already covered by K6's own tests) | Pool later drawn to exactly 0, then 50 g found | Live average is `0/0`; uses the remembered rate (596) instead: 50 × 596 = 29.800đ, average still 596đ/g |

  BR-INV-005's boundary is untouched: counted above 4.100 g (everything ever
  purchased) is still refused, unconditionally — that cannot be "found"
  stock by construction (see the invariant proof below).

  **Done 2026-08-08** —
  `supabase/migrations/0056_found_stock.sql`. Two changes only, exactly as
  scoped; `apply_stocktake_session_atomic`'s counting math (0055) and
  `computeIssueCosting` (K6) were **not** touched — both already computed
  the correct signed result once these two refusals lifted:

  1. **`stock_issues.base_quantity` constraint.** Live definition confirmed
     before writing the migration, not assumed:
     `CHECK ((base_quantity > (0)::numeric) AND (base_quantity <> 'NaN'::numeric))`.
     Replaced with `check (base_quantity <> 0 and base_quantity <> 'NaN'::numeric)`
     — **the `NaN` clause is kept, not dropped.** Confirmed live why it has
     to be: in Postgres numeric ordering `NaN` sorts above every value, so
     `'NaN'::numeric > 0` is `true` and `'NaN'::numeric <> 0` is also `true`
     — neither sign check has ever excluded `NaN` on its own; only the
     explicit second clause does. Losing it while relaxing the sign check
     would have opened the exact column the whole costing engine is built
     on to a `NaN` write.
  2. **`save_stocktake_line_atomic`.** The refusal for
     `theoretical < counted ≤ total_purchased` is gone — that range is
     `BR-INV-008`, accepted with no exception. The refusal for
     `counted > total_purchased` (`BR-INV-005`) is byte-identical,
     unchanged.
  3. **`apply_stocktake_session_atomic`, note text only.** A negative issue
     (`count_variance > 0`) gets *"Hàng tìm lại được (BR-INV-008) -- kiểm kê
     định kỳ \<ngày\>"* instead of the generic stocktake note — a negative
     row found six months later must explain itself in the owner's own
     language, not read as a data error.

  **Reporting impact, recorded here and in `BR-INV-008` because the owner
  will see it, not just the implementer:** a found event reduces the
  **current** period's cost, not the past period where the over-issue
  originally happened — correct accounting (a prior-period correction lands
  in the period it is discovered), but it means a month with a large found
  event will show unusually low COGS. Said here in advance rather than
  waiting for the owner to notice a low figure and suspect a bug.

  **Verified live, real Dâu sấy data, inside one transaction rolled back at
  the end — nothing persisted.** Session A: counted 1.000 g (matches §6),
  applied for real *within the same transaction* to establish a genuine
  `theoretical = 1.000` (no way to reach the D5b range against today's data
  without first creating real consumption — doing that permanently would
  have needed its own approval, so it was done and undone inside one
  transaction instead). Session B: counted 1.200 g.

  Five checks, all passed:
  1. **`BR-INV-005` still refuses** counted `5.100 > 4.100` (unchanged) —
     confirmed by the actual exception text.
  2. **`BR-INV-008` now accepts** counted `1.200` (theoretical `1.000`,
     purchased `4.100`) — no exception, where the old code would have
     refused.
  3. **The stored issue row**: `base_quantity = -200`, note = *"Hàng tìm
     lại được (BR-INV-008) -- kiểm kê định kỳ 2026-08-08"* — exact text,
     read back from the table, not the code that wrote it.
  4. **`inventory_balances` moved the right direction and amount**:
     `ING-028` `1.000 → 1.200` g, delta exactly `+200` — proves
     `trg_stock_ledger_inventory_balances` adds correctly for a *positive*
     `stock_ledger` insert, which D5 had so far only exercised with
     negative deltas.
  5. **`NaN` still rejected** by the replaced constraint — a direct insert
     attempt failed with the expected constraint violation.

  **"Theoretical never exceeds total_purchased," proven, not just argued.**
  A found event's magnitude is bounded by `counted ≤ total_purchased`
  (`BR-INV-005`, test 1 above), and `found = counted − theoretical_before ≤
  total_purchased − theoretical_before = total_issued_before` — a single
  found event can never return more than has already been issued for that
  purchased item, so cumulative `total_issued` after including it is always
  `≥ 0`, and `theoretical = total_purchased − total_issued` can therefore
  never exceed `total_purchased`. The live boundary test (1) is what
  actually enforces this at the only place it can be violated — the count
  entry point — rather than leaving it as an argument nothing checks.

  Confirmed after the rollback, independently: `ING-028` back to exactly
  `4.100 g`, `stock_ledger` back to 138 rows, `stock_issues` back to 0
  rows, no `STK-004`/`STK-005` session rows exist.

  `npx tsc --noEmit`: 0 errors (no TypeScript touched). `npm run build`:
  succeeds. `npx vitest run`: 968/968 unchanged (no JS/TS behavior
  changed — verification was pure SQL against the live database).
  `check-rules-current.ts`: clean.

- **D6** Convert the count screen to purchase units (Gap 5), display only —
  storage stays exact base units.

  **Done 2026-08-08.** `app/admin/inventory/stocktake/actions.ts`:
  `getStocktakeSessionData` now attaches one `packageLine` per `ACTIVE`
  conversion to every `PURCHASED_ITEM` line, built by
  `buildPackageLines` (D3) against `UOM_Conversions` — **the same
  function, not a second label generator.** The pre-existing size-label
  test (`lib/stocktake-package-lines.test.ts`) already proves
  `sizeLabel` is right; this task only had to reuse it. A legacy
  `BASE_INGREDIENT` line surviving from a session opened before D4/D6
  (C8/C16) gets an empty `packageLines` array and falls back to the old
  base-unit input, unchanged — not a crash, not a special case in the
  new code path.

  `StocktakeClient.tsx`: `PackageLineCard` renders one integer input per
  conversion under a single purchased item, one "Xác nhận" button
  (**C6 — confirmation is per purchased item, not per conversion line and
  not per ingredient**, stated explicitly in the component's own
  comment). Blank inputs sum as `0` inside a confirmed item, matching
  the owner's described workflow exactly. A non-integer entry is
  refused with the reason (`BR-INV-007` named in the message) rather
  than rounded — checked with `Number.isInteger`, not `step="1"` alone,
  since a number input still lets a decimal be typed. Editing any
  conversion's value after the item was confirmed clears the confirmed
  state immediately (`setConfirmed(false)` on every keystroke) — the
  next visible state is "đã sửa, chưa xác nhận lại", not a stale ✓
  sitting over a changed number. Closing/previewing a session with
  purchased items still unconfirmed is allowed (already exactly `S2` —
  server-side, nothing changed there) and now lists them by real name in
  the preview panel, not just a count.

  `AppliedSessionView`/preview table keyed by `row.lineId || row.itemReference`
  rather than `row.lineId` alone — D5's ingredient-correction rows (`item_type
  BASE_INGREDIENT`, synthesized from an aggregate) carry `lineId: null` and
  would have collided as React keys or shown a blank name otherwise.

  14 new tests: 2 in `actions.test.ts` (package lines attach correctly
  for the real `Dâu sấy` conversion shape, C8's inactive conversion
  stays excluded; a legacy line gets an empty array, not a crash), 6 in
  `StocktakeClient.test.ts` (source-level, matching this repo's existing
  convention for this file — no jsdom/testing-library in this project's
  Vitest config, confirmed before writing them rather than assumed):
  label reuse, integer-only rejection, per-purchased-item confirmation,
  confirmation clearing on edit, unconfirmed listing, the legacy path
  staying intact.

  `npx tsc --noEmit`: 0 errors. `npm run build`: succeeds. `npx vitest
  run`: 976/976 (163 files, +8). `check-rules-current.ts`: clean. Code
  only — not deployed; push/deploy needs its own separate approval, same
  as every prior code task in this plan.

- **D7** Build the issue slip screen (Gap 2), covering I1–I9. Split so the
  blocked half (§7b) does not hold up the rest.

  - **D7a — everything not blocked by §7b.** Route, screen, `create_manual_
    issue_atomic` (I1–I6, I9), K5's explicit tiebreak, the §6b worked example
    as a real test.

    Design decisions settled while building this, reported rather than asked
    (none is a business tradeoff — each just states what I1–I9 already implied):

    - **I4 in the RPC, not the screen.** `save_stocktake_line_atomic`'s
      pattern reused: lock, compute on-hand fresh
      (`total_purchased − total_issued`, same formula as §7's C10 section and
      `filterByC17`), refuse before any insert if the requested quantity
      exceeds it. A client-side check alone would race two slips issued at
      once; the RPC is the only place both slips cannot both win.
    - **I6's warning covers every month from the slip's date through today,
      not just the slip's own month.** The replay is cumulative — a
      backdated event shifts the weighted average from that instant forward,
      so every period after it, not only the one it lands in, reads a
      different cost. Understating this to "only this month changes" would
      be wrong, not just incomplete.
    - **I9 needs no completeness check.** Stocktake's confirm-per-item
      machinery (C6/S1/S2) exists because a count can be partial and blank
      must not silently mean zero. A manual issue slip is one deliberate,
      complete action on one item — write its `stock_issues` row and its
      ingredient `stock_ledger` row together, same amount, no S1/S2 case to
      apply.
    - **K5's tiebreak, implemented as the plan says: last resort.**
      §6b's 08/01 line is real proof it is rarely needed once slips carry a
      time. The explicit tiebreak (purchase before issue, then by id) is
      still added to `computeIssueCosting`, with the two forced-tie tests
      §5 already asks for (K5 row), so nothing still depends on insertion
      order by accident.

    **Done 2026-08-08.** `supabase/migrations/0057_manual_issue_slip.sql`
    (`create_manual_issue_atomic`), `lib/manual-issue-transaction.ts`,
    `lib/issue-slip-warnings.ts` (`computeAffectedMonths`),
    `lib/purchased-item-onhand.ts` (extracted from the stocktake screen's
    `filterByC17`, now shared by both screens), and
    `/admin/inventory/issue-slips` (route + nav link). §6b's worked example
    reproduced exactly by `computeIssueCosting` and turned into 5 permanent
    tests, including the wrong-order-throws proof. K5's tiebreak added with
    2 forced-tie tests. RPC verified live inside a `BEGIN...ROLLBACK`
    against real `Dâu sấy` data (§9's technique): normal issue, I4 refusal
    (caught and fixed a bug this way — the first draft's error message
    leaked a raw unit id instead of its display name), I5 refusal, nothing
    persisted after rollback. `npx tsc --noEmit`: 0 errors. `npm run
    build`: succeeds. `npx vitest run`: 1001/1001 (167 files, +25).
    `check-rules-current.ts`: clean. Not deployed.

    **Known, accepted scope limit, stated rather than silently omitted:**
    I4's on-hand check is point-in-time correct for the insert itself
    (purchased minus issued as of the chosen `issued_at`), but does not
    prove a backdated insert cannot retroactively push some *later*
    already-existing issue negative. `stock_issues` holds zero real rows
    today, so no such later event exists yet to endanger. Flagged for D8
    to revisit if real usage ever makes it a live risk.

  - **D7b — the reversal RPC (I7).** Unblocked 2026-08-08 — `BR-INV-009`
    decided the compensating entry's rate (today's live average, same
    mechanism as `BR-INV-008`). `reverses_issue_id` (self-referencing,
    nullable), a dedicated RPC (not a generic negative-quantity path on
    `create_manual_issue_atomic` — a reversal needs no on-hand check at all,
    since it only ever returns an exact, already-issued quantity), the two
    invariant tests the owner named (money conserves at any rate; the
    average specifically does not move, which is why the rate must be
    live), and a way on screen to find a past slip and reverse it (D7a's
    screen was create-only).

    **Done 2026-08-08.** `supabase/migrations/0058_reverse_manual_issue.sql`
    (`reverse_manual_issue_atomic`): locks the original row, refuses a
    non-`MANUAL` source and a second reversal of the same slip by name,
    inserts the compensating entry (negative `base_quantity`, dated `now()`,
    `reverses_issue_id` set) and the ingredient's positive `stock_ledger`
    correction in the same transaction. The original row is never updated —
    "giữ nguyên" is literal, not just "unchanged in effect." `lib/manual-
    issue-transaction.ts` gained `reverseManualIssueAtomic`. The owner's own
    worked example (1.000đv @1.000đ, mistaken issue of 500, a second
    purchase moving the average to 1.250đ, then a reversal) reproduced
    exactly by `computeIssueCosting` — money conserves at any rate
    (structural identity), and the average stays at 1.250đ specifically
    because the reversal is valued live, not at the original 1.000đ (shown
    by contrast: valuing it at the original rate works out to 1.166,67đ,
    which would have moved the average). 3 tests. The screen (D7a's was
    create-only) gained a "Phiếu xuất gần đây" list — every `MANUAL` row,
    reversed pairs shown linked both directions without mutating either
    row, a "Đảo phiếu" button only where neither side of that pair already
    exists.

    Verified live inside a `BEGIN...ROLLBACK` against real `Dâu sấy` data:
    a real issue created and reversed within the transaction, the
    reversal's sign/link/note all correct, a second reversal attempt
    refused by name, reversing a (synthetically inserted, rolled back)
    `STOCKTAKE`-sourced row refused, the ingredient ledger's *net* effect of
    the pair is exactly 0 (full restoration — confirmed, not just argued),
    nothing persisted after rollback.

    `npx tsc --noEmit`: 0 errors. `npm run build`: succeeds. `npx vitest
    run`: 1014/1014 (+13 from D7a's 1001). `check-rules-current.ts`: clean.
    Migration self-applied live (schema/RPC only, no business data
    touched). Not deployed.

- **D9** Rebuild the issue slip as a multi-line document with a searchable
  picker. **Added 2026-08-08, from the owner's review of the finished screen —
  he declined to deploy and asked two questions instead**, both of which land on
  my design rather than the build:

  > *"Tại sao phiếu xuất kho 1 lần chỉ cho xuất đúng 1 sản phẩm vậy? Đồng thời,
  > mặt hàng cũng có rất nhiều, nếu chỉ được select thì phải tìm chính xác và
  > rất mất thời gian."*

  **Both are my omissions, and of the same kind.** §5 specified I1–I9 in terms of
  what a single `stock_issues` row must do, and the screen followed the data
  model one row to one form. Nobody asked what the act looks like: throwing away
  five spoiled things is *one* event to the owner, and he should not file five
  slips for it. Nothing in the schema forced one row per slip — `stock_issues`
  rows are independent, so a slip can write many.

  The picker is the same failure viewed from the other side. 52 purchased items
  in a bare `<select>`, three of them beginning "Bột cà phê MR.PHIN", is a
  scrolling exercise. I checked the screenshot he sent rather than reasoning
  about it.

  **Neither needs inventing — the shop's own purchase order screen already does
  both.** `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`
  uses `components/SearchableSelect` and manages an add/remove line list. Reuse
  both. The issue slip should read as the mirror of the purchase order it
  reverses, which is also the layout the owner already has in his hands.

  **Sequencing: this lands before the deploy, not after.** Shipping a screen
  known to be tedious, then replacing it days later, spends the owner's patience
  to save nothing.

  **Done 2026-08-08.** I10/I11 decided and written into §5 before any code
  (`create_manual_issue_atomic` (0057) superseded, not paralleled —
  `supabase/migrations/0060_issue_slip_multiline.sql` adds an `issue_slips`
  header table (mirrors `purchase_orders`) and `create_issue_slip_atomic`,
  taking a JSON array of lines, atomic (any line failing anywhere aborts
  the whole slip, nothing written), I10's cumulative running-balance check
  named per line (`array_position`/two parallel arrays, since a slip
  realistically has a handful of lines). `reverse_manual_issue_atomic`
  (D7b) untouched — I11 needed zero engine changes, each line is still
  exactly one `stock_issues` row.

  `IssueSlipClient.tsx` rebuilt to mirror `PurchaseOrderForm.tsx`
  genuinely, not just in spirit: `SearchableSelect` per line, add/remove
  line list, one shared time field and reason for the whole slip (D9's own
  framing — throwing away five things is one event, not five). Recent-
  slips list groups rows by `slipId` so a multi-line slip reads as one
  card; reversal stays a button per line inside that card.

  Verified live inside a `BEGIN...ROLLBACK` against real `Dâu sấy`/`Kem
  whipping Anchor` data: a 3-line slip with the same item on two lines
  (I10) succeeds, both lines' effects land correctly; a second slip's
  cumulative check correctly refuses its second line, naming the exact
  remaining balance *after* the first line's effect (not a stale
  snapshot); a slip with one valid and one invalid line writes nothing at
  all (atomicity); the old RPC is confirmed gone
  (`function ... does not exist`). Nothing persisted after rollback,
  confirmed independently.

  `npx tsc --noEmit`: 0 errors. `npm run build`: succeeds
  (`/admin/inventory/issue-slips` in the route list). `npx vitest run`:
  1027/1027 (+12 from D8's 1015). `check-rules-current.ts`: clean. Two
  migrations landed since D8 (`0060`, schema/RPC only, no business data
  touched). **Still not deployed** — this is the second review cycle the
  owner has asked for before that approval.

- **D10** Lay the issue slip page out for the screen it is used on. **Added
  2026-08-08 after the owner used the deployed page.** He confirmed the three
  things asked (search, multi-line, package-level count list) all work, then
  asked: *"sau khi xuất thì anh sẽ xem danh sách các phiếu xuất kho ở đâu? Bố
  trí trang như vậy có phù hợp chưa?"* Owner chose to fix this before his first
  count.

  **The first question is the finding.** `RecentSlipsSection` renders
  unconditionally below the submit button — the list is there. He asked where it
  was anyway, which means it is not where a person looks. And with
  `stock_issues` empty there is nothing to draw, so the section collapses to a
  bare heading over blank space. **No empty state was written**: the one moment
  the screen most needs to explain itself is the moment it says nothing.

  1. **Empty state** — "Chưa có phiếu xuất nào" in the section, so it announces
     what it is before it has anything to show.
  2. **Two columns on a wide screen** — form left, recent slips right. The list
     stops being something to scroll for, and the empty right-hand half of the
     page stops being empty. Single column on narrow screens.
  3. **Size the controls to their content.** "Số lượng" is a three-digit field
     rendered half a screen wide; the optional detail box is larger than any
     required field on the page.

  **Out of scope, deliberately:** there is still no way to see slips older than
  the recent list. Real, but it is a second feature, not a layout fix — note it
  in `docs/OPEN-ITEMS.md` rather than building it here.

  #### D10 widened 2026-08-08: the phone is the primary target, for both screens

  The owner asked *"Em có thiết kế ưu tiên theo kiểu mobile first không?"* and
  then answered the question underneath it: he will count **on a phone, standing
  at the shelf**.

  **The app is mobile-first; these two screens are the exception.** The admin
  shell has a slide-out sidebar, a phone-only top bar, and
  `env(safe-area-inset-top)` — nobody adds notch handling without holding a real
  phone. Counted responsive rules:

  | Screen | Rules |
  |---|---|
  | `PurchaseOrdersClient` | 22 |
  | `PurchaseOrderForm` | 12 |
  | `IssueSlipClient` (new) | **4** |
  | `StocktakeClient` (new) | **1** |

  > **Retracted 2026-08-08, the same day, and the count must not be used again.**
  > Counting `sm:`/`md:`/`lg:` prefixes measures the wrong thing. After the
  > rework `IssueSlipClient` dropped from 4 to **1** — and got *better*, because
  > the whole layout is now `grid grid-cols-1 lg:grid-cols-2`: the phone is the
  > base case and a single rule expands it. Done properly, mobile-first needs
  > **fewer** prefixes, not more; a high count often means a desktop layout being
  > undone at every breakpoint, which may well be what the 22 represents.
  >
  > The suspicion the number raised was correct — those two screens genuinely
  > were not designed for a phone. The number was not the evidence for it; the
  > 57-row table was. Left visible rather than deleted, because a plausible
  > metric pointed the right way for the wrong reason, and the next person could
  > "improve" a good component by adding breakpoints to raise its score.

  **This is my omission, and a precise one.** §5 lists 35 cases and not one names
  a device. I specified what must happen and never asked where the person is
  standing — for the two screens in the plan that are *only* used away from a
  desk. The stocktake is a 57-row `<table>`: it has `overflow-x-auto` so it will
  not break the page, but sideways-scrolling a table one-handed while holding a
  bag of dried strawberries is not counting.

  **The owner said the stocktake screen was fine. He said it looking at a
  desktop.** Reopening it is a consequence of the device answer, not a reversal.

  Required, both screens:

  1. **No horizontal table on a phone.** One card per package line, stacked.
  2. **`inputMode="numeric"` on every quantity field** so the phone opens the
     number pad. Present once in `StocktakeClient`, absent from
     `IssueSlipClient`.
  3. **Tap targets sized for a thumb**, including the per-purchased-item confirm
     button from C6.
  4. **Visible progress** — how many items confirmed out of how many — because at
     a shelf he needs to know where he stopped.

  **What is already right, and must stay right:** `saveStocktakeLine` persists
  each line to the server as it is entered (`StocktakeClient.tsx:311,405`). A
  phone that locks, sleeps, or loses signal mid-count does not lose the count.
  This is the single property that makes counting on a phone viable at all — do
  not refactor it into a submit-at-the-end form.

  **Done 2026-08-09 — base D10 and the M1-M4 widening together, one pass.**

  Base D10 (`IssueSlipClient.tsx`): `RecentSlipsSection` now always renders,
  with an explicit empty state ("Chưa có phiếu xuất nào") instead of
  collapsing to a bare heading over blank space. A new `TwoColumnLayout`
  puts the form and the recent-slips list side by side from `lg:` up (form
  left, list right — answers the owner's own question about where the list
  is) and stacks to one column below it, which is also the phone layout
  M1-M4 need. "Quy cách" and "Số lượng" moved out of the 12-column grid
  into their own flex row (a short select next to a `w-24` number input)
  so the quantity field stopped being a 3-digit input stretched full
  screen width; "Chi tiết" changed from a 2-row `<textarea>` to a single-
  line input, since an optional field should not be the visually largest
  one on the page.

  M1-M4, both screens:
  - **M1**: `StocktakeClient`'s confirm-preview `<table>` gained the same
    `hidden md:block` / `md:hidden` card-list split `PurchaseOrdersClient`
    already uses in production — a phone gets one card per row, no
    sideways scroll. `PackageLineCard`'s own conversion inputs changed
    from `grid-cols-2 sm:grid-cols-3` to `grid-cols-1 sm:grid-cols-3` —
    one package size per row on a phone, not two crammed side by side.
  - **M2**: `IssueSlipClient`'s quantity input gained `inputMode="numeric"`
    (previously absent). `StocktakeClient`'s `LegacyLineCard` input got
    `inputMode="decimal"`, not `"numeric"` — deliberately different from
    `PackageLineCard`'s whole-package-only inputs, because this field
    still allows fractional quantities (`step="any"`) and `"numeric"`
    hides the decimal point on most phone keypads.
  - **M3**: every `size="sm"` (32px) button in either screen's counting/
    issuing flow bumped to the default `md` (44px) — the per-item confirm
    button (C6), the legacy save button, the session header actions, the
    reverse button. The remove-line "✕" in `IssueSlipClient` gained real
    padding (`p-2`) instead of a bare glyph with no hit area.
  - **M4**: `StocktakeClient` gained a `position: fixed` progress badge
    ("Đã đếm X/Y"), bottom-right, respecting the phone's safe area
    (`bottom-[calc(1rem+env(safe-area-inset-bottom))]`, the same
    convention `app/admin/layout.tsx` already uses) — stays legible while
    scrolling a long list, unlike the existing top-banner count.
    `IssueSlipClient` gained a live "Đã điền đủ: X/Y dòng" count, computed
    with the exact same per-line validity check `handleSubmit` itself
    uses, so it never disagrees with what actually submits.

  **What did not change, checked explicitly:** `saveStocktakeLine` is still
  called from `handleConfirm`/`handleSave` per line, per confirm — no
  batching, no submit-at-the-end. Confirmed by grepping the two call sites
  still exist, and by a test asserting it (`StocktakeClient.test.ts`).

  **Self-checked at phone width, by looking, not by an automated test —
  this repo's Vitest config has no jsdom for these files.** A temporary
  page rendered both client components directly with mock props (bypassing
  auth and the server actions entirely — a `"use client"` component takes
  props, so no login was needed), viewed with Playwright at 375×812 and
  1280×900. Confirmed visually: package-size inputs stack one per row on
  the narrow width; "Quy cách"/"Số lượng" sit compactly side by side, no
  longer a stretched full-width number field; the empty state renders;
  the two-column layout activates at the wide width and collapses to one
  column at phone width; the floating "Đã đếm" badge and the live "Đã
  điền đủ" count both render and update. The temporary page, and every
  screenshot taken while checking it, were deleted before this task was
  reported done — nothing in the diff is scaffolding.

  `npx tsc --noEmit`: 0 errors. `npm run build`: succeeds. `npx vitest
  run`: 1038/1038 (+11 from D9's 1027). `check-rules-current.ts`: clean.
  No migration — display only, no schema or business-data change. Not
  deployed.

- **D11** Value purchases at what was actually paid. **Added 2026-08-09.
  Blocks the first count.**

  **The owner found this by refusing a number.** Told the first count would book
  52.773.374đ of purchases, he said: *"Còn số mua vào (52.773.374đ) của em có
  thể tính sai, không thể nào đến mức đó được."* He was right, and the reason
  is worse than my arithmetic:

  | | |
  |---|---|
  | Sum of line subtotals | 52.773.374đ |
  | Shipping | +648.200đ |
  | Voucher | −4.049.790đ |
  | Discount | −221.904đ |
  | **Actually paid** | **49.149.880đ** |

  `buildIssueCostingPurchases` (`app/admin/reports/actions.ts:91`) feeds
  `line.subtotal` into the engine. Shipping, vouchers and discounts live on the
  **order header** and reach no line, so **every unit cost the new engine
  produces is overstated — 3.623.494đ, about 7,4%, across the whole history.**

  Not an edge case: **18 of 63 completed orders carry a voucher**, 19 carry
  shipping, 10 carry a discount.

  **Owner decision 2026-08-09: allocate proportionally by line value** — an item
  worth 20% of the order absorbs 20% of the shipping and 20% of the discount, so
  each item's cost is what was really paid for it.

  **Worked example — `PO-031`, 2026-06-12, deliberately a single-line order so
  the arithmetic is visible:**

  | | |
  |---|---|
  | Bột cà phê MR.PHIN Robusta Dak Mil, 10.000 g | 3.140.000đ |
  | + shipping 57.200 − voucher 722.200 − discount 57.200 | |
  | **Paid** | **2.417.800đ** |

  Engine today: **314 đ/g**. Correct: **241,78 đ/g**. A 23% overstatement on a
  daily-use item.

  **Method — corrected 2026-08-09. The owner proposed the simpler form and he is
  right; my instruction to reuse `allocateOrderDiscount` was the wrong tool.**

  He asked why not compute each line directly against the order total:

  ```
  share(line) = round( adjustment × line_subtotal ÷ sum_of_line_subtotals )
  ```

  Two measurements settle it, both against the shop's real data:

  1. **On all 20 completed orders carrying shipping, voucher or discount, the
     direct form and the running-remainder form produce identical numbers, and
     the direct form reconciles exactly every time** — 0 differences, 0 residues.
     The theoretical advantage I claimed for the running-remainder does not exist
     in this data.
  2. **The adjustment is not always a discount.** One order carries **+40.000đ**
     (shipping with no voucher); the other 19 are negative, largest −722.200đ.
     `allocateOrderDiscount` is built for a *discount*: a positive amount to
     subtract, capped per line so nothing goes below zero. A cost-*increasing*
     adjustment does not fit its shape, and forcing it through would mean
     misusing a function whose guarantees are about something else.

  **So: use the direct form, with one guard.** Sum the rounded shares; if they do
  not equal the adjustment — possible with numbers that do not divide evenly,
  even though none of today's do — put the residue on the **largest line**. That
  keeps `BR-COGS-003` satisfied without inventing an allocator, works for either
  sign, and is the form the owner can check on a calculator, which matters in a
  system where he checks.

  **Do not persist the adjusted figure.** It is derived; compute it where the
  engine reads, so nothing rounded is ever stored.

  **Why it blocks the count:** the first count converts five months of purchases
  into one cost figure. Getting this wrong bakes a 7,4% error into a number that
  cannot be corrected without counting again.

  **Multi-line worked example — `PO-059`, 2026-07-28.** The owner asked for the
  calculation spelled out for the case that actually matters: *"đơn nhập đó có
  nhiều dòng, ghi rõ cụ thể cách tính để anh biết em hiểu anh muốn làm gì."* The
  single-line `PO-031` above hides the only hard part.

  Lines: Robusta Dak Mil 10.000 g / 3.140.000đ · Pha Phin Truyền Thống 500 g /
  183.000đ · Phin Đậm 500 g / 92.000đ. Sum **3.415.000đ**, shipping **+64.400đ**,
  voucher **−610.800đ**, paid **2.868.600đ**.

  Net to spread: 64.400 − 610.800 = **−546.400đ**.

  **Recomputed here with the corrected direct method** (the table below the
  method correction, further down, is the one actually implemented — this
  table's own numbers are unchanged because on this real order the two
  methods agree exactly, 0 residue either way):

  | Line | `round(adjustment × line.subtotal ÷ 3.415.000)` | Share |
  |---|---|---|
  | 1 | round(−546.400 × 3.140.000 ÷ 3.415.000) | **−502.400đ** |
  | 2 | round(−546.400 × 183.000 ÷ 3.415.000) | **−29.280đ** |
  | 3 | round(−546.400 × 92.000 ÷ 3.415.000) | **−14.720đ** |
  | | **Sum, matches the adjustment exactly, no residue guard needed** | **−546.400đ** ✓ |

  | Item | Engine today | Correct |
  |---|---|---|
  | Robusta Dak Mil | 314 đ/g | **263,76 đ/g** |
  | Pha Phin Truyền Thống | 366 đ/g | **307,44 đ/g** |
  | Phin Đậm | 184 đ/g | **154,56 đ/g** |

  Reconciles: 2.637.600 + 153.720 + 77.280 = **2.868.600đ**, exactly what was
  paid. All three are 16% high today.

  **Superseded by the method correction below — kept for the record, not
  because it turned out true.** This paragraph originally argued the
  running-remainder form was necessary because independent rounding would
  land on 546.399đ or 546.401đ "often enough to matter." Measured against
  this order and the other 19 real ones, it never actually happens — the
  direct form reconciles exactly every time in this data. The corrected
  method still keeps a guard for when it doesn't (see below), but the
  specific claim here — that residue accumulates across real orders — was
  not shown, only assumed.

  **Done 2026-08-09 — implemented, corrected same day, verified live.**
  `lib/purchase-order-cost-allocation.ts` implements the corrected direct
  method exactly as decided above. Verified against real production data,
  not fixtures: `PO-031` reproduces 241,78đ/g; `PO-059` reproduces all
  three figures in this section exactly, 0 residue; `PO-056` (the one real
  order among the 20 with a positive adjustment, +40.000đ shipping, no
  voucher) correctly *increases* every line's cost, proving the method
  works for either sign against real data, not an invented case; a direct
  query confirmed all 20 real orders' figures independently (63 completed
  orders, 52.773.374đ raw / 49.149.880đ paid / 18 with a voucher, 19 with
  shipping, 10 with a discount — matches the owner's own numbers exactly).
  A hand-built case (adj=100 across 3 equal lines) proves the residue
  guard itself fires and still reconciles, since no real order today needs
  it. Wired into `buildIssueCostingPurchases`
  (`app/admin/reports/actions.ts`) grouped by order, one allocation call
  per order; the adjusted figure is computed at read time only, never
  persisted. 5 tests in `lib/purchase-order-cost-allocation.test.ts`, 1
  integration test in `app/admin/reports/actions.test.ts` through the real
  `getPnLDataV2`. Re-ran the full suite: **zero existing tests needed
  their expected numbers changed** — none of them had ever set
  `shipping_fee`/`voucher_amount`/`discount_amount` in their fixtures,
  which is exactly how this bug went unnoticed until real data forced it
  into view. `npx tsc --noEmit`: 0 errors. `npm run build`: succeeds. `npx
  vitest run`: 1044/1044 (+6 from D10's 1038). `check-rules-current.ts`:
  clean. No migration — display-only calculation, no schema or business-
  data change. Not deployed.

- **D12** Stop a blank cancelled stocktake from consuming a session number.
  **Added 2026-08-09. The owner rejected my reasoning, and his is better.**

  I had defended the current behaviour by analogy to a cancelled invoice keeping
  its number. He drew the distinction the analogy misses: *"đơn này thì còn có
  thể dùng để đo, nhưng phiếu kiểm kho thì chỉ có thể tính như vậy sau khi đã
  hoàn thành tất cả khâu. Tức có nghĩa đơn đó đã thực sự tồn tại. Còn đây anh
  chưa đếm."*

  A cancelled invoice consumes its number because the transaction happened.
  Opening a count screen and closing it is a blank form thrown away — no line
  counted, no stock touched, no money moved. He also named two consequences I had
  waved off: the table grows without bound under repetition, and anyone who
  notices can inflate it deliberately.

  `open_stocktake_session_atomic` derives the id as
  `max(existing STK-nnn) + 1` (`0052_stock_issues.sql:90-92`), so nothing needs a
  sequence reset — **deleting the row frees the number by itself.**

  - Cancel a session where **at least one line was counted** → keep it,
    `CANCELLED`. Someone really counted and then abandoned it; that is a fact
    worth keeping.
  - Cancel a session where **no line was counted** → **delete the row.** Its
    `stocktake_lines` go with it via the existing `CASCADE` foreign key.

  This is not a breach of "never delete master data" (`CLAUDE.md` section 2) — an
  empty draft is not a business record, and the protected list is ingredients,
  products, recipes, orders and suppliers. Say so in the migration, so nobody
  later reads the delete as a precedent.

  **Note while here, do not fix:** stocktake session ids and `stock_ledger` ids
  both use the `STK-` prefix, each numbered from its own table's maximum. Not a
  collision, but two different things wearing the same name — record it in
  `docs/OPEN-ITEMS.md`.

  **Done 2026-08-09.** `supabase/migrations/0061_cancel_blank_stocktake_session.sql`
  implements exactly the rule above: `cancel_stocktake_session_atomic` now
  checks whether any of the session's lines have `counted_qty is not null`;
  if none do, the session row is deleted (its lines cascade); if at least
  one does, the existing mark-`CANCELLED` behaviour is unchanged. Applying
  this migration was offered and denied once (a real `DELETE`, correctly
  gated even though it targets a blank draft, not a business record) —
  applied on a later explicit go-ahead.

  Verified live in `BEGIN...ROLLBACK`: a session opened and cancelled with
  nothing counted is deleted; a session opened, one line counted, then
  cancelled is kept as `CANCELLED`; cancelling it a second time still
  refuses; and — direct proof the freed number actually gets reused, not
  just vacated — the second session in the same test picked up the exact
  same id the first one had just freed. **A first attempt at this
  verification produced a false alarm** (an apparent real open session,
  `STK-006`, 0 lines, that turned out to be this same test's own
  uncommitted write, visible only from inside its own transaction) —
  resolved by the owner, who re-ran the check from a query untouched by
  any open transaction and found production clean. Lesson applied for the
  rest of this task and going forward: after any `BEGIN...ROLLBACK`
  verification, confirm the real state from a fresh, separate query
  before drawing any conclusion from what was seen inside the
  transaction — D5b already did this; this task skipped it once. Final
  independent check, fresh connection, confirms exactly the five real
  sessions below and nothing else.

  **Real evidence for D4/D8, surfaced by the owner while investigating the
  false alarm above — recorded here, not just in chat:**

  | Session | Status | Lines | Counted |
  |---|---|---|---|
  | `STK-001` (2026-08-07 14:07) | CANCELLED | 89 | 0 |
  | `STK-002` (2026-08-07 14:12) | CANCELLED | 89 | 0 |
  | `STK-003` (2026-08-07 22:12) | CANCELLED | 1 | 1 |
  | `STK-004` (2026-08-08 12:36) | CANCELLED | 89 | 0 |
  | `STK-005` (2026-08-09 01:12) | CANCELLED | 50 | 0 |

  `STK-001`/`STK-002`/`STK-004` at exactly **89 lines** are real,
  independent confirmation of Gap 1's own measurement (39 ingredient +
  50 purchased-item lines) from *live sessions opened before D4 landed*,
  not just the static count taken while writing the plan. `STK-005` at
  exactly **50 lines**, opened after D4's deploy, is the same kind of
  confirmation for the fix: `BASE_INGREDIENT` lines gone, `PURCHASED_ITEM`
  lines only. `STK-003` (1 line, 1 counted) is D5's own live verification
  session from earlier this plan, already reported there.

  `npx tsc --noEmit`: 0 errors (no TypeScript touched). `npm run build`:
  succeeds. `npx vitest run`: unchanged (pure SQL change, no JS/TS
  behavior touched). `check-rules-current.ts`: clean. Migration applied
  live (schema/RPC only; the only real-data effect is on *future* cancel
  calls, and every session that exists today was independently confirmed
  untouched).

- **D8** Re-run the whole of §5 against the finished code, and record what was
  found. The owner expects new cases to surface here: *"Thậm chí trong lúc đó có
  thể sẽ xuất hiện thêm cái lỗi chưa được liệt kê."* Add them to §5 rather than
  fixing them silently.

  **Done 2026-08-08 — see §8b for the full case-by-case table.** The owner's
  own three named concerns all traced to one real bug (S6), found live,
  documented in §5 before being fixed, then fixed and re-verified live
  three separate ways (the original scenario, plus concerns 2 and 3
  specifically). `getPnLDataV2` (K7) proven to report a real, non-zero
  COGS for the first time since Plan C's cutover — both by a permanent
  test and a live RPC-to-engine proof. Two cases that had never been
  tested before (C15, C16) now are. One case's own example went stale
  (C7) and its plan note corrected. `npx tsc --noEmit`: 0 errors. `npm
  run build`: succeeds. `npx vitest run`: 1015/1015. `check-rules-
  current.ts`: clean. Two migrations landed (`0059`, schema/RPC only, no
  business data touched); D6/D7a/D7b/D8's code changes remain undeployed —
  push/deploy is its own separate approval, not requested yet.

---

## 8b. D8 — every case in §5, re-run against the finished code

Per the owner's own standing instruction: every case gets a recorded result, not a silent assumption. `PASS (live)` = re-verified in this pass with a real RPC/`BEGIN...ROLLBACK` proof. `PASS (test)` = covered by an existing automated test, cited. `PASS (by construction)` = no distinct code branch exists for this case, so there is nothing separate to test — the general mechanism already covers it. `GAP` = a real hole, closed in this same pass. `STALE` = the case's own premise no longer holds against today's data.

**Counting**

| # | Result | Evidence |
|---|---|---|
| C1 | PASS (test) | `stocktake-package-lines.test.ts`, single-conversion case |
| C2 | PASS (by construction) | Same label-formatting code path as C1/C3 — a different unit NAME never triggered any special-casing to begin with, so there is no separate branch a dedicated test would exercise |
| C3 | PASS (test) | `stocktake-package-lines.test.ts`, `Dâu sấy` (3) and `Kem whipping Anchor` (2) |
| C4 | PASS (test) | `StocktakeClient.test.ts`, `Number.isInteger` rejection citing `BR-INV-007` |
| C5 | PASS (source-level only) | `handleConfirm`'s blank-skip (`if (raw === undefined \|\| raw.trim() === "") continue`) is real code, but this repo's Vitest config has no jsdom for this file (established convention, checked before D6) — so "blank sums as 0" is confirmed by reading the code, not by a running assertion. Flagged as an honest test-infra limit, not a functional gap |
| C6 | PASS (test + design review) | `StocktakeClient.test.ts` (confirmation clearing, unconfirmed listing); both unstated behaviours (edit clears confirmation, closing with unconfirmed allowed) settled by design review before D3, no flaw found |
| C7 | **STALE** | Đá viên's `is_non_inventory = true`, checked live 2026-08-08 — it is excluded from both the stocktake and issue-slip screens outright, so the scenario this row describes ("shown with theoretical 0") does not currently arise for it. No other item today has an active conversion with zero purchase history. The underlying mechanism (theoretical 0, a positive count triggers C9) is still exercised by C9's own test — only the named example is out of date. Cross-referenced from §10's own note, which is now also stale |
| C8 | PASS (test) | `stocktake-package-lines.test.ts` (inactive conversion dropped from new package lines), `actions.test.ts` (inactive conversion excluded from a real `Dâu sấy` shape) |
| C9 | PASS (pre-existing, `BR-INV-005`) | Unmodified by Plan D; still enforced in `save_stocktake_line_atomic` |
| C10 | PASS (decided) | Superseded by `BR-INV-008`/D5b — see §7 |
| C11 | PASS (pre-existing, `BR-INV-006`) | Unmodified by Plan D |
| C12 | PASS (test) | `actions.test.ts`, non-inventory exclusion (shared now with the issue-slip screen too) |
| C13 | PASS (D1) | `NNL-004` marked `INACTIVE`, verified 2026-08-07 |
| C14 | PASS (by construction) | A session's item list is written once, at open time, into `stocktake_lines` rows — nothing re-derives it later, so a purchased item added afterward has no code path that could pull it in |
| C15 | **PASS (live, new 2026-08-08)** | Never tested before. `BEGIN...ROLLBACK`: opening a second session while one is open throws `A stocktake session is already open (session_id=...)`, naming the real open session |
| C16 | **PASS (live, new 2026-08-08)** | Never tested before. `BEGIN...ROLLBACK`: cancel a session with a saved count, ledger unchanged (`ING-028` still exactly `4.100`), a fresh session opens cleanly afterward |
| C17 | PASS (test) | `actions.test.ts`, kept while on-hand > 0, dropped at 0 |

**Correcting the stock quantity**

| # | Result | Evidence |
|---|---|---|
| S1 | PASS (live) | D5's own verification, real `Dâu sấy` session |
| S2 | PASS (test) | `stocktake-transaction.test.ts`, `skippedIngredients` parses separately |
| S2b | PASS (by construction) | Resolved via C17 — an inactive item with stock keeps its line, so S1 stays reachable |
| S3 | PASS (by construction) | No distinct branch for "counted to 0" — the same variance formula handles it; a dedicated test would exercise identical code to S1's |
| S4 | PASS (live) | D5's verification confirmed the trigger fires and `inventory_balances` updates |
| S5 | PASS (by construction) | The issue and the correction both read `stocktake_lines.counted_qty`/`theoretical_at_count` directly — one query per figure, never two independent computations |
| S6 | **FIXED (D8, live)** | See §5's own S6 entry — the bug D8 was built to find. Confirmed broken, then confirmed fixed, live, twice (manual issue mid-session; reversal then count) |

**Issue slips**

| # | Result | Evidence |
|---|---|---|
| I1 / I2 | PASS (test) | `IssueSlipClient.test.ts`, reason select; `note` carries the distinction |
| I3 | PASS (test) | `IssueSlipClient.test.ts`, package-size picker reusing `buildPackageLines` |
| I4 | PASS (live) | D7a's `BEGIN...ROLLBACK` — refused before write, real shortfall named |
| I5 | PASS (live) | D7a's `BEGIN...ROLLBACK` — refused, real message |
| I6 | PASS (test) | `issue-slip-warnings.test.ts` (4 cases: current month, cross-month, year boundary, future-dated) |
| I7 | PASS (live) | D7b's `BEGIN...ROLLBACK` — create+reverse, double-reversal refused, non-`MANUAL` refused |
| I8 | PASS (live) | D8's own S6 concern-1 scenario is exactly this case (a manual issue and a stocktake-derived issue on the same real day) — correctly ordered and combined, confirmed live |
| I9 | PASS (live) | D7a's `BEGIN...ROLLBACK` — ledger row shape confirmed correct |

**Costing**

| # | Result | Evidence |
|---|---|---|
| K1 | PASS (test) | `lib/issue-costing.test.ts`, original suite, re-run clean |
| K2 | PASS (test) | `computePeriodIssuedValue` tests, original suite |
| K3 | PASS (schema) | `stock_issues` still carries no money column — checked at every migration since |
| K4 | PASS (pre-existing) | `displayMoney`, unmodified |
| K5 | PASS (test, D7a) | Explicit tiebreak added, 2 forced-tie tests |
| K6 | PASS (test, D5b) | 5 tests, `BR-INV-008` |
| K7 | **PASS (D8, new)** | See §5's own K7 entry — `getPnLDataV2` proven non-zero for the first time |

**Net for D8's own pass**: one real bug found and fixed (S6, which is also the root cause behind I8 and K7's need for care), two cases that had genuinely never been tested before and now are (C15, C16), one case whose real-world example went stale (C7), one honest test-infrastructure limit stated rather than hidden (C5). Nothing else broke.

---

## 9. Verification bar

Everything in `CLAUDE.md` section 9, plus:

- **A case that cannot be reached with today's real data still needs a
  live proof, not a fixture — this is how D5b did it, and D8 will need it
  again.** No purchased item has ever had a real issue recorded, so the
  entire `theoretical < counted ≤ total_purchased` range (`BR-INV-008`)
  could not be reached against real production data without first writing
  real consumption history — and writing that permanently would have
  needed its own approval, for a state that only exists to prove a test.
  The technique: build the whole scenario — setup *and* the case under
  test — as real RPC calls (`open_stocktake_session_atomic`,
  `save_stocktake_line_atomic`, `apply_stocktake_session_atomic`, …)
  inside **one SQL transaction, `BEGIN ... ROLLBACK`**
  (`supabase db query --linked --file <script>.sql`, results collected into
  a temporary table and `SELECT`ed before the `ROLLBACK`, since `RAISE
  NOTICE` does not surface through that query path). Real code, real
  tables, real production data — and confirmed independently afterward,
  by reading the actual rows, that nothing persisted. Reach for this
  whenever a case needs a real *prior* state (an existing issue, an
  existing session, a purchased item mid-count) that nothing in
  production has produced yet.
- Every case in §5 has a test, named after its id (C1, S2, I4 …).
- The `Dâu sấy` worked example reproduces **596 đ/g**, **3.100 g**,
  **1.847.600đ**, **596.000đ** — from the real engine, not a fixture, and
  matching §6 exactly.

  > These figures were **wrong here until 2026-08-07**, and the way they were
  > wrong is worth keeping. §6 was rewritten for the sealed-only rule (`e260d44`)
  > and this line was not, so the plan carried a verification bar that
  > contradicted its own worked example — 1.600 g / 953.600đ / 1.490.000đ, the
  > pre-rule scenario where 2.500 g was counted. Anyone coding to §9 would have
  > built to the wrong target and had it confirmed by the checklist. Sonnet found
  > it by dividing the stale figures back out (953.600 ÷ 596 = 1.600) rather than
  > by reading them. **The same number written in two places is the defect; the
  > review is not the fix, it is the last line of defence.**
- Revenue gate unchanged, all four months plus August measured:
  04 2.190.000đ · 05 7.675.000đ · 06 22.157.000đ · 07 18.661.000đ.
- `orders_v2` integrity: rows with `updated_at >= 2026-08-04` and `created_at <
  2026-08-04` = **0**.
- `stock_ledger` holds `PO_RECEIPT` rows plus, once counts begin, the ingredient
  corrections from S4 — nothing else.
- No money column added to `stock_issues` (K3).
- Every balance reconciles against its ledger — the full check, not two named
  ingredients (the lesson from Plan C Task 5).

---

## 10. Out of scope, flagged

- **`Đá viên` in the count list — resolved, not just flagged.** Checked live
  2026-08-08 (D8, C7): `is_non_inventory = true` on its ingredient already
  excludes it from both the stocktake and the issue-slip screen. This note
  was written before D4/D7a existed; it described the old screen, which
  offered every base ingredient with nothing filtering non-inventory items
  out of a purchased-item-keyed list the way today's screens do. Nothing to
  ask — already the state the owner's original decision (`docs/OPEN-ITEMS.md`
  item 8) called for.
- The financial report rebuild (item 31) and the low-stock warning (item 33)
  stay parked.

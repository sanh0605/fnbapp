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

### Costing

| # | Case | Required behaviour |
|---|---|---|
| K1 | A purchase moves the running average; an issue does not | Already proven in `lib/issue-costing.ts`; re-assert after the change |
| K2 | Period cost needs two runs and a subtraction | `computePeriodIssuedValue`, now in `lib/issue-costing.ts` |
| K3 | No money column is ever persisted | `stock_issues` carries quantity only. Must stay that way |
| K4 | Rounding | Display only. `displayMoney` rounds cost **up** (2026-07-30) |
| K5 | **Two events on the same timestamp** | Write an **explicit** tiebreak inside `computeIssueCosting`, with tests that force a purchase/issue tie and an issue/issue tie |
| K6 | **Found stock (`BR-INV-008`) when on-hand is exactly zero** | **Settled and implemented 2026-08-07.** `computeIssueCosting` tracks `lastUnitCost` separately from `value/quantity` (which is `0/0` once the pool is empty), set whenever a real issue computes a rate. A found event (`base_quantity < 0`) values itself at `value/quantity` when `quantity > 0`, or `lastUnitCost` when `quantity === 0` -- either way the weighted average is provably unchanged (`(V + f·A)/(Q + f) = A` when `A = V/Q`). `quantity === 0` also forces `value = 0`, clearing float residue without losing the remembered rate. A found event with no purchase ever recorded (`quantity <= 0 && lastUnitCost === null`) still throws -- no lot ever existed to find. 5 tests in `lib/issue-costing.test.ts`: empty-then-found with the average unchanged, found at a different rate than the lifetime average (proves `lastUnitCost` is read, not recomputed), found while quantity is still positive, found-with-no-purchase throws, and an explicit before/after rate comparison |

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

- **D8** Re-run the whole of §5 against the finished code, and record what was
  found. The owner expects new cases to surface here: *"Thậm chí trong lúc đó có
  thể sẽ xuất hiện thêm cái lỗi chưa được liệt kê."* Add them to §5 rather than
  fixing them silently.

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

- **`Đá viên` is in the count list but was never purchased.** `docs/OPEN-ITEMS.md`
  item 8 records the owner's decision to treat ice, limes and kumquats as daily
  expenses rather than stock. If that still holds, it should not be countable at
  all. Ask before changing — it is master data and a business decision.
- The financial report rebuild (item 31) and the low-stock warning (item 33)
  stay parked.

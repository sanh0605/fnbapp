# Plan H — Audit revenue (OPEN-ITEMS 35)

**Written 2026-08-14 by Opus 5.** Owner chose this over the UI/UX phase after
Plan F closed. Cost was audited line by line in Plan C and found 7,4% wrong
(`BR-COGS-006`); revenue has only ever been proved *stable*, never *correct*.

---

## 1. What is already measured, before any task starts

Run against live data 2026-08-14, all **2.086 `COMPLETED` orders**, total
**57.832.000đ**. These are findings, not tasks — the audit does not need to
redo them, it needs to make them repeatable and to check what they left out.

| Check | Result |
|---|---|
| `net_total == gross_total - promo_discount_total - manual_item_discount_total - manual_order_discount` | **0 mismatches / 2.086** |
| `net_total == sum(order_lines_v2.net_line_total)` | **0 mismatches / 2.085** (one order has no lines, see §3) |
| Any `COMPLETED` order carrying `superseded_by` | **none** — 13 `SUPERSEDED` and 19 `VOIDED` are excluded by status |
| Payments vs revenue, 2026-07-19 onward | **513 orders, 13.603.000đ recorded, 13.603.000đ taken, difference 0đ** |

Monthly, Saigon time: Apr 2.190.000đ (53 orders), May 7.675.000đ (302), Jun
22.157.000đ (793), Jul 18.661.000đ (664), Aug 7.149.000đ (274). June and July
match Plan C's gate figures exactly.

**A correction worth recording:** the first pass of this measurement reported a
2.317.000đ discrepancy between line totals and order totals. That was the
measuring formula subtracting `manual_order_discount` a second time — the order
discount is already inside `net_line_total`. Every order satisfies
`sum(line net) == net_total`; **none** satisfies the other convention except
where the discount is zero and the two coincide. The data was never wrong; the
check was.

---

## 2. What cannot be proved, and the owner's decision about it

`order_payments` begins **2026-07-19**. Before that no independent record of
money received exists inside the system — the feature did not exist. That
leaves **44.229.000đ across April to mid-July with nothing to reconcile
against**.

Asked 2026-08-14 whether external records (bank statements, a cash book) could
close the gap, the owner answered **none exist**.

**So this is closed as permanently unverifiable, not as verified.** The
distinction matters: 44.229.000đ is internally self-consistent at every level
this plan can check, and has never been compared to money that actually
arrived. Any future statement about the shop's first four months rests on that,
and it must not be quietly upgraded to "audited" later.

---

## 3. What is left to check

- **Line-level arithmetic has never been checked.** §1 proves lines sum to the
  order, and the order's header arithmetic is internally consistent — but not
  that a line's own figure is right. Does `net_line_total` equal
  (unit price + modifier prices) x qty, less that line's own discount, for the
  discount type recorded? This is the last unchecked layer, and it is where
  modifiers enter revenue.
- **`promo_discount_total` has never been checked against the promotion that
  produced it.** `applied_promotion_snapshot_json` records the promotion as
  applied; recomputing from it is possible. **OPEN-ITEMS 39 predicts what a
  failure here would look like** — the POS previewed a discount the cart may
  not have charged — so a mismatch is a live lead, not a surprise.
- **One order has revenue but no record of what was sold.** `UCK000269`,
  2026-06-25, by `tuyen2612`, gross 18.000đ, promo 3.000đ, net 15.000đ,
  `BANK_TRANSFER`, **zero lines**. One order in 2.086.

  **The money is explained and verified.** The owner identified it the same
  day this plan was written: one Trà sữa truyền thống under the flat-price
  opening promotion. Checked against the data rather than accepted: `PROD-025`
  has a single variant `VAR-032` (700ml) listed at **18.000đ**; `PRM-003`
  KHAI TRƯƠNG ĐỒNG GIÁ is `FLAT_PRICE`, ran 2026-05-31 to 2026-06-30, and
  covers `VAR-032` at **15.000đ**. The order falls inside that window and
  carries `applied_promotion_id = PRM-003` with a 3.000đ promo discount.
  18.000 - 3.000 = 15.000. Every figure agrees.

  **So this is not a revenue defect. It is a durability defect:** the order
  header survived and its line did not. Revenue is right; the record of what
  was sold is gone. The open question is how a line can go missing while the
  header commits — whether the two writes are in one transaction, and whether
  anything else in that period lost a line without the totals noticing.

  It is master data: **do not delete it** (`CLAUDE.md` section 2).

  **Owner decision 2026-08-14: reconstruct the missing line.** This plan
  originally said not to, on the grounds that a line rebuilt from a
  recollection is a fabricated record. The owner read that and asked for the
  reconstruction anyway. It goes ahead as **H7**, under two conditions that
  answer the original objection rather than ignore it: the row is **marked as
  reconstructed** in a way that survives (a `oln-reconstructed-` id prefix and
  a dated note on the order's `migration_notes`), and **no snapshot is
  invented** — a recipe or modifier snapshot fabricated to look real is the
  part that would actually corrupt the record, and none is needed, since
  nothing reads them for this order.

  **Trigger check done before any write** (`fnbapp-bulk-data-change` step 1),
  run by the owner in the Supabase SQL editor 2026-08-14 with a control:

  - `order_lines_v2`: **no triggers at all.**
  - `orders_v2`: one, `trg_orders_v2_touch`, `BEFORE UPDATE`, sets
    `updated_at` and nothing else.
  - Control (`stock_ledger`) returned `trg_stock_ledger_inventory_balances`,
    so the empty result above is a real absence, not a broken query.

  Nothing recomputes the header from its lines. Inserting the line cannot move
  revenue, and there is no queue table and no downstream automation to feed
  (step 2): the only trigger in scope fires on `UPDATE` of `orders_v2`, which
  H7 does exactly once, for the note, with `updated_at` as the entire effect.

---

## 4. What is unguarded

The `superseded_by` exclusion is **absent from the query and currently
harmless** — `findCompletedOrders` filters on `status = COMPLETED` only, and
edited orders happen to carry `SUPERSEDED` status instead. Revenue is correct
today by coincidence of two independent facts, not by construction. A change to
how an edit marks the old version would double-count revenue silently, and
nothing would fail.

That is the same shape as every real incident this project has had: a check
that cannot fail, a guard on a branch nothing takes, an audit comparing a
frozen zero to a real total.

---

## 5. Tasks

- **H1 — A re-runnable revenue verification script.** Every check in §1, as a
  script that can be run again after any future change, printing the figures
  and exiting non-zero on any mismatch. It must include a **control**: a
  deliberately wrong expectation that proves the script can fail. Without one
  it is not a check.
- **H2 — Line-level arithmetic**, §3 first bullet, across every line of all
  2.086 orders. Report mismatches with order number, expected and actual.
- **H3 — Promotion recomputation**, §3 second bullet. Any mismatch is
  cross-referenced against OPEN-ITEMS 39 before being called new.
- **H4 — `UCK000269` is explained (§3); what is open is how it happened.**
  Check whether the order header and its lines are written in one transaction,
  and whether any other order in that period is missing a line without its
  totals disagreeing — §1's `sum(line net) == net_total` check cannot see a
  lost line when the header total was already reduced with it. No deletion, no
  edit, no reconstructed line.
- **H5 — Close the §4 gap**: make `findCompletedOrders` exclude `superseded_by`
  explicitly, plus a test that fails if a `COMPLETED` row carrying
  `superseded_by` would be counted. Behaviour must not change today — the same
  57.832.000đ before and after, because no such row exists. **That identical
  total is the proof the change is a guard and not a correction.**
- **H6 — Record §2 in `docs/BUSINESS-RULES.md`** as a dated rule: revenue
  before 2026-07-19 has no independent verification and never will. H1's
  script already points readers at this rule, so until H6 lands that pointer
  goes nowhere.
- **H7 — Reconstruct `UCK000269`'s missing line** (§3, owner decision). One
  insert, marked as reconstructed, no invented snapshots. Dry run by default,
  `--apply` to write, exact row printed before writing, owner approves the
  apply (`CLAUDE.md` section 2). **Neutrality proof:** total revenue and every
  monthly figure identical before and after — the change adds a line to an
  order whose header already carried it, so H1 must report the same
  57.832.000đ, and its "orders with zero lines" count must go 1 to 0. That
  count moving, and nothing else moving, is the whole result.

---

## 6. Verification bar

`CLAUDE.md` section 9 in full. Plus:

- Revenue totals **unchanged** by every task in this plan: 57.832.000đ overall,
  June 22.157.000đ, July 18.661.000đ. This plan audits; it does not correct.
  If a task changes a total, it stops and reports rather than proceeding.
- H1's control must be demonstrated failing, then restored.
- Any figure this plan reports must state what it does **not** show.

# Sales and order rules

### BR-SALE-001 — Historical sale economics are pinned

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-COGS-005`

Order lines store the cost used at sale time in `cost_at_sale`. Historical reporting must use the pinned value rather than silently replacing it with a later recipe or purchase-cost replay.

Superseded by `BR-COGS-005` (owner decision 2026-08-04). Plan C Task 4 applied the cutover on 2026-08-07: `order_lines_v2.cost_at_sale` reset to `0` for every row, 2.590 lines. There is no longer a pinned value for this rule to protect.

### BR-SALE-002 — Transaction snapshots preserve write-time inputs

**Status:** `APPROVED`

Orders and lines preserve the relevant price, promotion, recipe, modifier, and cost snapshots required by the reviewed flow. Later catalog edits must not rewrite the meaning of an already completed transaction without an explicit historical-recovery plan.

### BR-SALE-003 — Order lifecycle changes require traceability

**Status:** `APPROVED`

Void, edit, and supersede flows must preserve an explainable event/history path and the associated inventory effect. A UI status change without corresponding transaction evidence is not sufficient.

### BR-SALE-004 — Exact operational eligibility filters are implementation contracts

**Status:** `OBSERVED`

Reports and audits apply status/supersede filters to decide which orders count. Pre-Audit C and later report audits must document those filters per capability before they are promoted into owner-facing policy.

### BR-SALE-005 — Revenue before 2026-07-19 is permanently unverifiable, not verified

**Status:** `APPROVED` — owner decision 2026-08-14 (Plan H §2).

The system records payments in `order_payments`, and **that table begins 2026-07-19**. Before that date no independent record of money received exists: the feature did not exist. Revenue for that period can only ever be checked against itself.

**What was checked, and passed, across all completed orders:** `net_total` equals `gross_total` minus promotions, item discounts and order discount, with zero mismatches; `net_total` equals the sum of its own order lines, with zero mismatches; no counted order is also a superseded version of another. From 2026-07-19 onward, revenue and recorded payments agree exactly — **13.603.000đ on both sides across 513 orders, difference 0đ** at the time of the audit.

**What that leaves.** **44.229.000đ across 1.573 orders, April to mid-July 2026, has nothing to reconcile against.** Asked on 2026-08-14 whether external records — bank statements, a cash book — could close the gap, the owner confirmed **none exist**.

**So the figure is closed as unverifiable, and must never be quietly upgraded to "audited" later.** It is internally consistent at every level that can be tested, and it has never been compared to money that actually arrived. Any statement about the shop's first four months rests on that distinction. A later report that presents the period without the caveat is wrong even if every number in it is unchanged.

**Why this is a rule and not a note.** Cost was audited line by line in Plan C and found 7,4% wrong (`BR-COGS-006`) — an error invisible until someone checked against what was paid. The same class of error in early revenue would be invisible **permanently**, because the thing to check against was never written down. The rule exists so nobody re-derives false confidence from the internal checks passing.

**Verification is re-runnable:** `scripts/verify-revenue.ts` re-checks every structural claim above and prints the unbacked figure on each run. It is the audit, not a record of one.

### BR-SALE-006 — Order code is outlet+date+sequence; brand always follows the outlet, never the reverse

**Status:** `APPROVED` — owner decision 2026-08-25 (Plan, outlets and order code). **Not yet applied** — migrations `0071`/`0072` and the rename script are built and verified but await the owner's separate approval to run against production (`CLAUDE.md` section 2). Recorded here on decision, per `CLAUDE.md` section 6, not on delivery. Until then, existing orders keep their pre-2026-08-25 codes and new orders keep minting under the old brand-keyed scheme.

`order_no` is 12 digits, `YYMMDD` (`Asia/Ho_Chi_Minh`) + 3-digit outlet code + 3-digit sequence — e.g. `260825001001` is 2026-08-25, outlet `001`, first order that outlet-day. The sequence resets per (outlet, date), minted under a Postgres advisory lock keyed the same way. An edited order **keeps its original code across every version** — the rename groups by `order_no`, not by row, and the date/outlet come from the group's earliest row, matching `BR-SALE-002`'s existing snapshot-freeze pattern for `created_at`.

`orders_v2.brand_id` is derived server-side from `orders_v2.outlet_id` at the moment of sale, **never accepted from the client.** The till (`/pos`) opens by picking an outlet, not a brand; a `brandId` present in the URL is ignored by both the page and `submitOrderV2`. `outlet_id` itself is frozen at sale time the same way `created_at` is — an order edit preserves the original outlet, not the editor's own.

This is a **thin slice** of the approved multi-outlet design (ARCH-1): one `brand_id` per outlet, no time-windowed brand slots, no staff-to-outlet assignment, manual outlet picker only. See `docs/04-operations/OPEN-ITEMS.md` item 5.

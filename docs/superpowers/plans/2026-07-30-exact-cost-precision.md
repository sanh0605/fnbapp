# Exact Cost Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop rounding computed cost. Stock deduction and COGS carry full
precision end to end; rounding happens only where a figure is displayed.

**Architecture:** `order_lines_v2.cost_at_sale` stops being a whole-number column
and the `Math.round` calls in the cost engine are removed, so calculation and
storage carry the exact value. Rounding moves to the display layer and follows
the owner's own two-way rule below.

`numeric(18,6)` is the chosen column type — it matches what
`stock_ledger.cost_at_sale` has used since migration 0004, so both sides of the
money path finally agree. **Six decimals is an implementation choice, not a rule
to defend.** The owner explicitly declined to make decimal count a requirement:
what matters is that stored precision is far finer than any figure a decision is
made on. Nobody reads this column directly; they read reports.

**Tech Stack:** TypeScript, Vitest, PostgreSQL (Supabase). Runner is `npx vite-node`.

**Owner decision, 2026-07-30:** exact computation, rounding only at report time.
His reasoning, recorded because it drove the design: rounding error is bounded at
0.5 VND absolutely, but on a cup whose cost is 16 VND that is **3% relative** —
and per-product margin decisions are exactly what these figures are for. At the
shop's current size the aggregate drift is tens of VND; at chain scale the
accumulation of many small roundings starts to move decisions.

Claude initially recommended keeping whole VND and was overruled. The owner's
argument is stronger on two counts the recommendation missed: relative error on
low-cost items, and the fact that `stock_ledger` already stores six decimals, so
this makes the two sides consistent rather than adding something new.

## Global Constraints

- **Run only after the recipe-snapshot repair closes** (`2026-07-30-phase6-recipe-snapshot-repair.md`
  Tasks 5, 6, 7). Do not interleave: both touch the cost path.
- **No writes until Task 4**, and only after the owner approves the dry run.
- Owner-facing output in Vietnamese with real product names. Code and comments English.
- Every data-touching step carries a worked example computed from real values
  (`docs/COLLABORATION.md` C-bis).
- No new dependencies. Lodash is not installed. No emojis.
- Verification bar: `npx tsc --noEmit` clean, full suite green.
- Commit locally with the `Claude-Sonnet ` prefix. Do not push.

---

## Display rounding: two directions, not one (owner rule, confirmed 2026-07-30)

Rounding at the edge is **not** `Math.round`. The owner specified direction by
quantity type, and both directions follow one principle: **never flatter the
business.**

| Kind | Direction | Owner's own example | Function |
|---|---|---|---|
| **Stock quantity** | **DOWN** (floor) | `123.123456213 + 123 + 10.5 = 256.623456213` → displays **256** | `Math.floor` |
| **Cost / money** | **UP** (ceiling) | `100 + 100.1 + 100.2 = 300.3` → displays **301** | `Math.ceil` |

Standard rounding would give 257 and 300 — the opposite of both. Getting this
backwards inverts the whole intent, so treat the two examples above as test
fixtures, not illustrations.

Why each direction: stock rounded down never claims more goods than are really
there; cost rounded up never understates what something cost. Together, reported
profit is always **at or below** true profit, never above.

**Round from the exact value, then sum for display — never sum rounded parts.**
The exact total is what feeds the rounding; each displayed figure is rounded from
its own exact value.

**Consequence the owner accepted explicitly:** displayed parts will not always add
to the displayed total. With costs of 100.1 and 100.2, both display 101, so the
eye sums 202 while the total line correctly shows 301 from an exact 300.3. He
chose this over forcing the columns to tie, because it keeps every per-product
figure honest for pricing decisions. **The report must carry a one-line note
saying so**, or it reads as a bug.

## What is in scope, and what deliberately is not

The rule is not "never round anywhere". It is: **money that is actually paid stays
whole; money that is computed keeps its decimals.**

**IN scope — computed cost, must stop rounding:**

| File:line | What it rounds |
|---|---|
| `lib/mac-cogs.ts:98` | `computeMacCostForConsumptionRows` — the per-line COGS total |
| `lib/mac-cogs.ts:115` | `computeMacCostFromUnitCosts` — same, from a pre-built cost map |
| `lib/order-cogs.ts:98` | `costForRecipe` per line |
| `lib/order-cogs.ts:107` | order COGS total |
| `lib/order-cogs-fifo.ts:57,:66` | the FIFO variant of the same |
| `lib/cogs-drift-audit.ts:241` | the audit's own recomputation |
| `order_lines_v2.cost_at_sale` | column is `bigint` (`0001_init_schema.sql:262`) |

**OUT of scope — genuinely whole VND, leave alone:**

| File | Why it stays |
|---|---|
| `lib/order-cart.ts:392-469` | promotion and manual discounts — money the customer actually pays |
| `lib/order-snapshot.ts:37,50,92` | menu prices — whole VND by definition (18,000 / 15,000 / 27,000) |
| `lib/order-math.ts:50,117,120` | revenue allocation across lines — must sum to the cash taken |
| `lib/purchase-order-write-plan.ts:84` | purchase order subtotals — invoice amounts |

**Display layer — round HERE and only here:**
`app/admin/reports/actions.ts:716,:724` currently round each variant's allocated
COGS before summing. Invert that: sum exact, round once for display. Rounding
each part then adding is what makes a report's parts disagree with its total.

---

### Task 1: Confirm what quantities do (read-only, no commit)

The owner's instruction covers stock deduction as well as cost. Before changing
anything, establish whether quantities are already exact.

- [ ] **Step 1:** Report the declared type of `stock_ledger.quantity_change` and
  `inventory_balances`' quantity column. Confirm from the migrations, not from
  observed values.
- [ ] **Step 2:** Confirm no `Math.round` / `toFixed` sits on a consumption
  quantity anywhere in `lib/inventory-consumption.ts` or
  `lib/full-history-recompute.ts`.
- [ ] **Step 3:** Report in Vietnamese. If quantities already carry decimals
  (the observed balances such as `-2009.5833333333521` and `162.2581` suggest
  they do), say so plainly — then this plan is about cost only, and the owner
  should know his instruction was already satisfied on the quantity side.

---

### Task 2: Widen the column

**Files:** `supabase/migrations/0044_exact_cost_at_sale.sql`,
`lib/exact-cost-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
const sql = readFileSync("supabase/migrations/0044_exact_cost_at_sale.sql", "utf8");

it("widens order_lines_v2.cost_at_sale to six decimals", () => {
  expect(sql).toMatch(/alter table\s+(public\.)?order_lines_v2/i);
  expect(sql).toMatch(/cost_at_sale\s+type\s+numeric\(18,\s*6\)/i);
});

it("matches the precision stock_ledger already uses", () => {
  const s4 = readFileSync("supabase/migrations/0004_add_stock_ledger_columns.sql", "utf8");
  expect(s4).toContain("numeric(18,6)");
});
```

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Write the migration.** `alter table public.order_lines_v2 alter
  column cost_at_sale type numeric(18,6) using cost_at_sale::numeric(18,6);`
  Widening is lossless — every existing whole value survives unchanged.

- [ ] **Step 4: Sweep every RPC that casts this column to `bigint`.**

`::bigint` casts appear in at least `0009_hong_to_luc_migration.sql` (lines 164,
307, 308, 447), `0010_hong_to_luc_idempotency_fix.sql` (150, 308, 309, 448) and
`0031_apply_full_history_recovery.sql` (`v_old_cost bigint`, `v_new_cost bigint`).
**Grep for `bigint` across all migrations and list every hit that touches a cost
value before changing any of them.** A cast left behind truncates silently — the
column would accept decimals while the RPC writing to it throws them away, which
is worse than today because it would be invisible.

Redefine each affected function with `numeric(18,6)`. Do not alter their logic.

- [ ] **Step 5:** `npx supabase db push`, confirm 0044 on both sides of
  `npx supabase migration list`.

- [ ] **Step 6: Commit.**

---

### Task 3: Remove rounding from the cost engine

- [ ] **Step 1: Write the failing test**

Use the owner's own example, which he constructed and Claude verified against the
live engine:

```typescript
it("returns the exact cost, not a rounded one", () => {
  const ledger = [
    { item_reference: "CAFE", transaction_type: "PO_RECEIPT",    quantity_change:  100, unit_cost: 1, created_at: "2026-06-01T03:00:00Z" },
    { item_reference: "CAFE", transaction_type: "SALES_CONSUME", quantity_change:  -10, unit_cost: 0, created_at: "2026-06-02T03:00:00Z" },
    { item_reference: "CAFE", transaction_type: "SALES_CONSUME", quantity_change:  -20, unit_cost: 0, created_at: "2026-06-03T03:00:00Z" },
    { item_reference: "CAFE", transaction_type: "PO_RECEIPT",    quantity_change:  100, unit_cost: 2, created_at: "2026-06-04T03:00:00Z" },
  ];
  const cost = computeMacCostForConsumptionRows(
    [{ item_reference: "CAFE", quantity: 10 }], ledger, "2026-06-05T03:00:00Z");
  expect(cost).toBeCloseTo(15.882353, 5);   // today this returns exactly 16
});
```

**VÍ DỤ ĐÃ TÍNH SẴN** — the running state this must reproduce:

```
01/06 nhap 100g x 1d  -> ton 100g, tien 100d, binh quan 1.000000 d/g
02/06 ban 10g         -> ton  90g, tien  90d, binh quan 1.000000 d/g  (khong doi)
03/06 ban 20g         -> ton  70g, tien  70d, binh quan 1.000000 d/g  (khong doi)
04/06 nhap 100g x 2d  -> ton 170g, tien 270d, binh quan 1.588235 d/g
05/06 ban 10g         -> gia von = 15.882353 d      <- phai ra so nay
```

- [ ] **Step 2: Run it, confirm it fails** (returns 16).

- [ ] **Step 3: Remove the `Math.round`** at the seven in-scope sites listed
  above. Return the raw sum. **Do not touch any out-of-scope site** — the tests
  covering discounts, prices and revenue allocation must stay green untouched. If
  one of them goes red you removed a rounding that was load-bearing; put it back.

- [ ] **Step 4: Full suite green, `tsc` clean.**

- [ ] **Step 5: Commit.**

---

### Task 4: Recompute history at full precision

Existing rows hold values rounded under the old rule. Widening the column does
not un-round them; only a recompute does.

- [ ] **Step 1: Fresh backup**, captured after the snapshot repair closed.

- [ ] **Step 2: Dry run** `scripts/apply-phase5-cost-rebuild.ts` unchanged — it
  recomputes from source every time and now receives unrounded values.

- [ ] **Step 3: Owner summary in Vietnamese**

Expected shape, and say so plainly: **every month should move by well under
100 VND.** This corrects rounding, nothing else. A month moving by thousands
means something other than precision changed — stop and report rather than apply.

- [ ] **Step 4: OWNER GATE.**

- [ ] **Step 5: Apply, then verify** `cost_mismatches: 0` and
  `quantity_items_with_diff: 0`.

- [ ] **Step 6: Commit.**

---

### Task 5: Round at the edge, in the right direction

- [ ] **Step 1: Write the failing tests, using the owner's examples verbatim**

```typescript
it("rounds a displayed stock quantity DOWN", () => {
  expect(displayStock(123.123456213 + 123 + 10.5)).toBe(256);  // not 257
});

it("rounds a displayed cost UP", () => {
  expect(displayMoney(100 + 100.1 + 100.2)).toBe(301);          // not 300
});

it("leaves an exact whole number alone in both directions", () => {
  expect(displayStock(256)).toBe(256);
  expect(displayMoney(300)).toBe(300);
});

it("rounds each figure from its own exact value, not from rounded parts", () => {
  const parts = [100.1, 100.2];
  expect(parts.map(displayMoney)).toEqual([101, 101]);
  expect(displayMoney(parts.reduce((a, b) => a + b, 0))).toBe(301);
  // 101 + 101 = 202 != 301 -- accepted by the owner, must be noted on the report
});
```

Put `displayStock` / `displayMoney` in one shared module so no screen invents its
own rule. Two implementations of this will drift, exactly as two recipe resolvers
did.

- [ ] **Step 2: Run them, confirm they fail.**

- [ ] **Step 3: Implement**, then apply at the render boundary in
  `app/admin/reports/actions.ts`. Remove the per-part rounding at `:716` and
  `:724` — those round each allocated part before summing, which is precisely the
  pattern this task exists to end.

- [ ] **Step 4:** Confirm the P&L still shows whole VND. The owner asked for exact
  storage and calculation, **not** for decimals on screen.

- [ ] **Step 5: Add the reconciliation note to the report UI** — one line, in
  Vietnamese, saying figures are rounded individually so columns may differ from
  the total by a few dong. Without it the first person to add up a column files a
  bug.

- [ ] **Step 6: Commit and update tracking.**

---

## Rollback

Task 2 is a widening, so the column change is reversible only with care — going
back to `bigint` would truncate any decimals written since. Reverse order:
restore the report layer, restore `Math.round`, then re-run the cost rebuild to
write whole values again, and only then narrow the column. The backup from
Task 4 Step 1 is the blunt lever.

## What this plan deliberately does not do

- No change to prices, discounts, revenue allocation, or purchase order totals.
  Those are cash amounts and stay whole VND.
- No change to how the moving average is computed. Only to what is discarded
  afterwards.
- No change to the display format the owner sees. Reports keep showing whole VND.

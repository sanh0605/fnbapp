# Deploy Plan: Exact Cost + MAC Fix (48 commits)

> **For agentic workers:** the owner performs the push. Claude Sonnet 5 runs pre-flight and applies migration 0047; it must not push or promote a deployment.

**Goal:** Get the exact-cost work live safely, in one closed-shop window, with a
rollback the owner can execute himself.

**Why this deploy is different from 2026-07-29's.** That one was 63 commits of
mostly documentation; the code changes did not touch the selling path, and the
plan said so. **This one changes how cost is computed at checkout.** Treat it as
a selling-path deploy, not a routine one.

## What is shipping, by blast radius

| Change | Blast radius | Notes |
|---|---|---|
| `lib/mac-cogs.ts` — exact cost, EDIT_REVERSAL fix | **Checkout** | `app/pos/actions.ts:110` calls it on every sale |
| Migration 0047 — two POS RPCs accept `numeric(18,6)` | **Checkout** | Takes effect the moment it is pushed; no build step in between |
| `lib/order-cart.ts`, `order-cogs.ts` | **Checkout** | Rounding removed from the cost path only |
| `lib/order-edit-cart.ts` | Order editing | Resolves recipes against the original sale time |
| `lib/display-rounding.ts` + reports | Reporting | Stock floors, money ceilings |
| `app/admin/semi-products/actions.ts` | Recipe saving | Writes `start_date` |

Migrations 0043-0046 are **already applied**. Schema is ahead of code, which is
the safe direction. Only 0047 remains.

## Order matters, and the obvious order is wrong

**Migration 0047 goes BEFORE the push.** Claude stated the reverse on 2026-07-31
and it was wrong in the dangerous direction.

`create_pos_order_atomic` receives `cost_at_sale` as a parameter from the app:

| Order | Result |
|---|---|
| Push first | New app sends `3980.42` into a `bigint` parameter → checkout errors or silently truncates |
| **Migration first** | RPC accepts decimals; the still-old app sends whole numbers, which are valid numerics → **both versions work** |

Migration first means there is no window in which the shop cannot sell.

## Timing

After close. No open shift, no order in progress. Not while anyone is selling —
step 2 changes checkout behaviour the instant it lands.

---

### Step 1: Pre-flight (Sonnet, before the window — safe while trading)

- [ ] Migration `0047_pos_atomic_exact_cost.sql`: redefine
  `create_pos_order_atomic` and `create_pos_order_atomic_unvalidated_0024` with
  `cost_at_sale numeric(18,6)`. **Change nothing else in either function.**
- [ ] A checkout test that passes a **fractional** cost (e.g. `3980.4237`) and
  asserts it is stored intact. This is the one behaviour the deploy exists to
  enable; if it is not tested, it is not verified.
- [ ] `npx tsc --noEmit` clean, `npm test` green, `next build` succeeds.
- [ ] `npx supabase migration list` — confirm 0043-0046 match on both sides and
  0047 is the only local-only one.
- [ ] Report. **Then stop.** Do not push 0047 until the owner says the shop is closed.

### Step 2: OWNER — record the rollback point, then back up

- [ ] In Vercel, note the **currently live deployment** (the one to promote back
  to). Write it down now; searching for it later while something is broken is
  how a two-minute rollback becomes twenty.
- [ ] Run `runDailyDriveBackup`. Confirm a fresh file appears.

### Step 3: Migration 0047 (Sonnet)

- [ ] `npx supabase db push`. Confirm 0047 on both sides.
- [ ] **Immediately confirm the shop can still sell** — the old app is still live
  and must keep working against the new RPC. If it cannot, stop here: nothing
  else has changed yet and the RPC widening is the only suspect.

### Step 4: OWNER — push

- [ ] `git push origin main`
- [ ] Watch the Vercel build. **A failed build means nothing went live** — the
  old deployment keeps serving. That is a safe failure: report it, do not retry
  blindly.

### Step 5: OWNER — verify at the POS, in this order

**5.1 — Sell one real order.** It must complete and appear in today's sales.
Nothing below matters if this fails. **Fail → roll back (Step 6).**

**5.2 — The cost now carries decimals.** Look at that order's `cost_at_sale`,
or ask Sonnet to read it. Expect something like `3980.4237`, not `3980`.

- Still a whole number → the new code is not live. The build may have failed or
  served stale. Not dangerous, but the deploy did not achieve its purpose.

**5.3 — The report still shows whole numbers.** Open the P&L. Figures must be
whole VND, with stock rounded **down** and money rounded **up**.

- Report shows decimals → the display layer did not ship. Cosmetic, not
  dangerous; fix forward rather than rolling back.

**5.4 — Edit one old order and save it.** Confirm it saves without a false
error. This exercises the recipe-timing fix.

### Step 6: Rollback

**Primary — Vercel.** Promote the deployment recorded in Step 2. Immediate, no
build. Use for any failure in 5.1.

**Do not roll back migration 0047.** A `numeric` parameter accepts whole numbers,
so the old app works against it unchanged. Reverting to `bigint` while the new
app is live would break checkout — the exact failure this ordering avoids.

**Do not roll back 0043-0046 either.** Same reason: schema ahead of code is safe.

**Orders taken between deploy and rollback are real and stay.** Do not reverse
them.

---

## Stop conditions, collected

| Symptom | Action |
|---|---|
| Pre-flight test of fractional cost fails | Do not proceed. The core change does not work. |
| Shop cannot sell after 0047, before push | Stop. Only the RPC changed; investigate that. |
| Vercel build fails | Nothing is live. Fix and retry; no rollback needed. |
| Cannot complete a sale after push | **Roll back immediately.** |
| Cost still whole after push | Not dangerous. Investigate before selling a full day. |
| Report shows decimals | Cosmetic. Fix forward. |

## What this plan deliberately does not do

- No data rebuild. The cost figures were already recomputed and verified
  (`cost_mismatches: 0`) before this deploy.
- No change to the two POS functions beyond the parameter type.
- No attempt to deploy the display layer separately from the engine. They are
  interdependent: exact storage without display rounding shows decimals to the
  owner, which is the state he explicitly did not want to sit in overnight.

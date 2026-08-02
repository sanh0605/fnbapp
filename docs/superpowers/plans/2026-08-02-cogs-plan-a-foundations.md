# Issue-Based COGS — Plan A: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the data able to support issue-based costing, and make the whole
change reversible, without altering a single reported number.

**Architecture:** Two tasks, neither of which changes behaviour. First a fresh
backup with a verified restore, because Plan C deletes production data and the
drill must be known-good before that, not assumed. Then a recomputation of
`purchase_order_lines.base_quantity`, which is `0` on 95 of 137 lines covering
32.751.182đ — the figure was computed correctly when each receipt was written to
the ledger but never stored back on the line. Issue-based costing reads the
line, so the line has to carry it.

**Tech Stack:** TypeScript, Vitest, `vite-node`, Supabase.

**Spec:** `docs/superpowers/specs/2026-08-02-issue-based-cogs-design.md`

## Before you start: challenge this plan

Standing rule since 2026-07-31. Read the whole plan, report what is wrong,
missing, or unverifiable, and wait — before writing code.

Attack these two first, they are the weakest:

1. **Task 2's neutrality claim.** The plan asserts that writing `base_quantity`
   changes no reported number. `lib/purchase-ledger-rebuild.ts` re-derives
   `PO_RECEIPT` rows from purchase lines. Find out whether anything runs that
   rebuild automatically, on a schedule, or as a side effect of an ordinary
   save. If something does, the claim is false and this task moves stock.
2. **The restore drill's target.** Task 1 restores into a scratch project.
   Confirm `RESTORE_TARGET_*` still points somewhere that is not production,
   and that `assertSafeRestoreTarget` still refuses production, before running
   anything.

## Global Constraints

- Code and comments in English. User-facing strings Vietnamese.
- `npx tsc --noEmit` — 0 errors. Enforced by the pre-commit hook.
- Full suite green before each commit. Baseline 953 tests.
- Any script that writes data is dry-run by default; `--apply` required; exact
  counts and targets printed before writing. (`CLAUDE.md` section 2.)
- **No reported number may change.** Revenue, COGS, stock balances and P&L must
  read identically before and after this plan. This plan prepares data; it does
  not switch anything on.
- Nothing is deleted in Plan A. Deletion is Plan C.
- Do not push.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `docs/audits/2026-08-02-restore-drill.md` (create) | Evidence that a restore of the current backup works | 1 |
| `lib/purchase-line-base-quantity.ts` (create) | Pure: given a line and its conversion, the base quantity | 2 |
| `lib/purchase-line-base-quantity.test.ts` (create) | Tests, including the three real lines verified 2026-08-02 | 2 |
| `scripts/backfill-purchase-base-quantity.ts` (create) | Dry-run/apply, verifying each computed value against the ledger | 2 |

---

### Task 1: A backup that is known to restore

**Files:**
- Create: `docs/audits/2026-08-02-restore-drill.md`

**Interfaces:**
- Consumes: `scripts/restore-backup-to-target.ts`,
  `scripts/verify-restore-drill.ts`, `lib/backup-restore.ts` — all built and
  passed once on 2026-07-29.
- Produces: a dated drill record. No code changes.

The drill passed on 2026-07-29 (`docs/runbooks/restore-from-backup.md`). Since
then production has taken sales, migrations `0048`-`0051` landed, and the schema
changed. **A drill that passed against a different schema is not evidence about
this one.** Plan C deletes ~10.000 ledger rows and ~46.000 recovery rows; the
way back must be tested first.

- [ ] **Step 1: Confirm the restore target is not production**

```bash
node -e "require('dotenv').config({path:'.env.local'});console.log('target:',process.env.RESTORE_TARGET_SUPABASE_URL);console.log('prod  :',process.env.SUPABASE_URL)"
```

Expected: two **different** URLs, and the target is the scratch project. If they
match, or the target is unset, **stop** — `assertSafeRestoreTarget` will refuse
anyway, but do not attempt the run.

- [ ] **Step 2: Take a fresh backup and record its identity**

Use the existing daily backup path. Record the file name, its byte size, the
row count per table, and the timestamp. The point is a specific artefact that
can be named later, not "a backup exists".

- [ ] **Step 3: Restore it into the scratch project**

Run: `npx vite-node scripts/restore-backup-to-target.ts` per
`docs/runbooks/restore-from-backup.md`.

The runbook already records the snags hit last time — IPv6-only direct
connections, the password-bracket copy error, and the `data_recovery_changes`
jsonb-null substitution. Read it before starting rather than rediscovering them.

- [ ] **Step 4: Verify against live production, not against the backup**

Run: `npx vite-node scripts/verify-restore-drill.ts`

Comparing the restore against the file it came from proves only that a copy
copied. Compare against live production, which is what the 2026-07-29 drill did.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Lần thử 29/07 ra 38/40 bảng khớp chính xác. Hai bảng lệch là
  backdated_ledger_events và backdated_recipe_events — do trigger bắn khi
  khôi phục không đúng thứ tự thời gian, không phải mất dữ liệu.
  Lần này con số phải TƯƠNG ĐƯƠNG. Nếu số bảng khớp THẤP hơn 38, hoặc lệch ở
  bảng khác hai bảng trên -> DỪNG, đừng đi tiếp sang Task 2.
```

- [ ] **Step 5: Spot-check content, not just row counts**

Row counts agreeing while content differs is the failure this step exists to
catch. Confirm at least: one purchase order header with all its lines
byte-identical, one split-payment order's payments, and the `stock_ledger` row
count for one named ingredient.

- [ ] **Step 6: Write the drill record and commit**

Create `docs/audits/2026-08-02-restore-drill.md` stating the backup artefact's
name and size, the table-by-table comparison, the spot-checks, and the verdict.
If the verdict is anything other than PASS, say so and stop — Plan C is blocked
until it passes.

```bash
git add docs/audits/2026-08-02-restore-drill.md
git commit -m "Claude-Sonnet docs: restore drill re-run against the current schema

The 2026-07-29 drill passed against a schema that has since changed --
migrations 0048-0051 landed and production kept trading. Plan C deletes
roughly 10,000 ledger rows and 46,000 recovery rows, so the way back is
re-tested before that rather than assumed to still hold.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Store the base quantity the ledger already knows

**Files:**
- Create: `lib/purchase-line-base-quantity.ts`
- Create: `lib/purchase-line-base-quantity.test.ts`
- Create: `scripts/backfill-purchase-base-quantity.ts`

**Interfaces:**
- Consumes: `resolveConversion` logic in `lib/purchase-ledger-audit.ts:193` —
  read it and reuse its resolution rules rather than inventing a second set.
- Produces: `computeBaseQuantity(line, conversion): number`, used by the script.
  No caller outside this plan.

**Why this is safe, and how you will know.** The conversion was applied
correctly when each `PO_RECEIPT` row was written; only the write-back to the
line was skipped. So the recomputed value has an independent witness already
sitting in the ledger, and the script must check every row against it rather
than trusting the arithmetic.

```
VÍ DỤ ĐÃ TÍNH SẴN, ba dòng thật, kiểm 2026-08-02:

  Bột cà phê MR.PHIN Robusta Dak Mil
    dòng nhập : quantity=1  unit=U-008   base_quantity=0   149.000đ
    quy đổi   : 1 U-008 = 500 UNT-017
    tính ra   : 1 × 500 = 500
    sổ kho    : 500          <- khớp

  Bột cà phê truyền thống Phin Đậm     1 × 500  = 500   sổ kho 500   khớp
  Đường trắng                          1 × 1000 = 1000  sổ kho 1000  khớp

Nếu một dòng nào tính ra KHÁC số trong sổ kho -> DỪNG. Nghĩa là giả định
"quy đổi đã đúng lúc ghi sổ" sai, và cả kế hoạch này phải viết lại.
```

- [ ] **Step 1: Write the failing test**

Create `lib/purchase-line-base-quantity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBaseQuantity } from "@/lib/purchase-line-base-quantity";

describe("computeBaseQuantity", () => {
  // The three real lines verified against the ledger on 2026-08-02.
  it("multiplies the purchase quantity by the conversion rate", () => {
    expect(computeBaseQuantity({ quantity: 1 }, { conversion_rate: 500 })).toBe(500);
    expect(computeBaseQuantity({ quantity: 1 }, { conversion_rate: 1000 })).toBe(1000);
    expect(computeBaseQuantity({ quantity: 3 }, { conversion_rate: 500 })).toBe(1500);
  });

  it("accepts the string forms the database returns", () => {
    expect(computeBaseQuantity({ quantity: "2" }, { conversion_rate: "500" })).toBe(1000);
  });

  // A missing or zero rate must not silently produce 0, which would look like
  // a successful backfill while destroying the quantity.
  it("throws rather than returning zero when the rate is unusable", () => {
    expect(() => computeBaseQuantity({ quantity: 1 }, { conversion_rate: 0 }))
      .toThrow(/conversion rate/i);
    expect(() => computeBaseQuantity({ quantity: 1 }, {}))
      .toThrow(/conversion rate/i);
  });

  it("throws when the purchase quantity is missing", () => {
    expect(() => computeBaseQuantity({}, { conversion_rate: 500 }))
      .toThrow(/quantity/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/purchase-line-base-quantity.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the module**

```ts
/**
 * The base-unit quantity a purchase line represents.
 *
 * This value was computed correctly when each PO_RECEIPT row was written to
 * the stock ledger, but never stored back on the line -- 95 of 137 lines
 * carry 0. Issue-based costing reads the line, so the line must carry it.
 *
 * Throws rather than returning 0 on unusable input: a silent 0 is
 * indistinguishable from the bug being fixed.
 */
export type PurchaseLineQuantity = { quantity?: string | number };
export type ConversionRate = { conversion_rate?: string | number };

export function computeBaseQuantity(
  line: PurchaseLineQuantity,
  conversion: ConversionRate,
): number {
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Purchase line has no usable quantity: ${line.quantity}`);
  }
  const rate = Number(conversion.conversion_rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Unusable conversion rate: ${conversion.conversion_rate}`);
  }
  return quantity * rate;
}
```

- [ ] **Step 4: Run the tests and the suite**

Run: `npx vitest run lib/purchase-line-base-quantity.test.ts && npx vitest run && npx tsc --noEmit`
Expected: 5 new tests pass, 958 total, 0 type errors.

**Two findings from the challenge round, both verified, both binding.**

**Write the column directly. Never through `savePurchaseOrderAtomic`.** Migration
`0006` has that RPC `delete from public.stock_ledger ... where transaction_type
= 'PO_RECEIPT'` and re-insert. Routing the backfill through the ordinary save
path would replace every receipt row of every touched order with new ids —
identical amounts, different rows — which is a change, and this task claims to
make none. Raised by the implementer during the challenge; confirmed in the
migration.

**The source of the zeros is still in the code, and this task does not close
it.** `lib/purchase-order-write-plan.ts:92-94` computes
`quantity * (Number(draftConversion?.conversion_rate) || 0)`. When a conversion
fails to resolve it multiplies by zero rather than refusing, which is exactly
how a purchase line ends up recording money with no quantity.

Measured 2026-08-02: 94 of the 95 zero lines were created in June, one on
2026-07-01 (Trứng gà, 60 units, 132.000đ, conversion `QD-052` present, not a
non-inventory item — so a real instance, not a legitimate exception). All 42
July lines carry correct values. The writer therefore appears to have been fixed
around the June-July boundary, but **the `|| 0` fallback survives**, so a
resolution failure would silently produce a 96th zero.

Closing that hole means making a save fail where it currently succeeds quietly —
a behaviour change, which Plan A forbids. It is recorded here and as an open
item so that fixing 95 rows is not mistaken for fixing the cause.

- [ ] **Step 5: Write the backfill script**

Create `scripts/backfill-purchase-base-quantity.ts`. Dry-run by default,
`--apply` to write. It must, in this order:

0. Write with a direct `update` on `purchase_order_lines`. Do not call
   `savePurchaseOrderAtomic` or anything that reaches it.
1. Load every `purchase_order_lines` row with `base_quantity` falsy, plus
   `uom_conversions` and `purchased_items`.
2. Resolve each line's conversion using the same rules as
   `lib/purchase-ledger-audit.ts:193` — read that function and reuse its
   resolution, do not write a second one.
3. Compute the value with `computeBaseQuantity`.
4. **Verify against the ledger.** For each line, find the `PO_RECEIPT` rows for
   that purchase order and item, and compare. Report matches and mismatches
   separately.
5. Abort without writing if **any** mismatch exists, printing all of them.
6. Print the count to be written and the first ten targets before writing.
7. After `--apply`, re-read and report how many lines still carry 0.

Expected dry-run figures, measured 2026-08-02:

```
Lines with base_quantity = 0 : 95
Money on those lines          : 32.751.182đ
Distinct purchased items      : 44
Lines with a conversion_id    : 95   (all of them)
Ledger mismatches             : 0
```

```
VÍ DỤ ĐÃ TÍNH SẴN:
  Nếu "Lines with base_quantity = 0" khác 95 -> dữ liệu đã đổi kể từ lúc đo,
  đọc lại trước khi chạy. Nếu "Ledger mismatches" khác 0 -> DỪNG, không
  --apply. Một dòng lệch nghĩa là giả định nền của kế hoạch này sai.
```

- [ ] **Step 6: Dry run, and read the output rather than skimming it**

Run: `npx vite-node scripts/backfill-purchase-base-quantity.ts`

Report the four figures to the coordinator before applying. Do not apply on
your own judgement — this writes to production.

- [ ] **Step 7: Apply, after the coordinator confirms**

Run: `npx vite-node scripts/backfill-purchase-base-quantity.ts --apply`
Expected: 95 rows written, 0 lines still carrying 0.

- [ ] **Step 8: Prove nothing moved**

The whole claim of this plan is that no reported number changes. Verify it
rather than asserting it:

```bash
npx vite-node scripts/audit-full-history-recompute.ts
npx vite-node scripts/audit-pnl-mac-consistency.ts
npx vite-node scripts/audit-current-stock.ts
```

Expected: identical to the pre-run readings. Capture both readings in the commit
message. **Any movement is a defect, not a new baseline** — stop and report.

- [ ] **Step 9: Commit**

```bash
git add lib/purchase-line-base-quantity.ts lib/purchase-line-base-quantity.test.ts \
        scripts/backfill-purchase-base-quantity.ts
git commit -m "Claude-Sonnet fix: store the base quantity each purchase line already implied

95 of 137 purchase lines carried base_quantity = 0, covering 32,751,182 VND.
The conversion was applied correctly when each PO_RECEIPT row was written to
the ledger; only the write-back to the line was skipped. Issue-based costing
reads the line, so the line has to carry it.

Every computed value was checked against the PO_RECEIPT row it should match
before anything was written, and the script refuses to apply on a single
mismatch. Stock, COGS and P&L audits read identically before and after --
figures in the body.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verification bar

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — green, 958 tests (953 + 5).
- Restore drill verdict PASS, recorded with table-level and content-level
  evidence.
- 0 purchase lines with `base_quantity` falsy.
- 0 ledger mismatches during the backfill.
- Stock, COGS drift and P&L/MAC audits identical before and after.
- Nothing deleted.
- No push.

## Out of scope

- Any change to how COGS is computed — Plan B.
- Any deletion — Plan C.
- Moving stock to the purchased-item level — Plan B.
- Rewriting `CLAUDE.md` section 7 — Plan C, once the behaviour actually changes.

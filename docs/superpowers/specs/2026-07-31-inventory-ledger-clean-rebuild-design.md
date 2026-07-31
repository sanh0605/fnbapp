# Inventory Ledger Clean Rebuild — Design Spec

Date: 2026-07-31
Author: Claude coordinator (Opus 5), design only — implementation ownership unresolved, see section 9.
Status: **awaiting owner review**. Nothing here is authorized to run.

Supersedes nothing. Extends the REBUILD-1 engine (`lib/full-history-recompute.ts`,
closed 2026-07-22) rather than replacing it.

---

## Tóm tắt cho chủ quán

Tồn kho sai vì một lý do duy nhất, và đã tìm ra tận nơi.

Hồi tháng 6 có hai đợt chạy script để kéo tồn bán thành phẩm từ số âm về 0 —
tổng cộng **13 dòng, bơm vào 102.200 đơn vị**. Sau đó công cụ tính lại toàn bộ
lịch sử được viết ra, và nó **cố tình không tin** mọi dữ liệu trừ tồn cũ, dựng
lại tất cả từ đơn nhập + đơn bán + công thức. Đúng như anh muốn.

Nhưng nó có một ngoại lệ: nó tin tuyệt đối các dòng mang nhãn **"điều chỉnh tồn
kho"**, vì code giả định nhãn đó nghĩa là "kết quả kiểm kê thực tế của con
người". Quán mình chưa từng kiểm kê lần nào — bảng kiểm kê có 0 dòng. Nên 13
dòng rác của tháng 6 lọt qua ngoại lệ đó, lần chạy lại nào cũng được cộng thêm
vào kết quả sạch.

Đó là lý do sửa 3 lần vẫn quay lại chỗ cũ: **mỗi lần sửa đều dựng lại đúng, rồi
cộng rác vào cuối.**

Cách xử lý dứt điểm gồm ba phần:

1. Xoá 13 dòng đó và dựng lại toàn bộ tồn kho, giá vốn từ 3 nguồn gốc.
2. Sửa chỗ định nghĩa "cái gì được tin": không tin theo **cái nhãn** nữa, mà tin
   theo **nguồn gốc** — phải có một phiếu kiểm kê thật, do anh đích thân tạo và
   duyệt trên màn hình, mới được ghi đè.
3. Khoá lại bằng ràng buộc trong cơ sở dữ liệu, để **không script nào ghi được
   dòng điều chỉnh tồn kho nữa** — kể cả script chạy bằng quyền cao nhất.

Phần 3 là phần trả lời câu "làm sao để không phải làm lại lần thứ tư". Hai lần
trước chỉ sửa số. Lần này sửa cả cái cho phép sai số xảy ra.

Một điều anh cần biết trước: sau khi dựng lại, **tồn nguyên liệu thô sẽ giảm
xuống**, và có thể có món xuống âm. Đó không phải lỗi mới — đó là phần đáng lẽ
đã bị trừ nhưng bị bỏ qua vì hệ thống tưởng còn bán thành phẩm sẵn. Nếu có món
âm, cách xử lý **bắt buộc** là tìm đơn nhập còn thiếu và nhập vào, rồi chạy lại.
Tuyệt đối không bơm số cho hết âm — đó chính xác là việc đã tạo ra mớ này.

---

## 1. Root cause

### 1.1 The one line

`lib/full-history-recompute.ts:130`

```ts
const TRUSTED_PRIMITIVE_TYPES = new Set(["STOCK_ADJUST"]);
```

The engine's own header comment (lines 20-34) states the correct rule and the
exact failure mode it must avoid:

> "...never trusts `SALES_CONSUME`-family rows OR `PRODUCTION_CONSUME`/
> `PRODUCTION_YIELD` — ... every historical row of those types either came from
> implicit production for a specific sale (which this engine reconstructs
> itself) **or from an earlier correction pass's own compensating entries** —
> trusting them as well as re-deriving them double-counts the same event."

The 13 surviving rows are precisely "an earlier correction pass's own
compensating entries". They evade the rule because they carry the label
`STOCK_ADJUST` rather than `PRODUCTION_YIELD`.

`scripts/apply-full-history-stock-ledger-rebuild.ts:18` states the same
exemption from the write side: *"PO_RECEIPT/STOCK_ADJUST rows: never touched."*

**The engine trusts a label. It should trust a provenance.**

### 1.2 The 13 rows

Verified against production 2026-07-31 (read-only):

| Batch | `reference_id` | Rows | Units injected |
|---|---|---|---|
| 2026-06-25 | `NEGATIVE-STOCK-AUDIT-2026-06-25T07:31:08.402Z` | 8 | +99,410 |
| 2026-06-27 | `PHASE9-NEGATIVE-STOCK-2026-06-26` | 5 | +2,790 |
| | **Total** | **13** | **+102,200** |

All 13 share three properties that mark them as non-primitive:

- `unit_cost = 0` — no cost basis, so they also drag semi-product MAC toward zero.
- No matching row in `stock_adjustments` (**that table has 0 rows, all time**).
- No matching row in `stocktake_sessions` (**0 rows, all time**).

There has never been a physical count in this system. The category the engine
treats as "unconditional primitive fact" is populated 13-for-13 by script
artifacts.

Likely writers, for the record: `lib/history-ops/negative-stock-resolution.ts`
(June 25 batch) and `scripts/fix-phase9-negative-stock-type.ts` (June 27 batch).
Confirm before deletion; do not assume from filename alone.

### 1.3 Worked example — the whole failure in nine rows

`BTP-007` Kem dẻo CT3, complete ledger, chronological:

```
2026-04-21T01:00:00  SALES_CONSUME       -40   ->    -40
2026-04-21T01:00:00  PRODUCTION_YIELD    +40   ->      0
2026-04-21T02:09:00  SALES_CONSUME       -40   ->    -40
2026-04-21T02:09:00  PRODUCTION_YIELD    +40   ->      0
2026-04-21T02:21:33  SALES_CONSUME       -40   ->    -40
2026-04-21T02:21:33  PRODUCTION_YIELD    +40   ->      0
2026-04-22T07:57:34  SALES_CONSUME       -40   ->    -40
2026-04-22T07:57:34  PRODUCTION_YIELD    +40   ->      0
2026-06-25T07:31:08  STOCK_ADJUST       +160   ->    160   <- NEGATIVE-STOCK-AUDIT
```

Implicit production covers every sale exactly; the balance returns to zero four
times. The June injection of +160 is exactly 4 x 40 — it re-covers the same four
sales a second time, and has sat as phantom stock ever since.

**This also settles a question the owner raised:** the implicit-production
mechanism itself is not the source of the errors. It nets to zero correctly.
The errors came from correction passes layered on top of it and never removed.
No change to `lib/inventory-consumption.ts` is proposed.

### 1.4 Second-order damage

Of the 102,200 units injected, **46,170 remain as balance**; the difference,
approximately **56,030 units, was consumed by later sales**.

Every such sale saw a non-zero semi-product balance, so
`allocateRecipeConsumption` took the `semiQty` branch (line 95-102) and **never
computed a shortfall** — meaning **no raw ingredients were deducted for those
sales at all**.

Consequences to expect from the rebuild, both correct:

- Raw-ingredient balances **fall**, because those sales now trigger implicit
  production and debit raw stock properly.
- `cost_at_sale` changes on affected order lines, because cost now derives from
  raw-ingredient MAC instead of a semi-product MAC diluted by zero-cost
  injections.

---

## 2. Owner decisions recorded (2026-07-31)

| # | Decision | Consequence for this design |
|---|---|---|
| D1 | Physical count is absolute truth | A stocktake result **may** override the derived balance. Trust model stays "cách 1". |
| D2 | ...but only when the owner personally counts and adjusts **through the system UI**. No script may ever write an adjustment. | Trust is keyed on provenance, not on transaction type. Enforced structurally (section 4). |
| D3 | No historical stock-deduction data is trusted. All deleted and rebuilt. | `TRUSTED_PRIMITIVE_TYPES` becomes empty for this run; all 13 rows deleted, not migrated. |
| D4 | Semi-product inventory tracking is **kept** (decided earlier same day) | No model change. BTP balances will simply be 0 until real production orders or a real stocktake exist. |
| D5 | This must never need doing a fourth time | Section 4 is a required part of the work, not a follow-up. |

---

## 3. Target state

### 3.1 Trust model after this change

Exactly three sources are primitive:

1. **Purchase orders** — `purchase_orders` + `purchase_order_lines`, re-derived
   into `PO_RECEIPT` by `lib/purchase-ledger-rebuild.ts` (unchanged).
2. **Sales orders** — `orders_v2` + `order_lines_v2` with each line's own
   recipe snapshot, replayed chronologically (unchanged).
3. **Recipes** — effective-at-order-time selection via
   `lib/recipe-selection.ts` (unchanged).

Plus one conditional primitive:

4. **Owner-approved stocktake adjustments** — a `stock_ledger` row of type
   `STOCK_ADJUST` is trusted **if and only if** it links to a
   `stock_adjustments` row that is `status = 'APPROVED'` with a non-null
   `created_by_id`. Today: zero such rows exist, so this set is empty for the
   first rebuild.

Everything else — `SALES_CONSUME`, `EDIT_CONSUME`, `EDIT_REVERSAL`,
`PRODUCTION_CONSUME`, `PRODUCTION_YIELD`, and any unlinked `STOCK_ADJUST` — is
derived output, regenerated from scratch, never an input.

### 3.2 Predicted end state — the acceptance criterion

This is the number to check the rebuild against **before** accepting it.

**All 14 semi-products must end at balance exactly 0.000.**

The reasoning is forced, not estimated: after the rebuild, the only writer of
`PRODUCTION_YIELD` is implicit production, which yields exactly the shortfall
quantity that the same sale immediately consumes (`lib/inventory-consumption.ts`
lines 138 and 297-306). `production_orders` has 0 rows, so no independent
production exists. No trusted `STOCK_ADJUST` remains. Therefore every semi-product
balance nets to zero.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu sau khi chạy:
  BTP-007 Kem dẻo CT3
  hiện tại        : 160
  phải ra sau khi sửa: 0.000
  vì 4 lần bán -40 được bù đúng 4 lần +40, và dòng +160 ngày 25/06 bị xoá

  BTP-008 Hồng trà
  hiện tại        : 24.570
  phải ra sau khi sửa: 0.000
  (38.780 đơn vị điều chỉnh bị xoá; phần chênh còn lại do nấu ngầm tự cân bằng)

Nếu bất kỳ bán thành phẩm nào khác 0 sau khi chạy, DỪNG — không chạy tiếp,
không "sửa nốt cho tròn". Một số khác 0 nghĩa là còn một nguồn ghi chưa biết.
```

Raw-ingredient balances have no predicted value — they are the output being
computed. They must be captured as a before/after table for the owner.

### 3.3 Negative raw stock is a signal, not a defect to patch

If a raw ingredient ends negative, the meaning is defined in advance and the
response is fixed:

| Meaning | Correct response |
|---|---|
| A purchase order was never entered | Enter the missing purchase order, re-run the rebuild |
| A recipe is wrong or has wrong effective dates | Fix the recipe, re-run the rebuild |
| The item is genuinely consumed but not purchased (e.g. owner's personal supply, like `ING-014` Muối hồng) | Mark `is_non_inventory`, re-run |

**Never** an adjustment row. This rule is the entire content of D5: the previous
three rounds all chose "inject quantity until the negative disappears", and each
time the injection became indistinguishable from truth.

---

## 4. The structural guarantee (D5)

A policy that says "don't write adjustments from scripts" is worth nothing —
the last three rounds were all performed by agents following instructions. The
guarantee must be enforced by the database, which service-role scripts also obey.

### 4.1 Current hole

`supabase/migrations/0001_init_schema.sql:288-302` defines `stock_ledger` with:

```sql
reference_id text default ''
```

Plain text, no foreign key. `0019_atomic_stock_adjustments.sql:152` shows the
intended convention (`where reference_id = p_adjustment_id`) but nothing enforces
it. Any client holding the service key can insert
`transaction_type = 'STOCK_ADJUST'` with `reference_id = 'ANYTHING-I-LIKE'`.
That is exactly what happened twice in June.

### 4.2 Proposed constraint

New migration (next free number, `0048`):

1. Add `stock_adjustment_id text references public.stock_adjustments(id)`,
   nullable.
2. Backfill: nothing to backfill — the 13 existing rows are deleted by this
   work, and no legitimate rows exist.
3. Add constraint:

```sql
alter table public.stock_ledger
  add constraint stock_ledger_adjust_requires_approved_source
  check (transaction_type <> 'STOCK_ADJUST' or stock_adjustment_id is not null);
```

4. Update `submit_stock_adjustment_atomic` / `approve_stock_adjustment_atomic`
   (migration `0019`) to populate `stock_adjustment_id`.

Effect: an adjustment row cannot exist without a real, user-attributed
`stock_adjustments` parent. A script wanting to forge one must also insert a
`stock_adjustments` row carrying a `created_by_id` — which is visible, auditable,
and appears in the admin UI rather than being invisible ledger noise.

**Honest limit of this guarantee.** A service-role script can still insert both
rows. The constraint makes forgery *visible and attributable* rather than
*impossible*. Full impossibility would require revoking service-role write access
to `stock_ledger` entirely and routing every write through RPCs — a larger change
that should be considered separately, not folded in here.

### 4.3 Provenance-keyed trust in the engine

`lib/full-history-recompute.ts` changes from type-keyed to provenance-keyed:

- Remove the `TRUSTED_PRIMITIVE_TYPES` set.
- Trust a `STOCK_ADJUST` row only when its `stock_adjustment_id` resolves to a
  `stock_adjustments` row with `status = 'APPROVED'` and non-null
  `created_by_id`.
- Every other row type stays untrusted exactly as today.

### 4.4 A verification that cannot pass while wrong

`DEVELOPMENT-TRACKING.md` (2026-07-31 entry) records that
`scripts/audit-full-history-recompute.ts:156` computed "is anything negative"
from the mismatched-items list only, so a balance the system agreed with itself
about could never be reported. That is why every audit read clean while the
screen showed a negative number.

The verification for this work must therefore assert against **absolute
expected values**, not against agreement between two computations of the same
thing:

- Every semi-product balance equals exactly 0.000 (section 3.2).
- Count of `stock_ledger` rows with `transaction_type = 'STOCK_ADJUST'` equals
  the count of `APPROVED` `stock_adjustments` rows. Today both are 0.
- Replaying the rebuild twice produces byte-identical output (idempotence).
  This is the property that proves no residue is accumulating; it is the direct
  test of "will this be needed a fourth time".

---

## 5. Scope

**In scope:** the 13-row deletion, the full-history rebuild, `cost_at_sale`
recomputation that follows from it, the `0048` constraint, the engine trust
change, and the verification script.

**Explicitly out of scope** (each is a separate problem already on the owner's
list, and mixing them repeats the mistake this document exists to fix):

- Operating-expense and financial-report work (problem D).
- Semi-product production/disposal process adoption (problem E).
- Repository restructuring (problem C).
- Documentation and rule consolidation (problem B).
- The `OPEN-ITEMS.md` late-entered-recipe and stale-detection-row items.

---

## 6. Hard dependency: backup first

A full-history rebuild adds approximately **14 MB** to the daily backup bundle.
The bundle is currently **39.6 MB** against a **50 MB** Apps Script limit —
**10.4 MB of headroom**. Migration `0045`'s 30-day retention deletes nothing
until approximately 2026-08-23.

**Running this work before problem A is resolved breaks the daily backup at the
exact moment the data is being rewritten.** Problem A
(`docs/superpowers/plans/2026-07-31-split-recovery-log-from-backup.md`) is a
blocking prerequisite, already agreed by the owner.

Additionally, a verified restore-capable snapshot must exist **before** the
delete step, not merely a successful backup run. `DEVELOPMENT-TRACKING.md`
records that the Phase 3 restore drill verified repo code and never the deployed
pipeline, which is how `order_payments` sat unbacked for weeks.

---

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Raw-ingredient balances go negative after rebuild | **High** — expected for at least some items | Pre-agreed response in 3.3. Present the list to the owner; do not act unilaterally. |
| `cost_at_sale` changes alter historical P&L the owner has already seen | **Certain** | Produce a before/after monthly margin table for owner review before the apply step. |
| A semi-product ends non-zero | Low | Section 3.2 says stop. Do not proceed to cost recomputation. |
| Delete step removes a legitimate row | Very low | Zero `APPROVED` adjustments exist; verify count is still 0 immediately before deleting. |
| Backup breaks mid-rebuild | Medium if section 6 ignored | Section 6 is a gate, not advice. |
| `EDIT_REVERSAL` rows (72 total) regenerate inconsistently | Unknown | Not asserted as safe. Must be measured in the dry run before apply. |

---

## 8. Verification bar

Per `docs/COLLABORATION.md` section E, plus the additions in 4.4:

- `npx tsc --noEmit` — 0 errors.
- Full test suite green (744+ baseline; `COLLABORATION.md` and `AGENTS.md` both
  still say 191+ — stale, see problem B).
- MAC drift audit: 0 mismatch.
- COGS drift audit: 0 mismatch or documented as informational.
- P&L MAC consistency audit: 0 delta.
- All 14 semi-product balances exactly 0.000.
- Rebuild is idempotent: second run produces identical output.
- Every script runs read-only by default; `--apply` required for writes
  (`COLLABORATION.md` section D rule 1).

---

## 9. Unresolved — needs an owner decision

`docs/COLLABORATION.md` section C assigns `lib/full-history-recompute.ts`,
`lib/mac-cogs.ts`, `lib/inventory-consumption.ts`, `supabase/migrations/**` and
all of `scripts/**` to Codex, and requires independent review for historical
reprocessing and `--apply` production writes. The same section states an agent
must never implement and approve the same change.

Codex has been unavailable since 2026-07-27. The standing exception recorded in
`docs/ROADMAP.md` lets Claude Sonnet 5 cover those paths with self-review — but
that exception was written for routine day-to-day work.

This is not routine work. It deletes and regenerates the inventory and cost
history behind 2,604 order lines, and it is the fourth attempt at the same
correction. It is the exact category the no-self-review rule was written for.

**Options for the owner:**

| | Approach | Trade-off |
|---|---|---|
| 1 | Wait for Codex to implement, coordinator reviews | Correct per protocol; unknown wait, and the problem is live now |
| 2 | Sonnet 5 implements, coordinator (Opus 5) reviews line by line | No self-review; both are Claude models, so shared blind spots are possible |
| 3 | Sonnet 5 implements and self-reviews, per the standing exception | Fastest; removes the safeguard on the highest-risk change in the project |

Coordinator recommendation: **option 2**. It preserves a real second pair of
eyes, and the verification in 4.4 asserts absolute values rather than
self-agreement, which limits the damage a shared blind spot could do.

---

## 10. Review gate

Owner review requested on:

1. The trust model in 3.1 — specifically that a stocktake adjustment must be
   created **and approved** by the owner in the UI before it overrides anything.
2. The negative-stock response rule in 3.3 — this is the rule that prevents a
   fourth round, and it constrains the owner as much as the agents.
3. The honest limit stated in 4.2 — the constraint makes forgery visible and
   attributable, not impossible. Confirm that is acceptable, or ask for the
   larger change.
4. The ownership question in section 9.

No implementation plan is written and no code is touched until these are
answered.

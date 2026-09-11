# Data integrity: backdated, audit/recovery, and backup rules

## Backdated transaction rules

### BR-BACKDATE-001 — Creation time and effective time are distinct

**Status:** `APPROVED`

A purchase, stock adjustment, or production event created later with an earlier effective time is a backdated event. Detection must preserve both timestamps and the affected historical window.

### BR-BACKDATE-002 — Backdated impact requires review

**Status:** `APPROVED`

Detected events follow the reviewed backdated-ledger path. The system must not silently recompute pinned historical sales merely because a new ledger row becomes visible in replay.

### BR-BACKDATE-003 — Historical gaps remain evidence

**Status:** `APPROVED`

Known historical gaps may be locked/classified without changing `cost_at_sale`. Operator review and any future recompute decision remain separate actions.

## Audit, recovery, and production-write rules

### BR-DATA-001 — No silent production writes

**Status:** `APPROVED`

Inspection and audit are read-only by default. Any tool capable of writing must require an explicit apply mode and print the exact target/count/payload before execution.

### BR-DATA-002 — Historical recovery requires immutable inputs

**Status:** `APPROVED`

A historical recovery requires owner approval, frozen source/payload hash, dry-run output, atomic apply, post-apply cohort checks, and rollback-ready evidence.

### BR-DATA-003 — Audit locks protect reviewed history

**Status:** `APPROVED`

Rows protected by `audit_baseline_locks` reject ordinary mutation. Any escape path must be narrow, transaction-local, reviewed, and recorded.

### BR-DATA-004 — Failure means stop and assess

**Status:** `APPROVED`

If a post-apply invariant fails, stop further writes and compare against the approved cohort before deciding whether rollback is necessary. A broad live audit that changes population is not by itself proof that the approved cohort failed.

### BR-DATA-005 — Compute exactly, round only on screen, store inputs rather than results

**Status:** `APPROVED` — owner decision 2026-09-11. Withdraws the directional display rounding of 2026-07-30 (cost rounded up, stock rounded down, "never flatter the business"). **Not yet implemented:** until `docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md` Mục 0 lands, `lib/reports/display-rounding.ts` still rounds directionally and `lib/assets/asset-depreciation.ts` still rounds each month's charge.

*"Tất cả mọi thứ đều phải được tính chính xác. Đối với hiển thị trên hệ thống thì làm tròn đến chữ số hàng đơn vị và không có số thập phân. Đối với dữ liệu lưu trữ thì nên lưu số để backend tính toán chứ không nên lưu kết quả."*

- **No calculation rounds an intermediate figure.** 200.000đ depreciated over 6 months is 33.333,33…đ every month, and the six add to 200.000đ — not five months of 33.333đ and a sixth of 33.335đ.
- **Rounding happens only where a number is shown:** to the nearest whole đồng, or whole base unit for a quantity, halves away from zero, no decimals.
- **A shown total is the rounded exact total, never a sum of rounded cells.** A row of months can therefore differ from its total by a đồng or two — three months of 100,4đ show 100 each and a total of 301. The screen says so where it happens; no cell is nudged to hide it.
- **Store the numbers a figure comes from, not the figure.** Reports read source rows and recompute on every read.
- **Money that really changed hands stays whole đồng:** an order's total, a discount on a bill, what was paid to a supplier. Those record what happened; nobody pays half a đồng.

Whether percentages and quantities shown in a larger unit ("1,5 hộp") keep a decimal was put to the owner on 2026-09-11; until answered they keep today's one or two decimals.

**Where the code does not follow this yet** (measured 2026-09-11, each under 1đ per line). These follow the P&L as their own plan, because the first two need a migration on `assets`:
- `lib/costing/purchase-order-cost-allocation.ts` rounds each purchase line's share of shipping and discounts to a whole đồng (`BR-COGS-006`).
- `assets.total_cost` and `assets.unit_cost` (bigint), and `purchase_order_lines.unit_price` (bigint, `round(subtotal ÷ quantity)`), store results. The depreciation band is looked up from the rounded `unit_cost`.
- `lib/sales/order-math.ts` rounds each item's and topping's share of an order discount for the sales report.

## Backup and retention rules

### BR-BACKUP-001 — Scheduled backups are full snapshots

**Status:** `APPROVED`

The Drive backup is a full schema-versioned snapshot of the approved table allowlist, not only the day's new rows.

### BR-BACKUP-002 — Daily and monthly retention are separate

**Status:** `APPROVED`

Keep 180 rolling daily snapshots. Keep one idempotent full snapshot for each month indefinitely. Daily and monthly files live in separate Drive child folders.

### BR-BACKUP-003 — Completeness is validated before retention

**Status:** `APPROVED`

Apps Script validates the response, schema version, and expected table keys before writing/retaining the file. A response file that fails the contract is not a successful backup.

### BR-BACKUP-004 — Storage migration uses capacity/reliability triggers

**Status:** `APPROVED`

Begin migration planning when the serialized bundle reaches the warning threshold in the backup policy (currently 20 MB), and move the production destination by 25 MB or earlier if runtime/reliability limits are reached.

### BR-BACKUP-005 — Restore requires separate approval

**Status:** `APPROVED`

Backup success does not authorize restoration. A restore needs a reviewed mapping, target environment, dry-run/validation, and explicit production approval.

## Migration state is measured on the database, not read from the CLI

`npx supabase migration list` records only migrations applied through the CLI. A migration pasted into the dashboard runs but writes no history row, so the list drifts, and each manual fix widens the gap that made the next fix manual. The 2026-09-02 reset spec recorded three batches as "not run" that had run — the same trap.

**The drift observed 2026-09-07:** the remote column stopped at `0064` while `0065`–`0096` were live — verified by probing `outlets` (exists, 2 rows), `base_ingredients` (gone), `stock_ledger` (gone). `supabase db push` was unusable: it would have replayed 32 migrations including `drop table` statements.

**Repaired the same day.** Each of the 32 was proved before being marked: 25 by a directly observable artifact, 7 inferred because a later proven migration overwrote the function they wrote, 0 unproven. `supabase migration repair --status applied` then wrote the history rows without executing any SQL, and `0097` went out through `supabase db push` as one migration. As of 2026-09-07 the list is trustworthy: 96 applied, `0097` applied, nothing pending.

**The rule survives the repair, because the drift can recur.** Any migration applied by hand from here starts the gap again. To know whether a migration has run, query the table, column or function it creates or drops; do not read the CLI list or a document, this one included. Two traps met while proving the 32, both worth knowing before trusting a probe: `information_schema` is privilege-filtered, so a role without `SELECT` on a table sees zero columns and "no permission" looks exactly like "never ran" — read `pg_catalog` instead; and an absence marker ("the new body no longer mentions X") false-fails when the new body carries a *comment* explaining why X was removed, so prefer a positive marker unique to the version you are testing for.


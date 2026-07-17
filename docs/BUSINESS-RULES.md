# Business Rules

Status: canonical rule index

Last verified: 2026-07-17

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này là cửa vào để biết quy tắc vận hành nào đã được duyệt, quy tắc nào mới chỉ quan sát thấy trong hệ thống và điểm nào còn chờ quyết định. Các công thức kỹ thuật dài vẫn nằm trong tài liệu chuyên sâu; ở đây chỉ ghi nguyên tắc và dẫn đến nguồn chi tiết.

Không được dùng hành vi hiện có trong code để tự tạo một quy tắc kinh doanh mới. Quy tắc mới hoặc thay đổi chính sách cần owner phê duyệt và ghi ngày áp dụng.

## Rule status

| Status | Meaning |
|---|---|
| `APPROVED` | Owner-approved operating policy or reviewed invariant currently in force |
| `OBSERVED` | Current implementation behavior that has not been elevated to owner-approved policy |
| `UNRESOLVED` | A business or operational decision is still required |
| `RETIRED` | Historical rule no longer in force; successor and effective date required |

When a rule changes, preserve the old decision in Git/audit evidence and record the new effective date. Do not silently rewrite production history to make old transactions follow a new rule.

## Authority hierarchy

This document summarizes rules for discovery. Detailed Tier 2 sources remain authoritative within their narrow scope:

- terminology: [`domain-dictionary.md`](domain-dictionary.md);
- valuation/inventory design: [`superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`](superpowers/specs/2026-06-25-mac-cogs-inventory-design.md);
- reviewed MAC baseline: [`audits/2026-07-09-mac-drift-baseline-audit.md`](audits/2026-07-09-mac-drift-baseline-audit.md);
- BTP replay-drift policy: [`audits/2026-07-16-btp-recipe-replay-drift-policy.md`](audits/2026-07-16-btp-recipe-replay-drift-policy.md);
- backup/retention policy: [`audits/2026-07-16-drive-backup-policy.md`](audits/2026-07-16-drive-backup-policy.md);
- backup operation: [`operations/apps-script-drive-backup.md`](operations/apps-script-drive-backup.md).

If a summary here conflicts with a reviewed Tier 2 policy, stop and resolve the contradiction rather than choosing whichever result is convenient.

## Sales and order rules

### BR-SALE-001 — Historical sale economics are pinned

**Status:** `APPROVED`

Order lines store the cost used at sale time in `cost_at_sale`. Historical reporting must use the pinned value rather than silently replacing it with a later recipe or purchase-cost replay.

### BR-SALE-002 — Transaction snapshots preserve write-time inputs

**Status:** `APPROVED`

Orders and lines preserve the relevant price, promotion, recipe, modifier, and cost snapshots required by the reviewed flow. Later catalog edits must not rewrite the meaning of an already completed transaction without an explicit historical-recovery plan.

### BR-SALE-003 — Order lifecycle changes require traceability

**Status:** `APPROVED`

Void, edit, and supersede flows must preserve an explainable event/history path and the associated inventory effect. A UI status change without corresponding transaction evidence is not sufficient.

### BR-SALE-004 — Exact operational eligibility filters are implementation contracts

**Status:** `OBSERVED`

Reports and audits apply status/supersede filters to decide which orders count. Pre-Audit C and later report audits must document those filters per capability before they are promoted into owner-facing policy.

## COGS and reporting rules

### BR-COGS-001 — MAC is the primary valuation method

**Status:** `APPROVED`

Moving Average Cost (MAC) is the COGS standard for order valuation and P&L reporting. FIFO remains an audit/debug aid and is not the primary P&L contract.

### BR-COGS-002 — Reports use pinned sale cost

**Status:** `APPROVED`

P&L and order COGS use the stored `cost_at_sale` for the affected sale. A replay difference can be informational without meaning that stored money is wrong.

### BR-COGS-003 — Rounding and allocation must reconcile

**Status:** `APPROVED`

Line/order allocations, discounts, COGS, and report totals must reconcile at the stored currency precision. Relevant audits must report both count and signed monetary delta.

### BR-COGS-004 — Historical drift is classified before action

**Status:** `APPROVED`

Audit output distinguishes locked matches, stored-value violations, informational replay shifts, known-not-locked items, and new investigation needs. Replay drift alone does not authorize recomputation.

## Inventory, purchasing, and production rules

### BR-INV-001 — Quantity movement belongs in the stock ledger

**Status:** `APPROVED`

Purchase receipts, sale consumption, adjustments, production input, production yield, and reversals must be explainable through `stock_ledger` records and their business references.

### BR-INV-002 — Critical multi-row writes are atomic

**Status:** `APPROVED`

Purchase orders, reviewed recoveries, and other critical flows that change multiple dependent rows must use an atomic transaction/RPC path or a reviewed equivalent. A partial success is not an acceptable business result.

### BR-INV-003 — BTP consumption follows reviewed recipe/yield evidence

**Status:** `APPROVED`

Semi-product production and consumption must retain the recipe/yield evidence needed to explain sale-time COGS. Later recipe replay can differ from the pinned transaction without authorizing historical mutation.

### BR-INV-004 — Negative stock is investigated, not silently fabricated away

**Status:** `APPROVED`

Negative-stock findings require physical/business evidence and an approved correction path. Unresolved negative stock remains visible in audit/roadmap records.

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

## Access and security rules

### BR-ACCESS-001 — Intended roles do not prove enforcement

**Status:** `APPROVED`

Business roles and intended permissions are documented in [`ACCESS-MODEL.md`](ACCESS-MODEL.md). Only a security review can label a path verified; a menu item or route guard alone is insufficient.

### BR-ACCESS-002 — Secrets and password hashes stay server-side

**Status:** `APPROVED`

Credentials, service keys, backup tokens, and password hashes must not be serialized to the browser or recorded in documentation/logs. SEC-1 tracks the known admin user-payload gap.

## Unresolved items

| ID | Status | Decision needed | Current safe statement |
|---|---|---|---|
| `BR-U-001` | `UNRESOLVED` | Offline POS design and acceptance criteria | Offline ordering is not a verified live capability |
| `BR-U-002` | `UNRESOLVED` | Multi-brand/outlet/franchise data and access model | Current operating scope is one brand/one shop |
| `BR-U-003` | `UNRESOLVED` | Final business-role permission matrix | Use intended/observed/verified labels; Phase 3 will audit enforcement |
| `BR-U-004` | `UNRESOLVED` | Restore drill frequency and approved restore target | Backups are recovery inputs, not proof of recoverability |
| `BR-U-005` | `UNRESOLVED` | Physical corrections for known negative-stock items | Do not fabricate or silently rewrite balances |

## Change procedure

1. Identify the rule ID and current source/evidence.
2. State the business impact and effective date.
3. Obtain owner approval for policy changes.
4. Update the relevant Tier 2 source if technical detail changes.
5. Update implementation/tests in a separately reviewed task.
6. Preserve historical evidence and record the result in tracking/completed documents.

Update this index when a rule is approved, retired, contradicted by verified implementation, or moved to a different Tier 2 authority.

# Orders V2 Cutover Runbook

**Use this when:** migrating production V1 data to V2 sheets.

**Estimated time:** 30-60 minutes (depending on order count).

**Rollback time:** 15 minutes if needed.

---

## Pre-Cutover Checklist (T-1 day)

- [ ] Notify all POS users of system pause window (suggest off-peak: 14:00-15:00 weekdays)
- [ ] Verify all WS-1 through WS-4 commits merged to main
- [ ] Run `rtk npm test` — must show 100+ tests pass
- [ ] Run `rtk tsc --noEmit` — must show 0 errors
- [ ] Backup V1 sheets in Google Sheets:
  - Right-click `Orders` tab → Duplicate → rename to `Orders_BACKUP_PRE_WS5_<date>`
  - Repeat for `Order_Lines`, `Stock_Ledger`
- [ ] Verify backup tabs exist before proceeding

---

## Cutover Steps (T-0)

### Step 1: Stop POS traffic (2 min)

- Open POS in browser, verify no active checkout
- Ask cashiers to pause new orders for 30 minutes
- (Optional) Set maintenance banner via Slack/announcement

### Step 2: Clean V2 test orders (5 min)

Run: `npx tsx scripts/cleanup-test-orders-v2.ts`

Review output. If test orders found:
Run: `npx tsx scripts/cleanup-test-orders-v2.ts --live`

Verify V2 sheets are clean (0 rows in Orders_V2):
Run: `npx tsx scripts/list-all-v2-orders.ts`

### Step 3: Dry-run migration (5 min)

Run: `npx tsx scripts/migrate-orders-to-v2.ts --dry-run 2>&1 | tail -20`

Review output:
- Total V1 orders vs Migrated count
- Invariant failed count (target: < 5% of total)
- Errors

Open `migration-report.json`. Spot-check 5 random orders:
- Invariant passed?
- Heuristic notes reasonable?
- net_total matches V1 total_amount?

**Stop if:**
- Invariant failed > 10% of total
- Any error pattern looks systemic
- net_total values look wrong

### Step 4: Live migration (15-30 min)

Run: `npx tsx scripts/migrate-orders-to-v2.ts --live 2>&1 | tee migration-live.log`

Monitor progress. **DO NOT interrupt** — partial migration is recoverable but annoying.

After completion, verify:
- V2 orders count matches V1 (minus skipped)
- Order_Lines_V2 count matches V1 Order_Lines
- Order_Events count matches V2 orders (1 MIGRATED event each)

### Step 5: Reconciliation (5 min)

Run: `npx tsx scripts/reconcile-v1-v2.ts`

Expected: drift < 1đ per order (within rounding tolerance).

**Stop if drift > 5đ/order.** Investigate before announcing done.

### Step 6: Spot-check reports (5 min)

In browser:
- `/admin/reports/pnl` — select full date range, verify totalRevenue matches V1 known number
- `/admin/reports/sales` — verify best sellers look right
- `/admin/orders` — verify list shows migrated orders

### Step 7: Resume POS traffic

Notify cashiers: system available. Monitor first 5 orders for any issues.

---

## Rollback Procedure

If anything goes wrong post-cutover:

### Step R1: Stop POS traffic

Same as cutover Step 1.

### Step R2: Restore V1 sheets

In Google Sheets:
- Delete current `Orders` tab (right-click → Delete)
- Rename `Orders_BACKUP_PRE_WS5_<date>` → `Orders`
- Repeat for `Order_Lines`, `Stock_Ledger`

### Step R3: Delete V2 migrated rows

Run: `npx tsx scripts/cleanup-test-orders-v2.ts --live`

(This catches all V2 orders since they all have `migration_notes` set or are smoke test orders.)

If cleanup script doesn't catch all, manually delete remaining rows in V2 sheets.

### Step R4: Verify V2 reports show "no data" banner

V2 sheets should be empty → reports show amber banner → system reverted to pre-WS-5 state.

### Step R5: Resume POS

System is back to "V2 empty + V1 active" state. Legacy code paths still work (if not yet archived in WS-5 Task 6).

---

## Post-Cutover Monitoring (T+1 day, T+7 days)

### T+1 day:
- [ ] Reconciliation script drift still < 1đ/order
- [ ] No new errors in production logs
- [ ] Reports PnL/Sales match expected daily totals

### T+7 days:
- [ ] All POS orders since cutover have correct V2 shape
- [ ] Admin edits work (supersede chain functioning)
- [ ] No user complaints about report numbers

If all clean → proceed with WS-6 (rename V1 sheets to `_LEGACY`, archive `lib/report-utils.ts`, migrate dashboard).

---

## Known Issues + Workarounds

### Issue: Some migrated orders fail invariants

**Symptom:** `invariantFailed > 0` in migration report.

**Cause:** V1 data corruption (e.g., UCK000094 overpayment pattern).

**Action:** Acceptable. Migrated order has documented `migration_notes`. Reports still work because they sum stored `net_total` (which is V1's authoritative value).

### Issue: Drift > 1đ/order in reconciliation

**Symptom:** Reconciliation script shows drift exceeds tolerance.

**Cause:** Either migration bug or V1 data has unique patterns not covered by heuristics.

**Action:** Investigate `migration-report.json` for orders with large residuals. Manual fix may be needed.

### Issue: V1 sheets already renamed/deleted

**Symptom:** Reconciliation script can't find V1.

**Action:** Skip reconciliation. Trust the migrated data + unit tests.

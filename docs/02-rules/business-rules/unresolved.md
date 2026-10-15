# Unresolved items

| ID | Status | Decision needed | Current safe statement |
|---|---|---|---|
| `BR-U-001` | `RESOLVED` | Offline POS | Closed 2026-10-15 by `BR-SALE-015`: the till does not sell without internet |
| `BR-U-002` | `UNRESOLVED` | Multi-brand/outlet/franchise data and access model | Two outlets and two brands run on one shared stock (see SYSTEM-OVERVIEW); a per-outlet stock model is the open decision, and MULTI-BRANCH-IMPACT lists what it touches |
| `BR-U-003` | `UNRESOLVED` | Final business-role permission matrix | Use intended/observed/verified labels; the enforcement audit is still pending (only STAFF is restricted, in proxy.ts, owner decision 2026-07-22; one row fixed 2026-10-15 by `BR-SALE-016`: each cashier sells under a STAFF account) |
| `BR-U-004` | `UNRESOLVED` | Restore drill frequency and approved restore target | Backups are recovery inputs, not proof of recoverability |
| `BR-U-005` | `UNRESOLVED` | Physical corrections for known negative-stock items | Do not fabricate or silently rewrite balances |

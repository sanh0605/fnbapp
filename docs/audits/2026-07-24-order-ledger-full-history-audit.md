# Full-history order-ledger audit

Date: 2026-07-24

## Methodology change

`scripts/audit-order-ledger.ts` no longer uses the legacy fixed-cutover audit.
It now rebuilds trusted purchase/adjustment primitives, replays every eligible
order chronologically through `lib/full-history-recompute.ts`, and compares the
net derived inventory quantity by order and item against the recorded ledger.

The historical `auditOrderLedger` function remains available only because
older correction-verification scripts reproduce decisions made under that old
methodology. It is explicitly deprecated for new audits.

The comparison tolerance is `0.01` base units, matching the full-history audit
and excluding only storage-rounding residue. Replay errors, skipped purchase
receipts, quantity mismatches, and orphan derived rows all make the CLI fail.

## Live read-only result

```text
Orders:               1701
Lines replayed:        2247
Computed ledger rows:  11422
Recorded ledger rows:  11702
Replay errors:         0
Skipped PO receipts:   0
Quantity mismatches:   6
Orphan derived rows:   0
```

All six mismatches belong to `PHD001128`, `PHD001129`, and `PHD001132`. Their
root cause, forward fix, and guarded repair dry-run are documented in
`docs/audits/2026-07-24-void-shortfall-ledger-repair.md`.

The audit exited with status 1 as designed. No production data was written.

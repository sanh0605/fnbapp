# Lock removal and full cost recompute (owner decision)

Date: 2026-07-22
Status: applied and reverified

## Owner decision

After reviewing the full-history rebuild's Phase 2 report, the owner decided to stop preserving
per-cohort locked cost decisions (2026-07-13 MAC drift baseline, 2026-07-16 BTP_RECIPE_REPLAY_DRIFT,
Task 3.9's 2026-07-21 recovery) as permanently protected values. Direct quote: "Anh cần sửa tất cả
mà, anh đâu có muốn khoá nữa. Anh cần chính xác 100% theo từng sản phẩm từng đơn." (I need everything
fixed, I don't want locks anymore. I need 100% accuracy per product, per order.)

Confirmed explicitly with the owner before executing: this means overriding previously-reviewed
decisions with the new engine's uniform computation, including the 41-line Task 3.9 cohort the owner
personally approved on 2026-07-21.

## Mechanism

New RPC `remove_audit_baseline_lock` (migration `0032`): requires a reviewer and reason, logs the
full prior lock row to `data_recovery_changes` before deleting it, so the removal itself is a
durable, provable decision rather than a silent deletion.

`scripts/remove-locks-and-recompute-cost.ts`: for every currently-locked line where
`lib/full-history-recompute.ts`'s ground-truth engine disagrees with the current stored
`cost_at_sale`, removes the lock then applies the new value via `apply_full_history_recovery`
(migration `0031`, now succeeds since the line is no longer locked).

## Result

Dry-run matched exactly before `--apply`: 287 lines across 248 orders, net delta 161,556 VND.
Applied: 287 locks removed, 287 lines corrected, 0 failures.

Reverified: rerunning the same script finds 0 remaining (locked-line count dropped from 436 to 149
-- the 149 remaining locks are lines where the engine's computed value already matched the stored
value, so no lock removal was needed for those). `audit-order-ledger.ts` quantity baseline unchanged
at 203 (cost-only change, no quantity touched). `audit-pnl-mac-consistency.ts` clean (0 VND,
23,236,811 VND total COGS). `tsc --noEmit` clean. Full suite 641/641.

## Combined with the earlier Category A correction (same session)

- Category A (never locked): 416 lines, 393 orders, 11,970 VND net -- applied earlier today.
- Locked, now unlocked and corrected: 287 lines, 248 orders, 161,556 VND net -- this pass.
- **Total for today's full-history cost recompute: 703 lines, ~628 distinct orders, 173,526 VND net
  delta**, all using the single `lib/full-history-recompute.ts` engine, matching the owner's stated
  goal of one consistent calculation method applied uniformly.

## Still open

149 locks remain (engine's computed value already matched stored, so nothing to remove/correct for
those specifically) -- these were not touched, consistent with "only change what actually differs."
Quantity-side reclassification (5,479 entries across 1,350 orders, the semi-product implicit-
production gap) is a separate, larger pass -- not covered by this document, tracked separately.

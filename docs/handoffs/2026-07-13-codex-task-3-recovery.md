# Task: E3 — Task 3 Selective Recovery (scoped from E2 findings)

## Context

E2 closed (commit `7bfab8a`). 170 baseline lines / +119,782 VND classified:
- 96 UNRESOLVED_WRITE_TIME_PROVENANCE → +118,954 VND → **lock only, no recompute**
- 34 BACKDATED_LEDGER → +1,762 VND → **Task 3.2 admin UI review path** (already live)
- 40 PURCHASE_COST_RECOVERY → -933 VND → **selective recompute (this task)**

Net effect if E3 ships:
- 40 lines' stored COGS decreases by 933 VND total (over-stored → matches MAC replay).
- Gross profit for affected period increases 933 VND.
- Audit baseline drift increases from +119,782 to +120,715 VND (because the 40 over-stored lines no longer offset the 130 under-stored lines).

## Scope

### In scope
1. Deploy migration `0012_mac_drift_baseline_locks.sql` (already drafted locally) to production.
2. Insert 170 `order_line_id` rows into `audit_baseline_locks` (all categories, with source_hash from baseline JSON).
3. Capture pre-recovery snapshot under `recovery-snapshots/`.
4. Dry-run `apply_mac_drift_recovery(...)` RPC for the 40 PURCHASE_COST_RECOVERY line IDs.
5. After explicit user approval (PAUSE here), apply recovery.
6. Verify post-recovery audit baseline.
7. Update audit docs + DEVELOPMENT-TRACKING.

### Out of scope (explicit)
- Do NOT recompute 96 UNRESOLVED lines.
- Do NOT recompute 34 BACKDATED lines (Task 3.2 path).
- Do NOT push to remote.
- Do NOT modify MAC engine code.
- Schema hardening (visibility timestamp) → separate task after E3.

## Phase breakdown

### Phase A — Migration + lock baseline
- Deploy migration 0012 to production via `supabase db push`.
- Insert 170 rows into `audit_baseline_locks` from `docs/audits/2026-07-09-mac-drift-baseline-lines.json`.
- Source hash: SHA-256 of that JSON file.
- Verify: `select count(*) from audit_baseline_locks` → 170.

**PAUSE for user approval before Phase B** (production migration deployed).

### Phase B — Pre-recovery snapshot
- Use existing snapshot tooling (see `recovery-snapshots/` pattern from prior recovery runs).
- Capture `Orders_V2`, `Order_Lines_V2` (just affected rows + their order headers), `Stock_Ledger` (relevant items), `audit_baseline_locks`.
- Hash manifest for rollback reference.

### Phase C — Selective recompute (40 PURCHASE_COST_RECOVERY lines)
- Identify 40 line IDs from E2 JSON artifact (`docs/audits/2026-07-13-task-3.3-drift-investigation.json`).
- Run `apply_mac_drift_recovery(...)` RPC with explicit 40-line list, **dry-run mode**.
- Dry-run output must show: line ID, current stored, expected stored, delta.
- Sum of deltas must equal -933 VND.

**PAUSE for user approval before Phase C apply** (production data modification).

After approval: run RPC in apply mode. Atomic + idempotent + advisory-locked per line.

### Phase D — Verify
- Re-run `scripts/audit-mac-drift-baseline.ts`.
- Expected post-recovery: 130 mismatched lines, drift +120,715 VND.
- Verify 40 recomputed lines: `stored_cost_at_sale == expected_cost_at_sale`.
- Verify 130 non-recomputed lines: unchanged from pre-recovery.
- `vitest run`: 336/336 pass.
- `tsc --noEmit`: 0 errors.
- `git diff --check`: clean.

### Phase E — Documentation
- Update `docs/audits/2026-07-09-mac-drift-baseline-audit.md` with "Post-E3 recovery" section.
- New doc: `docs/audits/2026-07-XX-task-3-recovery-result.md` with before/after table.
- Append `DEVELOPMENT-TRACKING.md` entry dated 2026-07-13.

## Constraints

- **Atomic + idempotent recovery RPC** — re-running on already-recovered lines must be safe no-op.
- **Lock bypass only inside recovery RPC** — trigger blocks update/delete otherwise.
- **Dry-run gate mandatory** before any apply.
- **Snapshot mandatory** before any apply.
- **No auto-apply** — every production action requires explicit user pause + approval.
- **No push** — local only per protocol.

## Verification gates (all must pass)

| Phase | Gate | Approval required? |
|---|---|---|
| A | `audit_baseline_locks` = 170 rows; anon RLS revoked | YES (prod migration) |
| B | Snapshot manifest hash captured; verify-integrity script passes | No (local artifact) |
| C dry-run | 40 lines identified; delta sum = -933 VND; matches E2 classification | YES (review dry-run output) |
| C apply | RPC returns success; 40 rows updated | YES (prod data write) |
| D | Audit: 130 mismatched, +120,715 VND; 40 lines stored==expected; vitest+tsc clean | No (verification only) |
| E | Docs + tracking updated | No (docs only) |

## Risks

1. **Migration 0012 RLS misconfiguration** — verify anon/authenticated revoked, service_role bypass.
2. **RPC lock contention** — advisory lock per line; 5s timeout, fail fast.
3. **Wrong line selection** — dry-run must show exact 40 IDs + expected delta before apply.
4. **Baseline shift during recovery window** — new live orders may shift numbers slightly. Run during low-traffic window.
5. **Rollback path** — snapshot + lock table enable revert of stored COGS via snapshot values. Document rollback procedure.

## Expected output

- Migration 0012 deployed to production.
- 170 rows in `audit_baseline_locks`.
- Pre-recovery snapshot under `recovery-snapshots/`.
- Recovery applied to 40 lines.
- Audit doc updated + new recovery-result doc.
- DEVELOPMENT-TRACKING entry.
- Verification log with all gates passed.

## Questions before starting

If unclear, ping Claude first:
- Maintenance window timing (Vietnam off-hours)?
- Supabase automated backup beyond local snapshot?
- Stakeholder notification about COGS shift?
- Should `apply_mac_drift_recovery` RPC accept a `dry_run` flag, or use a separate `preview_mac_drift_recovery` function? (Check existing migration 0012 design.)

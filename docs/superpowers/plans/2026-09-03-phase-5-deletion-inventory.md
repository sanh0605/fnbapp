# Phase 5 deletion inventory — reviewed keep/delete list

**Written 2026-09-03 by Opus 5 (Phase 4, Task 3).** This list is what Phase 5
acts on. **Phase 5 deletes nothing until the owner approves this list** — it is
irreversible (spec §2.1).

## Tóm tắt cho chủ quán

- **Giữ 38 công cụ** đang thật sự cần: các cửa kiểm, bộ sinh bản đồ/sơ đồ, và công cụ sao lưu/khôi phục.
- **Xoá 215 script dùng-một-lần** đã chạy xong (điều tra, backfill, migration, reset cũ). Đã kiểm: **không file sống nào gọi tới chúng** — xoá an toàn.
- **Xoá các hồ sơ cũ** (kiểm toán, kế hoạch cũ, nhật ký, tài liệu lẻ) theo đúng thiết kế đã duyệt.
- **Một chỗ cần anh quyết:** file `ARCHITECTURE.md` (166 dòng) — giữ hay gộp vào bản đồ hệ thống rồi xoá?

---

## 1. KEEP — scripts still needed (38)

**Gates (`CLAUDE.md` §9):**
- `scripts/check-rules-current.ts`, `check-rules-current-core.ts`, `check-rules-current-core.test.ts`
- `scripts/verify-revenue.ts`, `verify-revenue-core.ts`, `verify-revenue-core.test.ts`

**Doc/map tooling (Phase 1 + Phase 4):**
- `scripts/system-map/*` (extract-tables, extract-writes, extract-rpc, extract-routes, build-map, generate, build-diagram, generate-diagram, + their tests) — 11 files
- `scripts/doc-checks/*` (map-drift-core, flow-doc-core, line-ceiling-core, line-ceiling, open-items, run-blocking, seed-proof + tests) — 10 files
- `scripts/doc-map/relation-block.ts` + test — 2 files

**Backup / restore (named in `docs/04-operations/INCIDENT-RESPONSE.md`):**
- `scripts/verify-drive-backup.ts`, `scripts/restore-backup-to-target.ts`, `scripts/verify-restore-drill.ts`
- `scripts/apps-script/backup-to-drive.gs`

**Referenced by `package.json` — KEEP but FLAG (may be legacy, owner may retire the npm script too):**
- `scripts/preview.ts` (`npm run preview`)
- `scripts/migrate-to-sheets.js` (`npm run migrate` — Google-Sheets-era migration, almost certainly dead; keep the file only because the npm script points at it, flag for removal-with-the-script)

## 2. DELETE — one-off scripts already executed (215)

**Verified safe:** a full scan found **no living file imports any script** (`grep "from '…/scripts/'" app lib components` → only one string-literal test fixture, not a real import). So none of these is a functional dependency.

- **207 `.ts` one-offs** (top-level `scripts/*.ts` outside the keeper set): all `audit-*`, `apply-*`, `backfill-*`, `migrate-*` (except migrate-to-sheets.js above), `reset-*`, `revert-*`, `reprocess-*`, `remigrate-*`, `re-migrate-*`, `rollback-*`, `repair-*`, `recon-*`, `recover-*`, `lock-*`, `trace-*`, `investigate-*`, `diagnose-*`, and the dated one-off `check-*`/`verify-*` (e.g. `verify-0063`, `verify-task3`, `audit-gate3`), plus `standalone-sheets-utils.ts`, `stale-cache-risk.ts`, `batch-sheets-*`, `generate-script-*`, `lan-address-*`.
- **8 legacy `.js`/`.json`:** `init-po-tables.js`, `init-promotions-table.js`, `init-sheets-db.js`, `init-units-table.js`, `migrate-units-to-ids.js`, `migrate.js`, `reconcile-migrated-dates.js`, `recover-uck000002.json`.

**12 of the 207 are mentioned in comments in living files** (mostly `lib/historical/*`, which is itself semi-dead code the reset does not touch). These are comment/string mentions, **not** imports — deleting the script leaves a stale comment, breaks nothing. List for optional comment-cleanup: `apply-backfill-nnl007-ledger-event`, `apply-backfill-recipe-backdated-events`, `apply-pending-backdated-events`, `apply-phase5-cost-rebuild`, `audit-admin-read-guards.test`, `audit-full-history-recompute`, `lock-backdated-historical-gap-cohort`, `lock-btp-recipe-replay-drift-cohort`, `migrate-hong-tra-to-luc-tra`, `recover-task-3`, `revert-prior-lock-violations-2026-07-20-21`, `verify-pnl-patterns`. (Their `lib/*.test.ts` counterparts test extracted lib functions, not the script files, so those tests survive deletion.)

## 3. Non-script deletions (design §4)

- `docs/audits/` — 100 files, 12 MB (incl. the 5 data-backup files the owner reaffirmed deleting, §2.13)
- `docs/handoffs/` — 3 files
- `DEVELOPMENT-TRACKING.md` — the who-did-what log (design §7: deliberately not kept; git history is the record)
- Legacy stray docs: `CONTEXT.md`, `docs/ACCESS-MODEL.md`, `docs/COMPLETED.md`, `docs/domain-dictionary.md`, `docs/FEATURE-CATALOG.md`, `docs/FILE-ORGANIZATION.md`, `docs/OPEN-ITEMS.md` (old, superseded by `docs/04-operations/OPEN-ITEMS.md`), `docs/TESTING.md`, `docs/operations/` (4), `docs/reports/` (2), `docs/runbooks/` (1)
- `docs/superpowers/plans/*` EXCEPT the reset's own phase plans (2026-09-02-phase-1, 2026-09-03-phase-2/3/4, this inventory)
- `docs/superpowers/specs/*` EXCEPT `2026-09-02-project-reset-design.md`
- Dead address lines in code comments that point at deleted plan/spec paths (design §2.19 — strip the pointer, keep the reasoning)

## 4. Reference cleanups Phase 5 MUST do (so paths-exist stays green after deletion)

Deleting the files above breaks references still in the surviving tree. Phase 5 repoints/removes each in the SAME step it deletes, or the pre-commit gate goes red:

- **`CLAUDE.md`** — §1 (shared-docs list) and §9 (done-definition) name `DEVELOPMENT-TRACKING.md`; §1/§9 also point at the legacy `docs/OPEN-ITEMS.md`. Update to the design's decision (git history replaces the tracking log; open items live at `docs/04-operations/OPEN-ITEMS.md`, generated).
- **`README.md`** — links `CONTEXT.md`, `docs/ACCESS-MODEL.md`, and `ARCHITECTURE.md` (line ~121-122). Repoint/remove per the ARCHITECTURE decision below and the deletions above.
- **`docs/02-rules/business-rules/access.md`** — `BR-ACCESS-001` links `docs/ACCESS-MODEL.md`. If ACCESS-MODEL is deleted, fold its content or drop the link.
- **`scripts/verify-revenue.ts`** — a printed NOTE string cites `docs/BUSINESS-RULES.md` (line ~608); update the message to the new path (cosmetic, not gate-blocking).

## 5. Owner decision needed before Phase 5

- **`ARCHITECTURE.md`** (root, 166 lines, "canonical runtime overview") is not in the original design's delete list and overlaps the new `SYSTEM-OVERVIEW.md` + `SYSTEM-MAP.md`. **Keep it, or fold its still-true content into SYSTEM-MAP and delete it?** Flagged, not touched.

---

**Owner approves this list before Phase 5 runs.** Phase 4 deleted nothing.

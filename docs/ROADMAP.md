# Roadmap — Pending Work

Single source of truth for pending tasks, priorities, and scope boundaries. Updated when tasks are added, started, completed (move to `COMPLETED.md`), or blocked.

## How to use this file

- **Start of session:** read this file to know what to work on
- **Add new task:** append to appropriate priority queue with owner + scope
- **Start task:** mark status, mention in commit body
- **Complete task:** move entry to `COMPLETED.md`, remove from here
- **Block task:** move to "Blocked" section with reason

## Active agents & scope

| Agent | Role | Owns | Reviews |
|---|---|---|---|
| Claude (GLM 5.1) | Coordinator | `docs/**/*.md`, root `*.md`, deploy, tracking | All cross-scope changes |
| Codex (GPT 5.5) | Engine | `lib/*.ts`, `supabase/migrations/*.sql`, `scripts/*.ts` | Engine/data correctness |
| Antigravity (Gemini 3.1) | UI | `app/**/*.tsx`, `components/**/*.tsx` | UX, accessibility, visual QA |

Detailed scope rules: `docs/COLLABORATION.md` section C (Risk-Boundary Ownership).

## Commit protocol for parallel work

**When 2+ agents active simultaneously, Claude serializes commits:**

1. Agent A works → commits → signals Claude
2. Claude reviews diff → approves or requests changes
3. Claude signals Agent B to start
4. Repeat

**Never run concurrent commits.** Past incidents: bundled commits required `git reset --hard` + cherry-pick to split.

**Cross-scope exception (small fixes):** <10 lines, 1 file, explicit Claude approval. Document in commit body.

## Priority queue

### P0 — In progress now

| Task | Owner | Scope | Started | Notes |
|---|---|---|---|---|
| [!] **Gate 2 Remediation Wave 1 — POS system-actor gaps + Edge Function signature + stock-adjustment policy** | Codex | `app/pos/actions.ts` (`submitOrderV2`, `savePOSDraft`, `deletePOSDraft`, `getPOSDrafts`); `supabase/functions/user-admin/index.ts` service-role token check; `app/admin/inventory/actions.ts` `submitStockAdjustment` | 2026-07-18 | Implemented locally and awaiting Claude review. All four POS actions now reject anonymous callers, CLI SYSTEM remains explicit, stock-adjustment submission is ADMIN-only, and `/user-admin/migrate` requires the exact runtime service key. No deployment or production write. |

### P1 — Next up (high impact, unblocked)

| Task | Owner | Scope | Notes |
|---|---|---|---|
| [ ] **Gate 2 Remediation Wave 2 — 20 unguarded admin read actions** | Codex | 15 files under `app/admin/**/actions.ts`, see handoff for full list | Handoff: `docs/handoffs/2026-07-18-codex-gate2-remediation-wave2-admin-reads.md`. Mechanical guard-add wave; lower risk than Wave 1 (read-only). |

### P2 — Backlog (medium impact, functional bugs found during Pre-Audit C, not security exposures)

| Task | Owner | Scope | Notes |
|---|---|---|---|
| **FIX-1. Đổi mật khẩu đang hỏng** | Codex | `app/actions/auth.ts` `changePasswordAction` | Pre-Audit C 2026-07-17, Claude verified in code. Đọc/ghi Google Sheet cũ bằng SHA-256, không dùng hệ Supabase+bcrypt hiện tại; đọc `session.user.username` mà hệ đăng nhập không hề gán giá trị này. Kết quả: mọi người dùng bấm đổi mật khẩu đều nhận lỗi "không tìm thấy tài khoản", tính năng không hoạt động. Không khẩn cấp về dữ liệu/tiền, nhưng là tính năng hỏng thật đang hiển thị cho người dùng. Not folded into Gate 1 — this is a broken feature, not a security exposure. |
| **FIX-2. Nút sao lưu thủ công gọi nhầm hệ cũ** | Codex | `app/admin/backup/actions.ts` `triggerBackup` | Pre-Audit C 2026-07-17, Claude verified. Bấm nút sao lưu thủ công trên trang admin vẫn gọi hàm sao lưu cũ (`backup-to-sheets`), không phải hệ sao lưu Drive hằng ngày đã xác minh production. Không ảnh hưởng backup tự động hằng ngày, nhưng nút thủ công hiện không làm đúng như tên gọi. |
| **H1. Push local commits** | Claude | git | Khi anh yêu cầu. 41+ commits local pending. |
| **REV-1. Spot-check 2 scripts/ tooling fixes made by Claude** | Codex | `scripts/generate-script-cleanup-plan.ts`, `scripts/verify-delete-candidates.ts` (commits `b5170da`, `24a57bd`) | Made before the 2026-07-18 `scripts/**` ownership rule closed the gray zone (see `docs/COLLABORATION.md` Section C change log). Both are read-only reporting tools (fixed a hardcoded date, fixed a regex that missed extension-less imports); Claude self-verified by running them and checking output, but no second agent has reviewed the diffs. Low priority, not urgent — closes the review gap retroactively. |
| **SEC-4. Verify deployed JWT settings for 3 Supabase Edge Functions** | User/Claude (needs Supabase dashboard access, not just repo) | `backup-to-sheets`, `notify-order`, `user-admin` (non-`/migrate` routes) | Gate 2 2026-07-18 finding: repository source can't tell whether these are deployed with platform JWT verification on or off (`--no-verify-jwt` or not). `backup-to-sheets` is legacy anyway (see FIX-2); `notify-order` has no application caller today but would send arbitrary caller-supplied content to Telegram if reachable and open; `user-admin`'s normal routes check the caller's Supabase Auth role locally but deployment-level enforcement is unverified. Needs someone with Supabase project access to check actual deployed function settings, not a code change. |

### P3 — Depends on verification

| Task | Owner | Notes |
|---|---|---|
| **V1. First real operator backdate verify** | Claude | Wait for operator to backdate PO (frequency: weekly per user interview). Walk through UI: list → detail → approve → verify drift = 0. |

### Blocked — needs decision or unblock

| Task | Blocker | Resolution path |
|---|---|---|
| (none) | — | SEC-5 resolved 2026-07-18 (owner: stock adjustment is admin/manager responsibility, staff should not submit) — folded into Wave 1, see P0. |

## Future direction (owner priority, set 2026-07-18 — not started, sequencing only)

Owner-stated long-term direction, in order. Nothing below starts until the
phase before it is done; do not begin implementation on any of these without
a fresh, explicit go-ahead even after the prior phase closes — this section
records intent and order, not authorization to start.

1. **Finish current work** — the eight-gate audit in progress (Gate 2 running
   as of 2026-07-18; Gates 3-8 follow). See P0/P1 above.
2. **Feature-completeness pass** — plan and close gaps so the single-shop
   system fully covers: inventory control (kiểm soát hàng tồn), cash
   in/out control (kiểm soát tiền vào tiền ra), sales reports (báo cáo bán
   hàng), order reports (báo cáo đặt hàng), financial reports (báo cáo tài
   chính), and stock reports (báo cáo tồn kho). Likely overlaps
   significantly with Pre-Audit C's `FEATURE-CATALOG.md` findings and the
   deferred 17-section F&B checklist — reconcile rather than duplicate when
   this phase starts.
3. **UI/UX upgrade and frontend unification** (đồng nhất frontend) — after
   feature completeness, not before; a consistent UI on top of incomplete
   features would need rework.
4. **Multi-branch management** (đa chi nhánh) — first of the two expansion
   features. Needs outlet entity, data isolation, outlet-scoped roles,
   consolidated reporting design (see `docs/FEATURE-CATALOG.md`
   `ORG-MULTI-OUTLET` and the F&B spec's "Organization, brand, outlet, and
   device setup" checklist section).
5. **Franchise management** (nhượng quyền) — after multi-branch, since it
   likely extends the same outlet/tenant model rather than replacing it.
   Needs franchisee role, fee/royalty model, and stronger tenant isolation
   than plain multi-branch.
6. **Full permissions and security hardening** (phân quyền và bảo mật) —
   explicitly the *last* phase, done once the system's final shape
   (including multi-branch/franchise) is known, to avoid designing the
   permission model twice. This is distinct from Gate 1 (P0 exposures,
   already closed) and Gate 2 (access map, in progress) — those stay
   scoped to the current single-shop system; this final phase is the full
   `docs/ACCESS-MODEL.md` Phase 3 verification plus whatever multi-branch/
   franchise roles add.

## Out of scope (do not start without explicit approval)

- **Negative stock recovery** (ING-001, ING-021, NNL-003, NNL-006) — needs physical count decision from user
- **Franchise system** — see "Future direction" above; comes after multi-branch, needs design + business rules (multi-tenant RLS, franchisee role, outlet management)
- **Multi-branch system** — see "Future direction" above; comes after the feature-completeness pass and UI/UX unification, needs design + business rules (outlet entity, data isolation, outlet-scoped roles)
- **Historical data rewrite** — any rewrite of pre-2026-07 data requires explicit user approval + dry-run + atomic transaction
- **Auth system overhaul** — placeholder "admin" reviewer in backdate UI is a known gap, but full auth is separate scope; see "Future direction" item 6, deliberately last
- **Gates 3-8 of the full audit** — Gate 2 is open (see P1). Do not start Gate 3+ until Gate 2 closes and Claude reviews it. See `docs/superpowers/specs/2026-07-17-full-system-audit-program.md`.
- **17-section F&B capability checklist** — deferred from Pre-Audit C; needs owner per-item priority classification when scheduled.

## Pending prompts in `docs/handoffs/`

These prompts are ready for agents to pick up. Prompts for completed tasks remain as historical record.

- `2026-07-18-antigravity-ui-remed-1-visual-smoke-test.md` → UI-REMED-1 visual smoke test — historical reference, work complete and Claude-reviewed (commit `2cabde9`)
- `2026-07-18-codex-gate2-remediation-wave1-pos-system-actor.md` → Gate 2 Remediation Wave 1 — ready for Codex pickup, P0
- `2026-07-18-codex-gate2-remediation-wave2-admin-reads.md` → Gate 2 Remediation Wave 2 — ready for Codex pickup, P1
- `2026-07-18-codex-gate2-access-map.md` → Full audit Gate 2 — historical reference, work complete and Claude-reviewed (commits `3570da0`, `f14b092`)
- `2026-07-17-codex-gate1-p0-security-exposures.md` → Full audit Gate 1 — historical reference, work complete and Claude-reviewed (commits `dd2f970`, `57d298a`, `9a8ee66`)
- `2026-07-17-codex-pre-audit-c-feature-inventory.md` → Pre-Audit C — historical reference, work complete and Claude-reviewed (commit `99f466d`)
- `2026-07-17-codex-pre-audit-b-execution.md` → Pre-Audit B Execution — historical reference, work complete and Claude-reviewed (commits `7c2409b`, `b238411`, `caacc58`)
- `2026-07-17-codex-pre-audit-b-canonical-proposal.md` → Pre-Audit B proposal — historical reference, work complete (commit `8016ae8`)
- `2026-07-17-codex-pre-audit-a-documentation.md` → Pre-Audit A — historical reference, work complete (commit `f12725f`)
- `2026-07-17-antigravity-pos-redesign-1-session-3.md` → POS-REDESIGN-1 Session 3 — historical reference, work complete (commit `20a1d38`)
- `2026-07-17-antigravity-pos-redesign-1-session-2.md` → POS-REDESIGN-1 Session 2 — historical reference, work complete (commit `c61f5a1`)
- `2026-07-17-antigravity-pos-redesign-1-session-1.md` → POS-REDESIGN-1 Session 1 — historical reference, work complete (commit `a3682db`)
- `2026-07-17-antigravity-ui-remed-6-remove-stickybar.md` → UI-REMED-6 — historical reference, work complete (commit `7eecf7e`)
- `2026-07-17-antigravity-ui-remed-1-token-swap-overnight.md` → UI-REMED-1 — historical reference, work complete (5 phases: `c33033f` + `8f93742` + `d239cbb` + `55ef69d` + `ee33450`)
- `2026-07-17-antigravity-ui-remed-5-polish.md` → UI-REMED-5 — historical reference, work complete (commit `11c566b`))
- `2026-07-17-antigravity-ui-remed-4-boundaries.md` → UI-REMED-4 — historical reference, work complete (commit `c923086`)
- `2026-07-17-antigravity-ui-remed-3-session-2.md` → UI-REMED-3 Session 2 — historical reference, work complete (commit `2f91b3f`)
- `2026-07-17-antigravity-ui-remed-3-session-1.md` → UI-REMED-3 Session 1 — historical reference, work complete (commit `dd51dae`)
- `2026-07-16-antigravity-ui-remed-2-sticky-filter-bar.md` → UI-REMED-2 — historical reference, work complete (commit `6b65aba`)
- `2026-07-16-codex-task-3.10-audit-display.md` → Task 3.10 — historical reference, work complete (commit `6a5bdec`)
- `2026-07-16-codex-task-3.5-cohort-aware-audit.md` → Task 3.5 — historical reference, work complete (commit `c28319d`)
- `2026-07-16-codex-task-3.9-historical-gap-lock.md` → Task 3.9 — historical reference, work complete (commit `09bf26a`)
- `2026-07-16-codex-task-3.8-backdated-events-surface.md` → Task 3.8 — historical reference, work complete (commit `ad7f7ba`)
- `2026-07-16-codex-task-3.7-btp-drift-lock.md` → Task 3.7 — historical reference, work complete (commit `d2177ca`)
- `2026-07-15-codex-task-3.6-forward-drift-investigation.md` → Task 3.6 — historical reference, work complete (commit `d32d4d4`)
- `2026-07-15-codex-task-3.4-outside-cohort-investigation.md` → Task 3.4 — historical reference, work complete (commit `fea097d`)
- `2026-07-09-codex-modifier-recipe-hardening.md` → E1 (Task 1) — historical reference, work complete
- All other prompts in `docs/handoffs/` reference completed work — see `COMPLETED.md` for outcomes

## Quick links

- Completed work archive: `docs/COMPLETED.md`
- Detailed chronicle log: `DEVELOPMENT-TRACKING.md`
- Protocol: `docs/COLLABORATION.md`
- Feature evidence contract: `docs/FEATURE-CATALOG.md`
- Business rule index: `docs/BUSINESS-RULES.md`
- Access intent and verification boundary: `docs/ACCESS-MODEL.md`
- Test strategy: `docs/TESTING.md`
- UI audit reference: `docs/audits/2026-07-06-ui-consistency-audit.md`
- MAC drift baseline: `docs/audits/2026-07-09-mac-drift-baseline-audit.md`
- Backdated ledger investigation: `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`
- **Full system audit program** (future, owner-triggered): `docs/superpowers/specs/2026-07-17-full-system-audit-program.md`

## Change log

- 2026-07-18 Claude: reviewed Antigravity's UI-REMED-1 visual smoke test commit (`2cabde9`) independently rather than trusting the self-report — read all 10 file diffs (Alert/Badge/Button/LoadingButton primitives, POSScreen toasts/modals, login/settings-password error states, ModifierForm, ActivityLogClient, SemiProductsClient), confirmed every change is a semantically-equivalent raw-color-to-token swap with no logic change, including a genuine typo catch (`bg-primary-soft0`, an invalid class, silently rendering no background). Independently reran the suite (422/422) and production build (success) rather than trusting the claims. Approved and moved to `COMPLETED.md`.
- 2026-07-18 Claude: owner resolved SEC-5 — `submitStockAdjustment` is being locked to ADMIN (stock adjustment is manager/admin responsibility, not staff). Folded into Wave 1 handoff before Codex picked it up, removed from Blocked. Also corrected Antigravity's own "(verified)" self-report on the UI-REMED-1 visual smoke test to `[!]` pending Claude review — a self-report isn't a completed second-party review, same principle as the scripts/ self-review rule.
- 2026-07-18 Claude: Gate 2 reviewed and closed (commits `3570da0`, `f14b092`). Independently reran the suite (422/422) and TypeScript (clean), then directly read source for the 4 highest-risk claims before trusting them — confirmed the POS SYSTEM-actor fallback, the zero-guard `deletePOSDraft`/`getPOSDrafts`, the `submitStockAdjustment` PENDING-vs-approved distinction, and the Edge Function's unsigned service-role JWT check all hold up exactly as reported. Split the 25 findings into 2 scoped remediation waves (P0: POS + Edge Function signature; P1: 20 admin-read guards) rather than one big unreviewed fix. Flagged `submitStockAdjustment`'s policy as a genuine business decision (changes who can currently do what, not just security posture) rather than letting Codex decide unilaterally. Flagged Edge Function deployment-config verification as needing dashboard access, not a code task.
- 2026-07-18 Claude: found genuine ready work for idle Antigravity (user asked directly) rather than inventing busywork — UI-REMED-1's visual smoke test was closed on automated checks only and never actually looked at in a browser. Authored handoff, added as P2, cleaned up the stale "pending prompts" list (Pre-Audit C was listed as still needing pickup despite being closed weeks-equivalent ago in session time; added Gate 1/Gate 2 entries).
- 2026-07-18 Claude: scoped and authored Gate 2 handoff. Read `lib/admin-auth-guard-audit.ts` directly and found 3 concrete blind spots in the existing audit tool before writing the handoff: it only scans `app/admin/` (misses `app/pos/actions.ts` and `app/actions/auth.ts`), its mutation-name prefix list misses void/reject/create/change-named functions (this is exactly why `rejectEventAction`'s Gate 1 gap wasn't caught by the tool itself), and its guard check only tests for substring presence, not enforcement, and misses arrow-function exports entirely. Gate 2 scope: fix the tool, extend it to API routes, produce a dated evidence report, remediate small unambiguous findings, cap silent remediation at 5 items before requiring a stop-and-report.
- 2026-07-18 Claude: Gate 1 reviewed and closed (commits `dd2f970`, `57d298a`, `9a8ee66`). Independently reread every diff line, confirmed the remaining `select('*')` never leaks to a response, read all 5 new regression tests, and reran the suite (414/414) and TypeScript (clean) rather than trusting the report. Moved to `COMPLETED.md`. Opened Gate 2 (architecture/access map) as P1 — scoped pragmatically since the source spec's own Gate 2/Phase 3 text is incomplete.
- 2026-07-17 Claude: owner triggered the full eight-gate audit program after reviewing Pre-Audit C findings. Froze baseline `24a57bd`, updated the program spec status to ACTIVE, folded SEC-1/SEC-2/SEC-3 into a Gate 1 handoff (`docs/handoffs/2026-07-17-codex-gate1-p0-security-exposures.md`) since they are security exposures; kept FIX-1/FIX-2 as separate P2 functional-bug backlog. Gate 1 open for Codex, P0.
- 2026-07-17 Claude: closed Pre-Audit C review (commit `99f466d`). Independently re-derived the 4 most consequential findings from source code rather than trusting the write-up: broken password-change feature, unguarded backdated-ledger approval action, 2 unauthenticated maintenance routes, manual backup button calling the legacy path. Precise per-row status count matches claim exactly (15/18/14/3/0/1 = 51). Added 5 concrete P2 backlog items with evidence. Opened "next audit stage" as a Blocked/owner-decision item — F&B 17-section checklist vs eight-gate audit trigger.
- 2026-07-17 Claude: closed Pre-Audit B execution review. Independently reproduced all claims (10/10 canonical docs, 64/64 links, 403/403 tests, TS clean, build clean 41 routes, 7 SUPERSEDED + 1 DUPLICATE banners spot-checked). Authored Pre-Audit C handoff (`docs/handoffs/2026-07-17-codex-pre-audit-c-feature-inventory.md`), scoped to the 15-module FEATURE-CATALOG population pass; deferred the full F&B capability checklist as a separate follow-up. P1 unblocked for Codex pickup.
- 2026-07-17 Codex: Pre-Audit B execution created/refreshed the ten canonical entry documents, preserved Tier 2/3 sources, and moved Pre-Audit C to the next P1 gate. Pending Claude review; no push.
- 2026-07-17 Claude: UI-REMED-1 saga closed. All 5 phases done (commits `c33033f` + `8f93742` + `d239cbb` + `55ef69d` + `ee33450`). ~94% color migration coverage (145 raw occurrences remain — ui/* primitives + gradient stops + complex utility classes). TS clean, build clean, 403/403 tests pass. Visual smoke test pending. UI-REMED saga 5/5 + 1 polish complete. ROADMAP cleaned up duplicate P1 sections.
- 2026-07-17 Claude: UI-REMED-1 async overnight brief authored. User sleeping, Antigravity authorized to run 5-phase TOKEN-SWAP migration overnight. NO PUSH rule. Final report to `docs/reports/ui-remed-1-overnight-report.md` for morning Claude review.
- 2026-07-17 Claude: UI-REMED-5 closed (commit `11c566b`, reviewed). Button warning variant + Dialog icons by variant. UI-REMED saga 4/5 + 1 polish complete. ROADMAP cleaned up duplicate P1 sections. Only UI-REMED-1 TOKEN-SWAP remaining (P2, largest, multi-session).
- 2026-07-17 Claude: UI-REMED-4 closed (commit `c923086`, reviewed). Root error/loading boundaries + 5 missing loading.tsx. UI-REMED saga 4/5 done. P1 cleared. Last: UI-REMED-1 TOKEN-SWAP.
- 2026-07-17 Claude: UI-REMED-3 Session 2 closed (commit `2f91b3f`, reviewed). All 52 native alert/confirm migrated to Dialog API. Independent grep confirms 0 remaining. UI-REMED-3 saga complete (Sessions 1+2). P1 cleared.
- 2026-07-17 Claude: UI-REMED-3 Session 1 closed (commit `dd51dae`, reviewed). Dialog API + components + proof-of-concept migration done. Opened Session 2 (bulk migrate 53 call sites across 18 files) as new P1.
- 2026-07-17 Claude: UI-REMED-3 split into 2 sessions. Authored Session 1 handoff (Dialog primitive + lib/dialog imperative API + DialogHost + proof-of-concept migration). Session 2 (bulk migration 53 call sites) deferred to next handoff.
- 2026-07-16 Claude: UI-REMED-2 closed (commit `6b65aba`, reviewed). StickyFilterBar redesigned with design tokens, API + sticky + mobile expand preserved. 16 clients auto-inherit. P1 cleared → next UI-REMED-3 REPLACE-ALERT.
- 2026-07-16 Claude: Task 3.10 closed (commit `6a5bdec`, reviewed). Audit OPERATIONALLY CLEAN exit 0. MAC drift saga complete (E3 → Task 3.10). P1 cleared.
- 2026-07-16 Claude: User + Codex chose Task 3.10 Option B (accept informational, no DB write) + improve audit display. Authored handoff brief. Small scope ~30 min Codex.
- 2026-07-16 Claude: Task 3.5 closed (commit `c28319d`, reviewed). 4-bucket classifier + sub-classification for LOCKED_VIOLATION. 16 LOCKED_VIOLATION_REPLAY surfaced = E3 baseline lines also affected by BTP drift. Opened Task 3.10 (P1, user decision required: re-classify vs accept).
- 2026-07-16 Claude: User picked up Task 3.5 (cohort-aware MAC drift baseline audit) after Phase 3 push. Authored handoff brief. Promoted from P3 to P1. Other Task 3.5 P3 items remain deprioritized (V1 wait-for-event, UI-CONSISTENCY-1).
- 2026-07-16 Claude: Stabilization Phase 3 closed. Build gate passed, 2 close-out commits (`86f2b89` + `3a55939`), fast-forward push to `origin/main` (HEAD now `3a55939`). 50+ commits live on GitHub. Vercel auto-deploys. Stabilization saga complete.
- 2026-07-16 Claude: Stabilization Phase 2 closed (commits `98557ed` + `0fb8f9d` + `9dddc4a`, reviewed). Production verified: Apps Script pull-model, 32 tables, daily+monthly retention, file xuất hiện trong Drive. Backup ownership added to COLLABORATION.md Section C (Codex owns backup architecture). P1 cleared → opened Stabilization Phase 3 (push 70+ commits) as new P1.
- 2026-07-16 Claude: Task 3.9 closed (commit `09bf26a`, reviewed). MAC drift audit fully clean (436 locks). Phase 1 UI audit closed (commit `cdc8d56`, reviewed). 1279 issues → 4 post-push remediation backlog items (UI-REMED-1 to 4). P1 cleared → opened Stabilization Phase 2 (Drive backup) as new P1.
- 2026-07-16 Claude: Task 3.8 closed (commit `ad7f7ba`, reviewed). 41 lines map to 5 historical ledger rows, 0 durable events (migration 0014 gap). User chose Option A (accept as drift). Authored Task 3.9 handoff brief for lock cohort.
- 2026-07-16 Claude: User chose walk-through approach A (Codex surface first). Authored Task 3.8 handoff brief for read-only investigation: map 41 BACKDATED_LEDGER_LIKE line IDs to `backdated_ledger_events` + status breakdown. Old P2 "Task 3.2 review path" row removed (subsumed by Task 3.8 in P1).
- 2026-07-16 Claude: Task 3.7 final review approved (commit `d2177ca`). 170 → 395 locks, 225/225 cost unchanged, idempotent rerun `ALREADY_APPLIED`. Moved to `COMPLETED.md`; P1 cleared. MAC drift audit clean except 41 BACKDATED_LEDGER_LIKE (Task 3.2 path).
- 2026-07-16 Claude: User chose Option B (accept + lock). Authored policy doc `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md` and handoff brief `docs/handoffs/2026-07-16-codex-task-3.7-btp-drift-lock.md`. Task 3.7 marked `[~X]`, ready for Codex pickup.
- 2026-07-15 Claude: Task 3.6 closed (commit `d32d4d4`, Claude reviewed). Root cause: nested BTP recipe snapshot not pinned in audit replay; stored COGS correct at sale time. Opened Task 3.7 as P1 decision task (user picks remediation path A/B/C).
- 2026-07-15 Claude: Task 3.4 closed (commit `fea097d`, Claude reviewed). Moved to `COMPLETED.md`. Opened Task 3.6 forward-drift investigation as new P1. Added 2 backlog items: 41 BACKDATED_LEDGER_LIKE review path, 112 historical drift acceptance decision.
- 2026-07-15 Claude: authored Task 3.4 read-only handoff brief (`docs/handoffs/2026-07-15-codex-task-3.4-outside-cohort-investigation.md`). P1 ready for Codex pickup. Marked `[~X]` in priority queue.
- 2026-07-15 Claude: E3 final review complete. Six cohort gates pass, audit trail intact (snapshot/source/run IDs), rollback procedure documented. E3 moved to `COMPLETED.md`; P0 cleared.
- 2026-07-13 Codex: closed E3 after atomic 40-line recovery and added Task 3.4/3.5 follow-ups.
- 2026-07-10 Claude: created as single source of truth. Superseded `docs/handoffs/2026-07-09-codex-roadmap.md` and `docs/handoffs/2026-07-06-antigravity-roadmap.md` (both deleted).

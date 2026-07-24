# Full System Re-Audit and Improvement Plan

Date: 2026-07-24
Author: Claude (read-only audit — no code or data changed in this pass)
Status: PROPOSED — awaiting owner priority decision before any task starts

## Tóm tắt cho chủ quán (đọc phần này là đủ)

Em rà lại toàn bộ hệ thống hôm nay. **Tin tốt: phần lõi đang khỏe.** Code không có lỗi
biên dịch, toàn bộ 673 bài kiểm tra tự động đều đạt, báo cáo lãi lỗ khớp giá vốn từng
đồng (0 lệch trên 1.677 đơn), số lượng tồn kho lý thuyết đã khớp hoàn toàn sau đợt
tính lại hôm qua, bản sửa mới nhất đã lên GitHub và cấu trúc database đã đồng bộ đủ.

**Các điểm chưa tốt, xếp theo mức ảnh hưởng đến việc kinh doanh:**

1. **Tồn kho âm 3 nguyên liệu** — Sữa đặc (-4.221 g), Lá hồng trà (-2.009,6 g),
   Siro việt quất (-190 ml). Riêng Lá hồng trà: hệ thống ghi nhận nấu hết 2.209 g
   nhưng chỉ có 200 g nhập vào — gần như chắc chắn **thiếu đơn nhập hàng chưa ghi**.
   Việc này chỉ anh làm được: đếm thực tế 3 món này + soát lại đơn nhập bị sót.
2. **2 đơn test còn nằm trong dữ liệu thật** (PHD001128, PHD001129 — Trứng luộc
   5.000đ, tạo hôm qua khi em kiểm tra máy bán hàng) — nên bấm Hủy đơn để báo cáo
   không bị lệch 10.000đ.
3. **Chưa cài chìa khóa cho việc tự sửa giá vốn hằng ngày** (`CRON_SECRET` trên
   Vercel) — hệ thống tự phát hiện + sửa giá vốn khi có nhập hàng ghi lùi ngày đã
   xây xong nhưng chưa chạy tự động vì thiếu chìa khóa này. Anh cài 1 lần là xong.
4. **Chưa từng diễn tập khôi phục dữ liệu từ file sao lưu** — sao lưu hằng ngày đang
   chạy tốt, nhưng chưa ai chứng minh là khôi phục được khi có sự cố thật. Cần 1 buổi
   diễn tập vào môi trường thử.
5. **4 việc đang chờ đội kiểm tra (Codex) quay lại ngày 25/07** — quan trọng nhất là
   truy tận gốc lỗ hổng khiến giá vốn có thể sửa thiếu khi 1 nguyên liệu có 2 đợt
   nhập lùi ngày liên tiếp (đã vá số liệu cũ, nhưng cơ chế gây lỗi vẫn còn).
6. **Topping hiện sai chỗ** — món nào cũng thấy cùng 1 danh sách topping (trứng luộc
   thấy topping cà phê). Cần thiết kế nhỏ: topping gắn theo món/nhóm món.
7. **Vài trang quản trị còn tải nguyên bảng dữ liệu** (nhật ký hoạt động, cân bằng
   kho, khuyến mãi) — cùng loại lỗi đã sửa cho trang chủ/danh sách đơn tuần này;
   sẽ chậm dần theo thời gian nếu không sửa nốt.
8. **Khoảng 21 tính năng có màn hình + code nhưng chưa ai đi thử trọn vẹn với vai
   người dùng** — nên làm 2-3 buổi đi thử có kịch bản cùng anh, mỗi buổi ~30 phút.
9. Đã hoãn có chủ đích (không phải quên): đối soát tiền mặt theo ca (chưa có nhân
   viên), bán hàng khi mất mạng, phân quyền chi tiết + thu hồi phiên đăng nhập
   (làm ở giai đoạn bảo mật, sau đa chi nhánh), xuất file Excel/CSV cho báo cáo.

**Kế hoạch đề xuất: 5 đợt, chi tiết task ở phần B bên dưới.** Đợt 1 là việc của anh
(30-45 phút, không cần code). Đợt 2 là việc Codex làm ngay khi quay lại. Đợt 3-5 em
đề xuất thứ tự nhưng anh quyết. Chưa việc nào bắt đầu cho đến khi anh chốt.

---

## A. Audit evidence (technical, English)

### A.1 Fresh checks run this session (2026-07-24, all read-only)

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Full test suite (`vitest run`) | 673/673 pass, 119 files |
| `scripts/audit-pnl-mac-consistency.ts` (live) | 1,677 orders, 23,746,558 VND COGS, product/ingredient deltas both 0 VND |
| `scripts/audit-current-stock.ts` (live) | 48 items, 3 negative (see A.2) |
| `npx supabase migration list` | 0001–0034 all applied local+remote (incl. 0033 shift checks, 0034 ledger rebuild) |
| `git rev-list origin/main..main` | 0 unpushed commits; `origin/main` = `464bac9` (2026-07-24) |
| Quantity/production audit | Not rerun today; 2026-07-24 rerun after the ledger rebuild recorded 0/54 quantity diffs, 0/116 PO_RECEIPT diffs, 0 production findings (see `DEVELOPMENT-TRACKING.md` 2026-07-24 rebuild entry) |

### A.2 Findings register

Severity uses the audit program's P0–P3 scale. No P0 found.

| ID | Sev | Finding | Evidence | Disposition |
|---|---|---|---|---|
| F-1 | P1 | Negative stock, 3 ingredients: `ING-003` Sữa đặc -4,221 g; `ING-021` Lá hồng trà -2,009.583 g; `ING-024` Siro việt quất -190 ml. `ING-021`'s profile (PRODUCTION_CONSUME -2,209.583 vs PO_RECEIPT +200) strongly suggests unrecorded purchases, not a calculation bug. Balances grew after the 07-24 ledger rebuild because the rebuild removed compensating rows that had been masking true theoretical balances. | `audit-current-stock.ts` today | Blocked on owner physical count (long-standing out-of-scope rule). Owner action → then STOCK_ADJUST via Cân bằng kho + backfill missing POs |
| F-2 | P2 | 2 test orders (`PHD001128`, `PHD001129`) live in production from 07-24 Playwright verification | Tracking entry 07-24 | Owner (or Claude on request) voids via existing flow |
| F-3 | P1 | `CRON_SECRET` not set in Vercel → `/api/cron/apply-backdated-corrections` never runs on schedule; backdated-cost auto-correction pipeline is built but dormant | ROADMAP `COGS-1-FOLLOWUP` | Owner env-var action, 5 min |
| F-4 | P1 | Backup restore has never been drilled (`BKP-RESTORE` = PLANNED). Daily snapshot verified; restorability unproven | FEATURE-CATALOG §13 | Codex task, needs safe target env + runbook execution |
| F-5 | P1 | COGS-5 root cause still open: mechanism that let 41 lines receive only partial correction when a second backdated event touched the same ingredient is not fixed — live risk for future backdated receipts | ROADMAP `COGS-5` | Codex (back 2026-07-25) |
| F-6 | P2 | REV-2/REV-3/REV-4 retroactive reviews outstanding (Claude-authored engine work unreviewed: Gate-8 script fixes, FC-1 split payment RPC, FC-2 reorder suggestion) | ROADMAP | Codex, first session back |
| F-7 | P2 | `scripts/audit-order-ledger.ts` methodology obsolete post-rebuild (3,585 stale mismatches; self-referential recompute diverges from new ground truth) | ROADMAP `AUDIT-TOOL-1` | Retire or rebuild on `lib/full-history-recompute.ts` |
| F-8 | P2 | Full-table-load pattern remains in: `app/admin/activity-log/page.tsx` (full `Order_Events` + `Orders_V2` — fastest-growing tables), `app/admin/reports/stock/page.tsx` (`Stock_Adjustments`), promotions/stock-adjustments client-side filtering (PERF-1); void/edit paths fetch full `Stock_Ledger` (`app/admin/orders/actions.ts:416,484`) where an end-date upper bound is provably safe (same argument as the 07-24 P&L fix) | grep this session | Codex/Claude, same pattern as this week's dashboard/orders fixes |
| F-9 | P2 | Topping list at POS checkout is global — no per-product/category association exists in the data model; boiled egg shows coffee toppings | Tracking 07-24 | Needs small feature design + owner approval |
| F-10 | P2 | 21 capabilities remain `LIVE_UNVERIFIED` (no operator walkthrough): brand CRUD, POS catalog completeness, drafts, modifiers, suppliers, conversions, inventory master data, semi-product CRUD, backdate review UI, activity log, cache tools, etc. | FEATURE-CATALOG counts | Scripted UAT sessions with owner; update catalog statuses |
| F-11 | P2 | Shift stock check (built 07-23) never live-verified (no real open/close cycle); "Khoai lang" still has no linked ingredient/recipe so selling it deducts nothing and the shift check covers only Trứng luộc | Tracking 07-23 | Owner creates ingredient+recipe (self-assigned); then 1 live verify cycle |
| F-12 | P2 | No post-deploy smoke test; production incidents so far diagnosed ad-hoc (PROD-BUG-1 pattern). Client-error logging exists but has no alerting, Vercel-log-only retention | FEATURE-CATALOG §15 | Small Playwright smoke script + runbook note |
| F-13 | P3 | No CSV/spreadsheet export on any report | FEATURE-CATALOG §10 | Feature decision for owner |
| F-14 | P3 | Session lifecycle: role change/deactivation does not revoke live sessions; single ADMIN/STAFF technical role model | ACCESS-MODEL, deliberately deferred to roadmap item 6 (security hardening) | Keep deferred; do not pull forward |
| F-15 | P3 | Broad `revalidatePath("/pos")` on rare admin toggles; missing `icon.png` 404s on every page; 61 VND aggregate rounding residue across 10 order lines | Tracking 07-24 | Batch into a small cleanup task |
| F-16 | P3 | Cash/shift reconciliation (FC-3) deferred by explicit owner decision (no staff currently) | ROADMAP P1 | Revisit when staff hired |

### A.3 What was checked and found healthy (no action)

- COGS/P&L consistency 0 VND delta; stored `cost_at_sale` authoritative; quantity ground-truth rebuild verified against owner's own manual math (egg chain 335/375/0).
- All 5 critical write flows atomic (void, supersede, product save, production, stock adjustment) + POS checkout idempotent under retry (Gate 4B/5, live-probed).
- Auth guards: 83/83 actions guarded (Gate 2), RLS default-deny confirmed live (Gate 3), no unauthenticated mutation paths known.
- Backup: daily pull-model snapshot verified in production, 32/32 tables, retention policy documented.
- Repo hygiene: docs canonical set current, scripts pruned 220→133, file-organization rule in effect.

## B. Proposed implementation plan (5 waves)

Waves are sequenced by owner's stated priority order (functions work → no
congestion → speed → accurate recording → integrity → clean input). Nothing starts
without owner go-ahead; Wave 1 is owner-only actions.

### Wave 1 — Owner actions, no code (this week, ~30–45 min total)

| Task | What | Time |
|---|---|---|
| W1.1 | Set `CRON_SECRET` in Vercel project env vars (Claude provides the value + click path when owner is ready) → F-3 | 5 min |
| W1.2 | Void test orders `PHD001128`/`PHD001129` via Hủy đơn (or tell Claude to) → F-2 | 2 min |
| W1.3 | Physical count: Sữa đặc, Lá hồng trà, Siro việt quất; check for unrecorded purchases (esp. Lá hồng trà). Report numbers → agents apply STOCK_ADJUST + backfill POs via existing flows → F-1 | 20 min |
| W1.4 | Create "Khoai lang" ingredient + link recipe via UI (owner self-assigned 07-23) → F-11 half | 10 min |

### Wave 2 — Codex return backlog (from 2026-07-25, ~2–3 sessions)

| Task | What | Verify |
|---|---|---|
| W2.1 | REV-2/3/4 retroactive reviews of Claude's engine work → F-6 | Independent rerun of each item's tests + live probes |
| W2.2 | COGS-5 mechanism root-cause: trace why `findAffectedLines`/`apply-pending-backdated-events` skips a line's second applicable event; fix + regression test → F-5 | Synthetic two-event scenario corrects fully |
| W2.3 | AUDIT-TOOL-1: retire `audit-order-ledger.ts` or rebuild it as a thin wrapper over `lib/full-history-recompute.ts` dry-run → F-7 | Tool reports 0 on the rebuilt dataset |

### Wave 3 — Remaining performance debt (1–2 sessions, Claude or Codex)

| Task | What | Verify |
|---|---|---|
| W3.1 | Activity log: server-side pagination on `Order_Events` (mirror this week's orders-list rebuild) → F-8 | Parity vs old output on same window; page < 1 s |
| W3.2 | Stock-adjustments + promotions pages: push filters server-side or drop pointless URL-sync navigation (PERF-1) → F-8 | No server refetch on keystroke |
| W3.3 | Upper-bound `Stock_Ledger` fetches in void/edit MAC paths (`created_at <= order date` is safe by the same argument as the P&L fix) → F-8 | Void/edit outputs unchanged on live probes |
| W3.4 | Cleanup batch: `icon.png`, narrow `revalidatePath` on rare toggles → F-15 | No 404 in console; POS unaffected |

### Wave 4 — Operational reliability (2–3 sessions + 1 owner hour)

| Task | What | Verify |
|---|---|---|
| W4.1 | **Restore drill**: restore latest Drive snapshot into a scratch Supabase project per runbook; row-count + spot reconciliation; write drill report → F-4 | Restored DB matches manifest counts |
| W4.2 | Live-verify shift stock check: open + close one real shift, confirm variance math → F-11 | Variance matches manual count |
| W4.3 | Scripted UAT: 2–3 sessions with owner covering the 21 `LIVE_UNVERIFIED` capabilities; update FEATURE-CATALOG statuses → F-10 | Catalog re-baselined |
| W4.4 | Post-deploy smoke script (login → POS test sale → void → 3 reports) + runbook note → F-12 | Script passes against production after next deploy |

### Wave 5 — Feature gaps needing owner scope decisions

| Task | What | Decision needed |
|---|---|---|
| W5.1 | Per-product/category topping association (small data model + POS filter + admin UI) → F-9 | Approve design first |
| W5.2 | CSV export for sales/P&L/stock reports → F-13 | Wanted now or with UI phase? |
| W5.3 | Simple failure alerting (backup failure, negative stock threshold) → F-12 | Channel choice (email/Zalo/none) |
| W5.4 | FC-3 cash reconciliation — stays deferred until staff exist → F-16 | Revisit trigger |

After Wave 5, the long-term roadmap continues as already agreed: UI/UX unification →
multi-branch → security hardening (F-14 lands there) → franchise (if ever).

## C. Explicitly out of scope for this audit

- Any production data write (none performed).
- Re-litigating closed gates 1–8 — spot-verified via fresh reruns instead.
- Offline POS (owner decision D2), multi-branch, franchise — sequenced in roadmap.

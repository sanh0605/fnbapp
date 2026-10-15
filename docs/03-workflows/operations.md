# Operations flow (outlets, brands, activity log, cache)

```flow-decl
routes: /admin/outlets, /admin/outlets/new, /admin/outlets/[id], /admin/outlets/[id]/edit, /admin/brands, /admin/brands/new, /admin/brands/[id], /admin/brands/[id]/edit, /admin/activity-log, /admin/clear-cache, /admin/dashboard-settings
files: app/admin/outlets/actions.ts, app/admin/brands/actions.ts, app/admin/dashboard-settings/actions.ts
tables: Outlets, Brands, Dashboard_Settings
brCodes: BR-SALE-006, BR-SALE-007, BR-CASH-009
```

**Behaviour change — 2026-10-15 (Bán hàng đợt 3, A4a):** deleting a brand no longer counts dishes by `products.brand_id`, a column nothing writes; migration `0121` drops it. Outlets, promotions and orders still block the delete.

**Behaviour change — 2026-10-15 (Bán hàng đợt 2, `BR-SALE-006`):** a stopped outlet can be reopened. `reactivateOutlet` (`app/admin/outlets/actions.ts`, ADMIN only) sets it back to `ACTIVE` and clears its end date; it keeps its code, so its order numbers carry on. The outlet's page shows "Mở lại hoạt động" only while it is stopped.

**Behaviour change — 2026-10-15 (Máy bán hàng bước 2, `BR-SALE-015`):** the "Đồng bộ máy bán" page `/admin/pos-sync`, the sync-failure table `pos_sync_failures` (dropped by migration `0129`, run after the push) and the Tổng quan alert that linked to them are removed: the till no longer queues orders offline, so nothing is left to sync.

**Behaviour change — 2026-10-14 (audit F1):** `getActiveOutlets` (`app/admin/outlets/actions.ts`) feeds "Chọn điểm bán" in the admin layout, so a stopped outlet no longer appears; `/pos` redirects to `/admin` for a non-`ACTIVE` outlet and `submitOrderV2` refuses it ("Điểm bán này đã ngừng hoạt động"). A till already open at an outlet that is then stopped gets its next orders refused. Tổng quan's "Nhập" on a monthly-expense reminder now sends the reminder's month (audit B2): the new cash-book entry is dated the last day of that month when it is not the current month, and saving returns to Tổng quan.

**Behaviour change — 2026-10-14 (Cài đặt Tổng quan, migration `0109`):** a new page `/admin/dashboard-settings` under Cài đặt edits the single `dashboard_settings` row. It holds:
- the days before "lâu chưa kiểm kê" fires (30) and before an open stock count is flagged (2), each 1–365;
- the reminder start day for monthly expenses (25, 1–28);
- the dishes that get a food column in the 7-day table (Trứng luộc, Khoai lang);
- the Loại món counted as "Topping mua riêng" (Topping, or none).

The server checks every range; an out-of-range value is named under its box. Saving applies at once and nothing past is stored (`BR-SALE-007`, `BR-CASH-009`).

**Behaviour change — 2026-10-03 (list/detail template, wave 5):** Điểm bán and Thương hiệu
are tables on desktop and cards on phone; each row opens `/admin/outlets/[id]` or
`/admin/brands/[id]`, and editing starts only from there. Điểm bán gains a status filter
(Đang hoạt động by default, Ngừng hoạt động, Tất cả); its bin, "Ngừng hoạt động", shows only
under Đang hoạt động and still refuses the last active outlet. `deleteBrand` now refuses a
brand still in use in Vietnamese, naming what uses it ("Không xoá được thương hiệu "Phin Đi":
còn 1 điểm bán, 2.357 đơn hàng."), instead of the database's raw refusal.
**Reviewed, no behaviour change — 2026-09-07 (Task 17):** a declared source file's import path only -- outlet-code.ts moved to `lib/catalog/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 11):** a declared source file's import path only -- lib/auth.ts moved to `lib/auth/auth.ts`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 10):** a declared source file's import path only -- cross-cutting lib/ helpers (action-error, datetime, dialog, duplicate-name-guard, use-filter-form, nav-completeness, client-error-report, report-time) moved to `lib/shared/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07:** a declared source file's comments only — dead `CLAUDE.md` section-number pointers replaced with section headings; no logic changed. (Lands together with the source files in this commit.)

This flow covers the operational back-office screens: the two **outlets** (`001`
and `002`), the two **brands** they carry, the
**activity log**, and the **cache** tool. The shop runs two outlets, each bound
to exactly one brand — outlet `001`/`002` carry Phin Đi and Uchako — over a
single shared warehouse (`docs/01-system/SYSTEM-OVERVIEW.md`, "Kho dùng chung").
A brand always follows the outlet, never the reverse: the order code is
`YYMMDD` + outlet + sequence and `brand_id` is derived server-side from the
outlet at the moment of sale (`BR-SALE-006`). Outlet and brand records are
edited from `app/admin/outlets/actions.ts` and `app/admin/brands/actions.ts`.
The activity-log and
clear-cache screens are operational tools that read or reset runtime state and
write no business table.

## Five-question current-state description

1. **States, and how each is set.** An outlet and a brand are simple records:
   each exists and is either active or not, set from its admin screen. The activity log
   and the cache tool hold no persisted business state of their own: the activity
   log reflects events that already happened, and the cache tool only clears
   cached data on demand.
2. **Buttons per screen, and when to hide them.** The outlets list at
   `/admin/outlets` offers "+ Thêm điểm bán" and the bin "Ngừng hoạt động" (only
   while the filter is Đang hoạt động); the detail page offers "Chỉnh sửa" and,
   for an active outlet, "Ngừng hoạt động". An outlet is never hard-deleted, and
   the last active one cannot be retired. The brands list offers "+ Thêm thương
   hiệu" and the bin "Xoá"; the detail page "Chỉnh sửa" and "Xoá". Delete is
   ADMIN-only per `BR-ACCESS-003` (owner decision 2026-09-08, `requireOwner`),
   with the bin hidden for anyone else (`canDelete` from `resolveActor()`), and a
   brand still used by an outlet, promotion, dish or order is refused with those
   counts. The clear-cache screen at
   `/admin/clear-cache` offers a single action to clear cached data — a
   deliberately blunt operational tool. The activity-log screen at
   `/admin/activity-log` is read-only and offers no create/edit/delete, because
   it is a record of what already happened.
3. **What each list contains, and what is excluded.** The outlets list contains
   the outlets (`001`, `002`) of the chosen status, active by default; the brands list contains the brands each outlet
   carries. The activity log contains operational events for review. None
   of these lists contains sales, stock, or cost figures — those live in their
   own flows (sales, stock issue, reports).
4. **Valid inputs, and what happens outside the range.** An outlet needs its
   identifying fields and a brand binding; a brand needs its identifying fields.
   The clear-cache tool takes no data input — it performs one reset action. Because outlet and brand are referenced by
   orders, they are not hard-deleted while orders depend on them; an outlet or
   brand no longer in use is deactivated, not removed, so historical orders stay
   explainable.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   the operational configuration of the shop — its outlets, its brands — plus two runtime tools (activity log, cache).
   It deliberately does not serve the sale itself: the completed sale is written
   by the till, not by these screens. It does not compute cost or
   stock, and the activity-log and clear-cache screens deliberately write no
   business table at all.

## Where it writes

The two write-path files map to exactly two business tables:
`app/admin/outlets/actions.ts` writes `Outlets` and
`app/admin/brands/actions.ts` writes `Brands`. The generated map at
`docs/generated/system-map.md` confirms these write relations.

The activity-log (`/admin/activity-log`) and clear-cache (`/admin/clear-cache`)
routes have real screens but no entry in the generated map's write relations,
because they write no business table — the activity log reads events and the
cache tool resets cached data. This is why their pages appear under `routes:` but
their files do not appear under `files:`.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md

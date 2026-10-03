# Rà soát lệch giờ toàn hệ thống — Implementation Plan

> **For agentic workers:** server-side tasks (1–3) to Sonnet (Agent tool, model `sonnet`); browser components (Task 4) to Gemini via `agy` (newest generation at its highest level, checked with `agy models` at hand-off). Opus proves the guard red on the old code, reviews, runs the five gates, commits. Sonnet first critiques this plan and reports disagreements before coding. Steps use checkbox (`- [ ]`) syntax.

**Goal:** every day and clock time the app computes, filters or shows is Asia/Saigon wherever the code runs, and a test fails the next time someone writes it otherwise.

**Why now.** Owner, 2026-10-04: *"Anh thấy lỗi em phát hiện đã xuất hiện hình như là lần thứ 4 rồi, chắc nên soát toàn diện lỗi này cho toàn hệ thống"*. Earlier fixes of the same shape: commits `7bc58b5e` (sales charts bucketed by UTC), `32238270` (asset `acquired_date` a day early, plus two more sites), `b719fe86` (cash book "today" default). Each fixed the site in front of it; nothing stopped the next one. This plan fixes all known sites **and** adds the guard.

**Architecture:** no new concept. Every site moves to the helpers that already exist (`lib/shared/datetime.ts`, `lib/shared/report-time.ts`), plus one new helper `saigonToday()`. A source-scanning test in `lib/shared/timezone-guard.test.ts` refuses the risky patterns outside a short allowlist with reasons, the way `lib/auth/delete-guard.test.ts` guards deletes.

**Tech Stack:** Next.js 14, TypeScript, Vitest.

**Spec:** none needed — no new table, screen or concept. The rules already say it: `BR-DATA-006` (*"Every date filter chooses whole days … in Saigon time"*) and the "time still shows, as 00:00:00" paragraph after it. This plan enforces them.

## Hiện trạng

1. **Trạng thái.** Không áp dụng, vì no record changes state; only how days and hours are computed and shown.
2. **Nút.** Không áp dụng, vì no button is added or removed.
3. **Danh sách.** Lists whose rows or filters change: order list (`/admin/orders`), activity log, dashboard, sales report (default range, hour × weekday chart), purchase-order detail header, item purchase history, issued-goods report, daily report label. Exactly the rows of the days chosen, in Saigon time, after the fix.
4. **Ô nhập.** Date filters keep accepting `YYYY-MM-DD` / dd/MM/yyyy as today; what changes is the time window a day means (00:00:00–23:59:59.999 Saigon).
5. **Dữ liệu.** All timestamps (`timestamptz`) and day-only fields. Not touched: stored data (no migration, no rewrite — every stored instant is already correct; only the reading was wrong); SQL (all functions and views already use `at time zone`, checked by the audit).

**Why it hides.** The owner's machine runs in Saigon time, so on `localhost` every one of these sites is right. On Vercel the server runs in UTC, so the same code is 7 hours off. Browser code is right on a phone or laptop set to Vietnam time, but Next.js renders "use client" components on the server first, so the first paint can still show the UTC value.

## Audit (2026-10-04)

Method: a Haiku search (patterns: date strings without offset, local-clock getters/setters, `toISOString().slice/split` for a day, `toLocale*String`/`Intl.DateTimeFormat` without `timeZone`, date libraries, SQL casts without `at time zone`), then Opus re-ran every pattern with `grep` and read each hit. Haiku missed `app/admin/reports/actions.ts:797-798` (a real bug, below); its other findings held. Zero hits: date-fns/dayjs (not used); SQL in migrations (all use `at time zone`).

**Measured on the real data, 2026-10-04 (read only):** 668 of 3.183 completed orders were created between 06:00 and 06:59 Saigon time (the shop opens at 6) — on a UTC server those fall on the **previous** day. 165 of 198 purchase orders are dated before 07:00 Saigon time (mostly 00:00:00, the form asks only for a day) — shown in UTC they read **one day early**.

### A. Server — wrong on the live site

| # | Site | What the owner sees on the live site |
|---|---|---|
| A1 | `app/admin/orders/page.tsx:10-15` | Order list "from/to" = 07:00 Saigon to 06:59 next day: the day's 06:00–06:59 orders missing, next morning's included |
| A2 | `app/admin/activity-log/page.tsx:8-14` | Same window shift on the activity log |
| A3 | `app/admin/page.tsx:38-45` | Dashboard "hôm nay"/"hôm qua"/this month from the UTC clock: 00:00–06:59 Saigon still shows yesterday |
| A4 | `app/admin/page.tsx:74-107` | Month comparisons bucket orders by UTC month: 06:xx orders on the 1st count in the previous month |
| A5 | `app/admin/page.tsx:239-246` | 7-day chart buckets by UTC day: 06:xx orders land on the previous day |
| A6 | `app/admin/page.tsx:286` | "Cập nhật lúc" shows a time 7 hours behind |
| A7 | `app/admin/reports/actions.ts:796-798` | Sales report hour × weekday chart: every order 7 columns early (a 08:15 order shows at 1h), 06:xx orders on the wrong weekday |
| A8 | `app/admin/reports/sales/page.tsx:16-21` | Default date range from the UTC clock |
| A9 | `lib/stock/issue-slip-warnings.ts:8-12` | "This changes closed months" warning compares UTC months |
| A10 | `app/admin/inventory/purchase-orders/[id]/page.tsx:54` | Header "Ngày tạo"/"Ngày giao dịch" 7 hours behind; a 00:00 slip reads the previous day |
| A11 | `app/admin/inventory/items/[id]/components/PurchaseHistoryView.tsx:48,77` | Purchase history of an item one day early for slips dated at 00:00 |
| A12 | `app/admin/reports/issued/page.tsx:54` | Issued-goods date label in UTC |
| A13 | `app/admin/reports/daily/page.tsx:25` | Daily report label: right on UTC by accident (midnight UTC formatted in UTC); moved to `formatVnDay` so it does not depend on that |

### B. Browser — right on a Vietnam-time device, can flash wrong on first paint

`components/ui/DayInput.tsx:76-78`, `components/ui/DateRangeFilter.tsx:28-30`, `app/admin/orders/OrderTable.tsx:70-77`, `app/admin/reports/daily/DailyDigestFilter.tsx:9-11`, `app/admin/reports/components/SalesFilter.tsx:11-21,76,119-120`, `app/admin/brands/components/BrandForm.tsx:20`, `app/admin/outlets/components/OutletForm.tsx:16`, `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx:16`, `app/admin/promotions/components/PromotionForm.tsx:61,110,114`, `app/pos/components/POSScreen.tsx:1009`, `app/admin/pos-sync/PosSyncClient.tsx:46,81`, `app/admin/inventory/stocktake/components/StocktakeClient.tsx:241`.

### C. Checked and correct (allowlisted with these reasons)

- `lib/shared/date-range-presets.ts:37` — `toISOString().slice(0,10)` of a date built with `Date.UTC`: pure calendar arithmetic.
- `app/admin/inventory/assets/actions.ts:44-45` — shifts now by +7h, then reads the UTC day: the Saigon day.
- `scripts/verify-revenue-core.ts:231,272` — `new Date(y, m, 0).getDate()`: days in a month, the same in every zone.
- `scripts/verify-restore-drill.ts:150` — a file name, not a business day.
- `lib/shared/datetime.ts`, `lib/shared/report-time.ts`, `lib/catalog/outlet-hours.ts`, `app/pos/components/POSScreen.tsx:148` — already pass `timeZone`.

**Worked example (real data).** Order list filtered to 15/09/2026 on the live site today: from 15/09 07:00 to 16/09 06:59 Saigon time. After the fix: 15/09 00:00:00 to 23:59:59.999 Saigon time, matching the cash book's "Bán hàng" rows of that day (23 cash orders, 11 transfer orders, measured 2026-10-04). Sonnet re-measures the 15/09/2026 count both ways with SQL before and after and reports both numbers.

Đã xem: every hit above, line by line; `lib/shared/datetime.ts` (helpers), `lib/shared/report-time.ts` (exports), `lib/shared/date-range-presets.ts`, `docs/02-rules/business-rules/data-integrity.md` BR-DATA-006. Chưa xem: whether `PurchaseHistoryView` is ever imported from a client component (Sonnet checks; if so it moves to Task 4); the full dashboard query code beyond the listed lines.

## Global Constraints

- Use only `lib/shared/datetime.ts` and `lib/shared/report-time.ts` helpers; add a helper there only when none fits, with a test.
- A shown date with a time uses `formatDateTimeFull` (dd/MM/yyyy HH:mm:ss, `BR-DATA-006`); a day alone uses `formatDate` / `formatVnDay`.
- No stored data changes; no migration.
- Every changed site gets a test that fails on the old code **when run with `TZ=UTC`** (the Vercel setting). Opus runs the red check with `TZ=UTC npx vitest run …`.

## Review Focus

1. **A day boundary at 06:59:59 vs 07:00:00 Saigon** — 06:30 on 15/09 belongs to 15/09. Test with `TZ=UTC` in Tasks 1–2.
2. **The first and last day of a month** — an order at 06:10 on 01/10 counts in October. Test in Task 2 (A4).
3. **Running on the owner's own machine** (`TZ=Asia/Saigon`) gives the same answers as `TZ=UTC`. Each new test runs under both (vitest `process.env.TZ` set per file is not reliable — use two `describe` blocks with `vi.useFakeTimers` and fixed instants instead of changing TZ mid-run; Opus runs the whole file under each TZ).
4. **The guard's allowlist** must name file **and** line content, so an allowlisted file cannot hide a new bad line.
5. **Number formatting** (`(1234).toLocaleString("vi-VN")`) must not trip the guard.

---

### Task 1 (Sonnet): helper and the guard

**Files:** Modify `lib/shared/datetime.ts` (+ test); Create `lib/shared/timezone-guard.test.ts`.

**Produces:**
```ts
// lib/shared/datetime.ts
export function saigonToday(now: Date = new Date()): string; // "YYYY-MM-DD", the Saigon calendar day of `now`
```
Guard: scan `app/`, `lib/`, `components/`, `scripts/` (`.ts`, `.tsx`; skip `*.test.*`, `node_modules`, `.next`) line by line for:
- P1 `` new Date(`${…}T `` (a date string built without `Z` or an offset);
- P2 `.getFullYear( .getMonth( .getDate( .getDay( .getHours( .getMinutes( .setHours( .setDate( .setMonth( .setFullYear(` (not the `UTC` forms);
- P3 `toISOString().slice(0, 10|16)` / `toISOString().split("T")`;
- P4 `toLocaleDateString(` / `toLocaleTimeString(` anywhere, and `new Date(…).toLocaleString(`, unless `timeZone` appears within the same call (that line or the next 6).
Allowlist: `{ file, contains, reason }[]` for exactly the section C entries. Failure message lists `file:line`, the pattern, and "use lib/shared/datetime.ts or lib/shared/report-time.ts".

- [ ] Step 1: write `saigonToday` tests (2026-09-14T23:30:00Z → "2026-09-15"; 2026-09-15T16:59:59Z → "2026-09-15"; 2026-09-15T17:00:00Z → "2026-09-16"), and the guard. Step 2: run — guard red listing the A and B sites; helper red (missing). Step 3: implement `saigonToday` via the existing Saigon parts. Step 4: helper green; the guard stays red until Tasks 2–4 land (Opus runs it last).

### Task 2 (Sonnet): server sites A1–A13

**Files:** the A-table files; tests beside each (`page.test.tsx` / `actions.test.ts` existing files extended, new ones where none exists).

- A1, A2: day → range with `toSaigonUtcRange(from, to)`.
- A3, A8: `saigonToday()` and `resolvePreset`-style calendar arithmetic on `YYYY-MM-DD` strings; "yesterday" via `addDays`-equivalent (export the one in `date-range-presets.ts` if needed, no copy).
- A4, A5, A7: `saigonBucketKeys(created_at)` for month, date, weekday and hour.
- A6, A10, A12: `formatDateTimeFull` / `formatDate`.
- A9: compare `saigonBucketKeys(...).monthKey` strings.
- A11: `formatDate(row.date)` (moves to Task 4 if the component is client-rendered).
- A13: `formatVnDay(digest.date)` with the weekday label kept (use `timeZone: "Asia/Ho_Chi_Minh"` in its options).
- Tests: per site, a fixed instant inside 06:00–06:59 Saigon (e.g. `2026-09-14T23:30:00Z` = 15/09 06:30) lands on 15/09 / the 6h column / its own month.
- Before/after measurement for the worked example (15/09/2026 order list count) with read-only SQL.

### Task 3 (Sonnet): docs line in the rule

- `docs/02-rules/business-rules/data-integrity.md`, under `BR-DATA-006`: one dated paragraph — every day and clock time is computed in Saigon time wherever the code runs; the guard `lib/shared/timezone-guard.test.ts` refuses the patterns that broke it four times (commits above); add a `Test:` link. (Opus may write this instead; it is a doc.)

### Task 4 (Gemini): browser sites (section B)

- Date inputs and filters (`DayInput`, `DateRangeFilter`, `OrderTable`, `DailyDigestFilter`, `SalesFilter`): produce and read `YYYY-MM-DD` strings without building local `Date`s — `saigonToday()` for "today", string arithmetic helpers from `lib/shared/date-range-presets.ts` for ranges.
- `datetime-local` defaults (`BrandForm`, `OutletForm`, `IssueSlipClient`, `PromotionForm`): `toSaigonIsoString(new Date()).slice(0, 16)` (Saigon wall clock), same shape the inputs expect.
- Displays (`POSScreen:1009`, `PosSyncClient`, `StocktakeClient`): `formatDate` / `formatDateTimeFull`.
- Tests: each changed component renders the Saigon value with the clock fixed at `2026-09-14T23:30:00Z`.

### Task 5 (Opus)

- Prove the guard red on the old code (lists every A and B site), green after; prove each site test red under `TZ=UTC` on the old code.
- Five gates (build in a worktree); whole `vitest` under `TZ=UTC` once as well.
- Owner check list after the push: `/admin/orders` filtered to one day shows its 06:xx orders; the sales report's hour chart peaks at the shop's real busy hours; a purchase order's header time matches the time it was entered.

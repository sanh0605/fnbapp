# UI wave 1: one frame, one word list, one control family — Implementation Plan

> **For agentic workers:** the three tasks below go to Gemini Flash (`gemini-3.8-flash-high`) through `agy`, one worktree each, run in parallel; Opus runs the checks, an independent `reviewer` agent checks each diff, Opus commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** fix the faults the 2026-10-17 screen audit found that come from shared pieces, so one change fixes many pages.

**Architecture:** no new screens, no data change, no migration. Changes sit in the admin frame (`app/admin/layout.tsx`), the shared form footer (`components/ui/FormActionBar.tsx`), the shared controls in `components/ui/`, and word-level fixes on the pages that show English or bare numbers.

**Source:** master plan row 6-giao-diện-toàn-bộ (owner 2026-10-17: *"các ô đều không giống nhau… cách sắp xếp các nút cũng chưa tốt"*). Findings: `.worktrees/audit-findings-1d.md`, `-1p.md`, `-2d.md`, `-2p.md` (284 rows, four independent Opus readers, every screenshot opened), checked against the real screens on 8386 the same day.

## Current state

1. **States, and how each is set.** Not applicable as a state machine: these are display fixes. The one state that matters is the form footer's "Có thay đổi chưa lưu", set by any `input`/`change` event inside its form (`BR-UI-015`); it is unchanged.
2. **Buttons.** Every create/edit form ends with `FormActionBar`: "Bỏ"/"Bỏ thay đổi" (secondary) then optional extra buttons (`children`, e.g. "Lưu nháp" on Tạo phiếu nhập) then the main button ("Tạo"/"Lưu thay đổi"/its own verb). On a phone with extra buttons the three stack full width (about 215 px of a 780 px screen, measured on Tạo phiếu nhập). The stocktake counting screen has its own footer (Huỷ phiên, Xem trước). None of these change meaning; only placement.
3. **Lists.** Lists draw through `components/ui/list/DataList.tsx`. Their total row gets pre-formatted strings from each page (`totals.values`); five pages pass money without "đ" while their rows show "đ". Status pills (`components/ui/Badge.tsx`) and codes wrap to two lines inside narrow columns.
4. **Inputs.** Shared boxes are 48 px on a phone and 40 px on a computer, text 14 px (`BR-UI-014`). Measured exceptions in one form: date boxes 44–46 px with larger text, `SearchableSelect` text larger than `Select` beside it. Typed text is `text-sm` on every shared box, while `BR-UI-014` says 16 px on a phone: a gap between rule and code, left for its own check, not changed here.
5. **Data served.** Every admin screen. Deliberately not served here: the POS (rebuilt separately, its own look per `BR-UI-005`), the Tạo phiếu nhập and Tạo phiếu xuất layouts (redesigned separately, wave 2), and showing staff names instead of logins (needs a server join, wave 2 backend).

Extra questions for this job:

6. **Which findings are not faults?** (after Sonnet's critique, 2026-10-17) Dropped, with reason:
   - Every "Góp ý covers …" on a computer: the purple button is the test machine's feedback tool, mounted only when `NODE_ENV !== "production"` (`app/layout.tsx:48`). The owner never sees it on the live app. It is still moved off "Bán hàng" on a phone (task A) because the owner reviews on 8386.
   - "Save bar sits mid-form / covers fields" on full-page shots: a pinned bar is drawn where the screen ends, so a full-page capture shows it mid-page. Checked on the real screen: on a computer the bar stops about 32 px above the bottom edge with rows showing under it (a real fault, task A); it does not cover fields while scrolling more than any pinned footer does.
   - The 404 on `/admin/finance/[id]`: the capture used "transfers" as an id. The English 404 page itself is real (task A).
   - "Bỏ" on create vs "Bỏ thay đổi" on edit: the owner's rule `BR-UI-015`.
   - Commas as thousands marks: `BR-UI-008`.
   - Category names "Yogurt", "Topping": the owner's own data, typed by him. "Voucher" and "Topping" are his own loanwords (`BR-UI-001`).
   - "Ví dụ: 1,25" on Phiếu xuất: the hint is "Ví dụ: 1,250.5" cut off at the box edge (`NumberInput.tsx:250`), correct under `BR-UI-008`.
   - The outlet's 12-hour `--:-- --` time boxes: the capture browser ran in English; a `type="time"` box follows the computer's language, 24-hour on a Vietnamese one.
   - "Size" in order and product screens: common in cafés and used across the product form ("Các size"); left as is, listed for the owner at the end.
7. **What already broke and was fixed today?** The stocktake counting footer on a phone sat under the bottom menu (only the top 6 px of Huỷ phiên / Xem trước showed). Fixed in `StocktakeCountView.tsx` by Opus (one class, sửa nhỏ), checked by eye at 360×780 and 1280×720.

Worked example on real screens (8386, 2026-10-17):
- Tài sản list, phone: rows end "…đ", the total row reads "Tổng (không tính đã thanh lý hết): 9,778,214". After: "9,778,214đ".
- Nhân sự: role chips read "MANAGER" in red. After: "Quản lý" in a grey chip.
- Tạo phiếu nhập, phone: Bỏ / Lưu nháp / Tạo stacked, 215 px. After: one row, 64 px plus padding.

## Global constraints (copied into every brief)

- Read `CLAUDE.md`, `.claude/rules/ui-devices.md`, `docs/02-rules/business-rules/screens.md` (`BR-UI-001`, `-008`, `-014`, `-015`) first.
- Only edit the files your task names. Write per ponytail: no extra code, no new options, no new component when a class change does it.
- Every word on screen Vietnamese; code and comments English. Numbers through `lib/shared/format.ts` only.
- Phone: boxes and buttons 48 px, typed text 16 px; computer: 40 px, text 14 px.
- No shell commands at all (no grep, npx, git): the run aborts. Opus runs tests.

## Review focus

1. A form whose footer has extra buttons ("Lưu nháp") on a 360 px phone: all buttons in one row, equal widths, nothing past the screen edge. Decided 2026-10-17 at review: a label too long for its share ("Cập nhật & Hoàn thành") wraps to two lines inside its 48 px button; shorter labels stay on one line.
2. The form footer on a phone touches the bottom menu: no strip of page showing between them at 360×780 and 390×844.
3. The form footer on a computer touches the bottom edge of the window at 1280×720, with the last field reachable above it when scrolled to the end.
4. A role the badge does not know (future role) still shows something readable, not blank.
5. A status pill in a narrow column stays on one line; the column widens instead of the pill breaking.
6. On a phone with the keyboard open in the last box of a long form, that box stays visible above the footer.
7. "Có thay đổi chưa lưu" appearing does not make the phone footer jump taller over the box being typed in.
8. Tạo phiếu nhập at 360 px: "Bỏ", "Lưu nháp", "Tạo" in one row, none wrapped; a completed order's "Cập nhật & Hoàn thành" may wrap (see 1).
9. A list in select mode on a phone: the "Xoá n dòng" bar meets the bottom menu like the form footer.

---

### Task A: the admin frame and the form footer

**Files:**
- Modify: `app/admin/layout.tsx` (content scroll container, around line 120)
- Modify: `components/ui/FormActionBar.tsx`
- Check only: `components/ui/list/DataList.tsx` line 311 bulk-delete bar (already 58 px; step 2 fixes its gap)
- Modify: `components/dev-feedback/UiFeedbackTool.tsx` (button style, lines 58–65; panel lines 40–56)
- Create: `app/admin/not-found.tsx`
- Test: `components/ui/FormActionBar.test.tsx` (exists? extend; else create), `app/admin/not-found.test.tsx`

- [ ] **Step 1: tests first, red on today's code.**
  - FormActionBar with `children` (one extra secondary button): the button group has the phone class for one row (`grid` with as many columns as buttons, or `flex` without `flex-col`), not `flex-col`.
  - `app/admin/not-found.tsx` renders the heading "Không tìm thấy trang" and a link to `/admin`.
- [ ] **Step 2: the scroll container.** Measured on 8386 at the top of the page (not at the end of the scroll): the footer's bottom edge is at 688 px of 720 on a computer and 74 px above the screen bottom on a phone instead of 58, i.e. exactly the scroll container's bottom padding (`p-4 md:p-6 lg:p-8`, `app/admin/layout.tsx:120`): a sticky element sticks inside that padding. Remove only the bottom padding from the scroll container (`px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8`) and give the inner wrapper the space instead (`pb-24 md:pb-6 lg:pb-8`; the phone `pb-24` stays, it clears the bottom menu). At the end of the scroll the footer rests at the form's end with the wrapper's padding below it; that is expected. Nothing else in the layout changes.
- [ ] **Step 3: the footer on a phone.**
  - Its bottom offset stays `calc(58px+env(safe-area-inset-bottom))` in `FormActionBar`, `DataList`'s bar and `StocktakeCountView.tsx:820` (do not edit that file; Opus set it). The menu's top is 61 px up, so 58 tucks 3 px under the menu (menu z-40, bar z-30): no strip shows once step 2 removes the padding.
  - Buttons always in one row on a phone: Bỏ, extra buttons, main button last on the right, equal widths. Labels are not reworded. Side padding is smaller on the phone; a label still too long for its equal share wraps inside the button (decided at review 2026-10-17: a fixed no-wrap row pushed the third button past a 360 px screen).
  - "Có thay đổi chưa lưu" stays; on a phone it sits on its own small line above the buttons only when shown (no empty line otherwise).
- [ ] **Step 4: "Góp ý"** never covers the footer's main button. Changed after Playwright 2026-10-17 (76 px still covered "Tạo"): bottom `calc(150px + safe area)` on a phone and 88 px on a computer; its panels sit 56 px higher (206 and 144). Inline style, as the file already does.
- [ ] **Step 4b: unknown admin address.** Added after Playwright 2026-10-17 (`/admin/khong-co` showed the plain Next 404 outside the frame): `app/admin/[...missing]/page.tsx` calls `notFound()` so `app/admin/not-found.tsx` renders; `scripts/doc-checks/run-blocking.ts` exempts a page that only calls `notFound()` from route-coverage, like a pure redirect.
- [ ] **Step 5: not-found page.** `app/admin/not-found.tsx`: Vietnamese, inside the admin frame (this file is rendered inside `app/admin/layout.tsx` automatically), using `PageHeader`/`EmptyState` from `components/ui/`: title "Không tìm thấy trang", one line "Trang này không có hoặc đã bị xoá.", one link "Về Tổng quan" to `/admin`.
- [ ] **Step 6:** tests green; Opus runs the five checks and Playwright (360×780, 390×844, 1280×720) on Tạo phiếu nhập, Sửa hàng hoá, Tạo khuyến mãi, Kiểm kê STK-002, and `/admin/khong-co` (404).

### Task B: words and money marks on screen

**Files (each a small text change):**
- `app/admin/users/components/RoleBadge.tsx`: show "Quản trị viên" (ADMIN), "Quản lý" (MANAGER), "Nhân viên" (STAFF), "Hệ thống" (SYSTEM), unknown → the raw value (roles: `lib/auth/auth.ts:9`). Same labels as `UserForm.tsx:75-76`. Keep its rectangle shape; one neutral colour for all (red reads as an error). Also `app/admin/users/components/UsersClient.tsx:252`: the role filter's `<option>` text "MANAGER" → "Quản lý" (value unchanged).
- `components/ui/Badge.tsx`: `whitespace-nowrap` so pills never break inside.
- Money totals add "đ" to money values, same as their rows: `app/admin/inventory/assets/components/AssetsClient.tsx:260`, `app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx:268`, `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx:307`, `app/admin/orders/OrderTable.tsx:440`, `app/admin/finance/components/CashBookClient.tsx:654` (check each: only money columns get "đ", quantities do not).
- Prices without "đ" in list rows: Đơn hàng list, Món list, Tuỳ chọn list, an order's detail page, a purchase order's detail and cancel page (`app/admin/inventory/purchase-orders/[id]/page.tsx`, `.../cancel/components/CancelPurchaseOrderForm.tsx`, `app/admin/orders/[id]/components/OrderDetailView.tsx`). A zero fee shows "0đ", never "+0"/"-0".
- English words → Vietnamese: "Ghi chú / links" → "Ghi chú / liên kết" (`SupplierForm.tsx:127`), "(Tổng bill)" → "(Tổng hoá đơn)" (`PromotionForm.tsx:325`). "Voucher", "Topping" and "Size" stay.
- Activity log (`app/admin/activity-log/components/ActivityLogClient.tsx`) and order detail (`app/admin/orders/[id]/components/OrderDetailView.tsx:293`): the reason "POS checkout" (stored by `app/pos/actions.ts:119`) shows as "Bán tại máy bán hàng" (display only; stored rows and the POS unchanged). In the activity log hide the event's internal id (`:351`), the version chip (`:368-375`) and the raw "Mã đơn: ord-…" chip (`:391`); the order's 12-digit code is already shown at `:348`.
- Tests: RoleBadge renders "Quản lý" for MANAGER (red on today's code: renders "MANAGER"); Badge has `whitespace-nowrap`. Tests that will need their expected text updated in the same commit, each named in the report: `app/admin/users/[id]/components/UserDetailView.test.tsx:65` ("MANAGER"), `CancelPurchaseOrderForm.test.tsx:242-271`, `VoidOrderForm.test.tsx:109`, `ModifiersClient.test.tsx:233` (amounts gain "đ"). Any other test that breaks: stop and report, do not change it.

### Task C: one control family

**Files:** `components/ui/CustomDatePicker.tsx`, `components/ui/SaigonDateTimeInput.tsx`, `components/ui/DayInput.tsx`, `components/ui/MoneyInput.tsx`, `components/ui/SearchableSelect.tsx`, `components/ui/Select.tsx`.

- [ ] Every one of them: 48 px tall on a phone, 40 px on a computer, same text size, border, radius, padding and placeholder colour as `TextInput.tsx:21` (today `text-sm`). Copy the classes from `TextInput`; do not invent a new shared constant.
- [ ] `Select` and `SearchableSelect` closed look identical: same chevron icon (the one `SearchableSelect` draws), same text size.
- [ ] Clear buttons inside date boxes use the house colours (no blue).
- [ ] Test: one render test per changed control asserting the shared height classes (`min-h-[48px] md:min-h-[40px]`), red first on the controls that lack them.
- [ ] Playwright: Tạo thu chi, Tạo chuyển tiền, Sửa thương hiệu, Thanh lý tài sản, Tạo khuyến mãi, Sửa hàng hoá at 1280×720 and 360×780: boxes in one row measure the same height (±1 px) and text size.

## Later waves (not in this plan)

- **Wave 2a, Tạo phiếu nhập and Tạo phiếu xuất on a computer** (owner: *"tạo đơn nhập rất khó khăn"*): whole-page redo, Gemini Flash (Argon not used, owner 2026-10-18), after a short design with a real example (a real supplier and three real lines). Audit facts to carry: the item table squeezed into 600 px with headers on three lines, native "-- Chọn hàng --" and "--" unit selects, a big empty "Hàng nhập" area, the footer covering "Tổng tiền hàng", the date hint cut off.
- **Wave 2b, staff names instead of logins** ("tuyen2612", "admin"): `users.name` exists (checked `information_schema` 2026-10-17); backend-coder joins it where lists show `created_by`.
- **Wave 3, the POS** from the chosen mockup (https://claude.ai/artifact/DEbZg7kdYiKDwc2rvWKaNW; recommendation A), one shared notice style for the POS and admin.

Seen: the four audit files, the Haiku map of shared components (checked by reading `FormActionBar.tsx`, `Badge.tsx`, `RoleBadge.tsx`, `app/admin/layout.tsx`), 14 real-screen views. Not seen: below the first screen on most pages; pages outside the 107 audited routes.

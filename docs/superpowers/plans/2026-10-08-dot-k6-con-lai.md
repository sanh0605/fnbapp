# Đợt K6 — các màn còn lại mặc khuôn dùng chung, danh sách nợ về rỗng (BR-UI-005)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân sự, Thương hiệu, Điểm bán, Nhật ký hoạt động, Đơn cần chú ý, Xoá bộ nhớ đệm, Đổi mật khẩu và hộp "Chọn điểm bán" trước khi mở máy bán hàng dùng khuôn trong `components/ui/`; phép kiểm canh không còn dòng nợ nào gắn K6.

**Architecture:** Không thêm khuôn mới: `TextInput` đã nhận `type` (`time`, `password`), `DayInput` lo ô ngày, bộ `Table` lo bảng. Màn hình do Gemini sửa; Opus viết test trước, soát, viết tài liệu.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (mục 2, 3, 4 đợt K6).

## Hiện trạng

Đo 2026-10-08 bằng phép kiểm canh `components/ui/template.guard.test.ts`: 30 dòng nợ gắn K6 trên 18 file; thêm 2 dòng gắn `ToppingsManager.tsx` (code chết, không file nào nhập nó; kế hoạch chung phần 6).

1. **Trạng thái.** Không áp dụng cho dữ liệu, vì đợt này không thêm bảng hay trạng thái nào. Ô nhập có ba trạng thái hiển thị như K2.
2. **Nút.** 10 file tự tô nút nâu đặc: nút "Tạo" của ba danh sách (Nhân sự, Thương hiệu, Điểm bán), nút "Chỉnh sửa" của ba trang chi tiết, nút "Lọc" của Nhật ký, nút "Cập nhật mật khẩu", nút "Thử lại" và các nút điểm bán trong hộp "Chọn điểm bán". Sau đợt này:
   - "Tạo", "Lọc", "Cập nhật mật khẩu", "Thử lại" (chỉ hiện khi tải lỗi, lúc đó không có nút điểm bán nào): `Button` Chính.
   - "Chỉnh sửa" trên trang chi tiết: `Button` Phụ (trang chi tiết không có nút nâu, như K3–K5).
   - **Nút điểm bán trong hộp "Chọn điểm bán": `Button` Phụ, trải hết chiều ngang**, tên điểm bán và dòng "Đang trong giờ mở cửa / Ngoài giờ mở cửa" giữ nguyên. Hôm nay mỗi điểm bán là một nút nâu to: ba điểm bán là ba nút nâu cùng lúc, trái luật "mỗi màn nhiều nhất một nút chính" (spec 2.1).
   - Nút "Đã xử lý" trong bảng Đơn cần chú ý: `Button` Phụ.
   Không nút nào bị ẩn hay hiện thêm.
3. **Danh sách.** Nhân sự, Thương hiệu, Điểm bán đã dùng `DataList`; chỉ đổi ô lọc và nút. Đơn cần chú ý tự vẽ hai `<table>` không có thẻ cho điện thoại: chuyển sang bộ `Table` cho máy tính và thêm thẻ xếp dọc cho điện thoại (`.claude/rules/ui-devices.md`; chủ quán 2026-10-06: mọi trang sửa phải có cả hai bố cục). Nhật ký là dòng thời gian, không phải bảng: chỉ đổi khung lọc.
4. **Ô nhập.**
   - Ô chữ và ô chọn tự tô: thành `TextInput`, `Select`, mỗi ô trong `Field`.
   - Hai ô giờ của Điểm bán ("Giờ mở cửa", "Giờ đóng cửa", `type="time"`): thành `TextInput type="time"`, vẫn là ô giờ của trình duyệt; tên và giá trị gửi đi (`open_time`, `close_time`, dạng `HH:MM`) không đổi.
   - Ba ô mật khẩu của Đổi mật khẩu và ô mật khẩu của Thêm nhân sự: `TextInput type="password"`.
   - Hai ô "Từ ngày", "Đến ngày" của Nhật ký hôm nay là `<input type="date">`: thành `DayInput`. Gõ hay chọn một ngày hợp lệ thì đưa `from` / `to` dạng `yyyy-mm-dd` lên địa chỉ trang như hôm nay; ngày gõ sai thì báo "Ngày không hợp lệ" dưới ô và **không** đổi địa chỉ trang; xoá trắng thì bỏ `from` / `to`.
   - Không có ô số nào.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ các màn trên. Cố ý không đụng: máy chủ, server action, `lib/`, máy bán hàng (`app/pos`); **cách chạy** của hộp "Chọn điểm bán" (vẫn là hộp bật lên, điểm bán ngoài giờ vẫn hỏi "Vẫn mở máy" trước khi mở): biến nó thành trang hay không là câu hỏi của `BR-DATA-007`, không phải của đợt này. `ToppingsManager.tsx` là code chết: không sửa, không xoá (CLAUDE.md), hai dòng nợ của nó ở lại với lời ghi rõ. Không đổi chữ hiển thị, trừ nhãn viết hoa từng từ ("Loại Sự Kiện", "Tài Khoản" thành "Loại sự kiện", "Tài khoản") và chữ tiếng Anh trong ngoặc ("Xóa Bộ Nhớ Đệm (Clear Cache)" thành "Xóa bộ nhớ đệm").

Câu hỏi riêng của việc này:

6. **Chủ quán thấy gì khác?** Nút, ô theo trang mẫu đã duyệt. Hộp "Chọn điểm bán": các nút điểm bán thành nền trắng viền xám thay cho nâu đặc. Nhật ký: ô ngày gõ được `15/09/2026` hoặc bấm lịch. Đơn cần chú ý: bảng theo khuôn, trên điện thoại thành thẻ.
7. **Có làm máy bán hàng ngừng nhận đơn không?** Không. Không file nào trong `app/pos` hay `lib` bị đụng; hộp chọn điểm bán chỉ đổi hình nút, vẫn gọi đúng hàm mở máy.
8. **Mật khẩu** vẫn là ô che chữ; Đổi mật khẩu vẫn báo "Mật khẩu xác nhận không khớp" và "Mật khẩu mới phải có ít nhất 6 ký tự" trước khi gửi.
9. **Ví dụ bằng số thật.** Không áp dụng, vì đợt này không đọc hay ghi dữ liệu thật; số trong test là số giả.

Đã xem: danh sách nợ K6; từng dòng vi phạm của 18 file; thân `ActivityLogClient.tsx` (khung lọc, `updateUrl`), `PosOutletPicker.tsx`, hộp chọn điểm bán trong `app/admin/layout.tsx`, `PosSyncClient.tsx`, `app/settings/password/page.tsx`, `app/admin/clear-cache/page.tsx`; API `DayInput`, `Field`, `PageHeader`, `Button`, `TextInput`; tên test hiện có của các màn.
Chưa xem: thân các file Nhân sự, Thương hiệu, Điểm bán ngoài dòng vi phạm (Gemini đọc khi làm, Opus đọc khi soát).

## Global Constraints

- Templates (K2, `components/ui/`): `Button` (`primary` | `secondary` | `delete` | `danger`, `href`, `loading`), `TextInput` (`type`, `keypad`), `Select`, `Field`, `DayInput`, `Table` set, `PageHeader`, `list/DataList`, `list/FilterCard`, `detail/DetailHeader`, `BackLink`, `Badge`.
- Trang không tự đặt màu, cỡ, viền, độ đậm cho thứ khuôn đã lo (spec 2); `className` trên khuôn chỉ để bố cục.
- No popups added (`BR-DATA-007`); no new server action; values sent to the server identical to today.
- Every control 44px tall; desktop table plus phone cards for every list (`.claude/rules/ui-devices.md`).
- One brown main button visible per screen at any moment.
- All visible text Vietnamese; labels in sentence case except units, Topping, MR.PHIN, PO.
- Never delete a test; a test changed because markup moved to a template says so in the commit.
- The guard's debt lists may only shrink; after this wave only the two `ToppingsManager.tsx` lines remain.

## Review Focus

1. Điểm bán: sửa một điểm bán có giờ `07:00`–`22:30` thì hai ô hiện đúng giờ đó và gửi `open_time=07:00`, `close_time=22:30`; để trống thì gửi trống. Pinned in Task 1.
2. Thêm nhân sự: ô mật khẩu vẫn che chữ (`type="password"`), vai trò chọn "Quản lý" gửi đúng mã vai trò như hôm nay. Pinned in Task 1.
3. Nhật ký: gõ `15/09/2026` vào "Từ ngày" rồi rời ô đưa `from=2026-09-15` lên địa chỉ trang; gõ `32/13/2026` thì báo "Ngày không hợp lệ" và địa chỉ trang không đổi. Pinned in Task 2.
4. Hộp "Chọn điểm bán": điểm bán ngoài giờ vẫn hỏi trước khi mở máy, trong giờ mở thẳng; không nút điểm bán nào nền nâu. Pinned by `PosOutletPicker.test.tsx` plus one test in Task 2.
5. Đổi mật khẩu: xác nhận không khớp thì báo và không gửi; đúng thì gọi `changePasswordAction(cũ, mới)` đúng hai chuỗi. Pinned in Task 2 (file test mới).

---

### Task 1: Nhân sự, Thương hiệu, Điểm bán (Gemini)

**Files:** `app/admin/users/components/{UsersClient,UserForm,EditUserForm}.tsx`, `app/admin/users/[id]/components/UserDetailView.tsx`, `app/admin/brands/components/{BrandsClient,BrandForm}.tsx`, `app/admin/brands/[id]/components/BrandDetailView.tsx`, `app/admin/outlets/components/{OutletsClient,OutletForm}.tsx`, `app/admin/outlets/[id]/components/OutletDetailView.tsx`.

- [ ] Step 1 (Opus): remove these files' K6 lines from the guard. Tests: `OutletForm` edit with `open_time "07:00:00"`, `close_time "22:30:00"` shows `07:00` / `22:30` in boxes labelled "Giờ mở cửa" / "Giờ đóng cửa" and the submitted `FormData` carries `open_time=07:00`, `close_time=22:30`; `UserForm` password box `type="password"` with `name="password"`, choosing the manager role posts the same role value as today. Run. Expected: guard FAIL (names the files); the field tests pin today's behaviour (PASS before and after).
- [ ] Step 2 (Gemini): brief. Step 3 (Opus): `npx vitest run app/admin/users app/admin/brands app/admin/outlets components/ui/template.guard.test.ts`, `npx tsc --noEmit`, read the diff (same names and values posted, no server action touched).
- [ ] Step 4: commit `feat(ui): Nhân sự, Thương hiệu, Điểm bán wear the shared templates (BR-UI-005, wave K6)`.

### Task 2: Nhật ký, Đơn cần chú ý, Xoá bộ nhớ đệm, Đổi mật khẩu, hộp Chọn điểm bán (Gemini)

**Files:** `app/admin/activity-log/components/ActivityLogClient.tsx`, `app/admin/pos-sync/{page,PosSyncClient}.tsx`, `app/admin/clear-cache/{page,loading}.tsx`, `app/settings/password/page.tsx`, `app/admin/layout.tsx` (only the "Thử lại" button), `app/admin/components/PosOutletPicker.tsx`.

- [ ] Step 1 (Opus): remove the remaining K6 lines from the guard. Tests:
  - `ActivityLogClient`: "Từ ngày" typed `15/09/2026` + blur → router push with `from=2026-09-15`; typed `32/13/2026` + blur → "Ngày không hợp lệ" shown, no push. Expected: FAIL (today's box is `type="date"`, typing text does nothing).
  - `PosOutletPicker`: no outlet button has `bg-primary`. Expected: FAIL.
  - `PosSyncClient`: the failure list has a phone card list (`md:hidden`) carrying the request code and an "Đã xử lý" button, and the desktop table is the shared one. Expected: FAIL.
  - New `app/settings/password/page.test.tsx`: mismatched confirmation shows "Mật khẩu xác nhận không khớp" and does not call `changePasswordAction`; `abc123` / `newpass1` / `newpass1` calls it with `("abc123", "newpass1")`. Expected: PASS today (pins behaviour through the move).
- [ ] Step 2 (Gemini): brief. Step 3 (Opus): `npx vitest run app/admin/activity-log app/admin/pos-sync app/admin/clear-cache app/settings app/admin/components app/admin/layout components/ui/template.guard.test.ts`, tsc, read the diff.
- [ ] Step 4: commit `feat(ui): Nhật ký, Đơn cần chú ý, Đổi mật khẩu and the outlet picker wear the shared templates; the guard's debt lists are empty but for dead code (BR-UI-005, wave K6)`.

### Task 3: Tài liệu, năm lệnh kiểm, soát (Opus)

- [ ] `docs/02-rules/business-rules/screens.md` BR-UI-005 status: K6 on its date, lists empty but for `ToppingsManager.tsx`. Master plan 1b line; spec status line.
- [ ] Five gates; build in a throwaway worktree.
- [ ] Fresh reviewer on the most capable model with the Review Focus verbatim; one fix pass.
- [ ] Danh sách cho chủ quán bấm thử (giữ tới lần đẩy).
